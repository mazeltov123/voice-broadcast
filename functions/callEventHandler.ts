import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');

async function telnyxCommand(callControlId, action, body = {}) {
  console.log(`[CMD] ${action} on ${callControlId}`);
  const res = await fetch(
    `https://api.telnyx.com/v2/calls/${callControlId}/actions/${action}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[CMD] ${action} error:`, errText);
  }
  return res.ok;
}

function encodeState(obj) {
  return btoa(JSON.stringify(obj));
}

function decodeState(encoded) {
  if (!encoded) return {};
  try {
    return JSON.parse(atob(encoded));
  } catch {
    return {};
  }
}

// Fetch broadcast playlist from DB (avoids storing large data in call state)
async function fetchPlaylist(base44) {
  const allBroadcasts = await base44.asServiceRole.entities.Broadcast.list('-created_date', 100);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const now = new Date();
  const broadcasts = allBroadcasts.filter(b => {
    const createdAt = new Date(b.created_date);
    const scheduledAt = b.scheduled_at ? new Date(b.scheduled_at) : null;
    // Include completed OR in_progress broadcasts from the past year
    // Exclude future scheduled broadcasts that haven't started yet
    const isStarted = b.status === 'completed' || b.status === 'in_progress';
    const isNotFuture = !scheduledAt || scheduledAt <= now;
    return isStarted && isNotFuture && createdAt >= oneYearAgo;
  });

  if (broadcasts.length === 0) return [];

  const audioFiles = await base44.asServiceRole.entities.AudioFile.list();
  const audioMap = Object.fromEntries(audioFiles.map(a => [a.id, a]));

  return broadcasts.map(b => ({
    date: new Date(b.scheduled_at || b.created_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }),
    audioUrl: audioMap[b.audio_file_id]?.file_url || '',
    name: b.name || '',
  })).filter(p => p.audioUrl);
}

// =============================================
// INBOUND IVR HANDLER
// =============================================
async function handleInbound(eventType, payload, callControlId, state, base44) {
  const callerPhone = state.callerPhone || payload?.from || 'Unknown';

  // Fetch custom IVR audio settings
  let greetingUrl = '';
  let recordAnnouncementUrl = '';
  try {
    const settings = await base44.asServiceRole.entities.IvrSettings.list();
    if (settings.length > 0) {
      greetingUrl = settings[0].greeting_url || '';
      recordAnnouncementUrl = settings[0].record_announcement_url || '';
    }
  } catch (err) {
    console.log('[IVR] Could not fetch IvrSettings:', err.message);
  }

  switch (eventType) {
    case 'call.initiated': {
      console.log(`[IVR] Incoming call from ${callerPhone} — answering`);
      await telnyxCommand(callControlId, 'answer', {
        client_state: encodeState({ mode: 'inbound_ivr', step: 'answering', callerPhone }),
      });
      break;
    }

    case 'call.answered': {
      console.log(`[IVR] Call answered — playing menu`);
      if (greetingUrl) {
        console.log(`[IVR] Using custom greeting: ${greetingUrl}`);
        await telnyxCommand(callControlId, 'gather_using_audio', {
          audio_url: greetingUrl,
          minimum_digits: 1,
          maximum_digits: 1,
          valid_digits: '12',
          inter_digit_timeout_secs: 10,
          client_state: encodeState({ mode: 'inbound_ivr', step: 'menu', callerPhone }),
        });
      } else {
        await telnyxCommand(callControlId, 'gather_using_speak', {
          payload: 'Welcome to Voice Cast. Press 1 to listen to previous broadcasts. Press 2 to record and send a new message.',
          voice: 'female',
          language: 'en-US',
          minimum_digits: 1,
          maximum_digits: 1,
          valid_digits: '12',
          inter_digit_timeout_secs: 10,
          client_state: encodeState({ mode: 'inbound_ivr', step: 'menu', callerPhone }),
        });
      }
      break;
    }

    case 'call.gather.ended': {
      const digits = payload?.digits || '';
      console.log(`[IVR] Gather ended — digits: ${digits}`);

      if (digits === '1') {
        try {
          const playlist = await fetchPlaylist(base44);

          if (playlist.length === 0) {
            await telnyxCommand(callControlId, 'speak', {
              payload: 'There are no broadcasts available. Goodbye.',
              voice: 'female',
              language: 'en-US',
              client_state: encodeState({ mode: 'inbound_ivr', step: 'goodbye', callerPhone }),
            });
            break;
          }

          console.log(`[IVR] Found ${playlist.length} broadcasts, playing first`);

          // Play the first broadcast audio directly (no announcement)
          await telnyxCommand(callControlId, 'speak', {
            payload: `Playing broadcast from ${playlist[0].date}.`,
            voice: 'female',
            language: 'en-US',
            client_state: encodeState({
              mode: 'inbound_ivr',
              step: 'announce_broadcast',
              callerPhone,
              broadcastIndex: 0,
              totalBroadcasts: playlist.length,
            }),
          });
        } catch (err) {
          console.error('[IVR] Error fetching broadcasts:', err);
          await telnyxCommand(callControlId, 'speak', {
            payload: 'An error occurred. Please try again later. Goodbye.',
            voice: 'female',
            language: 'en-US',
            client_state: encodeState({ mode: 'inbound_ivr', step: 'goodbye', callerPhone }),
          });
        }
      } else if (digits === '2') {
        if (recordAnnouncementUrl) {
          console.log(`[IVR] Using custom record announcement`);
          await telnyxCommand(callControlId, 'playback_start', {
            audio_url: recordAnnouncementUrl,
            client_state: encodeState({ mode: 'inbound_ivr', step: 'record_announcement_playing', callerPhone }),
          });
        } else {
          await telnyxCommand(callControlId, 'speak', {
            payload: 'Please record your message after the tone. Hang up when you are done.',
            voice: 'female',
            language: 'en-US',
            client_state: encodeState({ mode: 'inbound_ivr', step: 'record_prompt', callerPhone }),
          });
        }
      } else {
        await telnyxCommand(callControlId, 'speak', {
          payload: 'Invalid selection. Goodbye.',
          voice: 'female',
          language: 'en-US',
          client_state: encodeState({ mode: 'inbound_ivr', step: 'goodbye', callerPhone }),
        });
      }
      break;
    }

    case 'call.speak.ended': {
      const step = state.step;
      console.log(`[IVR] Speak ended — step: ${step}`);

      if (step === 'announce_broadcast') {
        // Fetch playlist again and play current broadcast audio
        try {
          const playlist = await fetchPlaylist(base44);
          const idx = state.broadcastIndex || 0;

          if (idx < playlist.length && playlist[idx].audioUrl) {
            console.log(`[IVR] Playing broadcast ${idx + 1} audio: ${playlist[idx].audioUrl}`);
            await telnyxCommand(callControlId, 'playback_start', {
              audio_url: playlist[idx].audioUrl,
              client_state: encodeState({
                mode: 'inbound_ivr',
                step: 'playing_broadcast',
                callerPhone,
                broadcastIndex: idx,
                totalBroadcasts: playlist.length,
              }),
            });
          } else {
            console.log(`[IVR] No audio for broadcast ${idx}, ending`);
            await telnyxCommand(callControlId, 'speak', {
              payload: 'Goodbye.',
              voice: 'female',
              language: 'en-US',
              client_state: encodeState({ mode: 'inbound_ivr', step: 'goodbye', callerPhone }),
            });
          }
        } catch (err) {
          console.error('[IVR] Error playing broadcast:', err);
          await telnyxCommand(callControlId, 'hangup', {});
        }
      } else if (step === 'record_prompt') {
        await telnyxCommand(callControlId, 'record_start', {
          format: 'mp3',
          channels: 'single',
          play_beep: true,
          max_length: 300,
          timeout_secs: 5,
          client_state: encodeState({ mode: 'inbound_ivr', step: 'recording', callerPhone }),
        });
      } else if (step === 'record_saved' || step === 'goodbye') {
        await telnyxCommand(callControlId, 'hangup', {});
      }
      break;
    }

    case 'call.playback.ended': {
      const step = state.step;
      console.log(`[IVR] Playback ended — step: ${step}`);

      if (step === 'record_announcement_playing') {
        // Custom record announcement finished — start recording
        await telnyxCommand(callControlId, 'record_start', {
          format: 'mp3',
          channels: 'single',
          play_beep: true,
          max_length: 300,
          timeout_secs: 5,
          client_state: encodeState({ mode: 'inbound_ivr', step: 'recording', callerPhone }),
        });
      } else if (step === 'playing_broadcast') {
        // Broadcast audio finished — check if there's another one
        const idx = (state.broadcastIndex || 0) + 1;
        const total = state.totalBroadcasts || 0;

        if (idx < total) {
          // Re-fetch playlist for next broadcast
          try {
            const playlist = await fetchPlaylist(base44);
            if (idx < playlist.length) {
              await telnyxCommand(callControlId, 'speak', {
                payload: `Next broadcast, from ${playlist[idx].date}.`,
                voice: 'female',
                language: 'en-US',
                client_state: encodeState({
                  mode: 'inbound_ivr',
                  step: 'announce_broadcast',
                  callerPhone,
                  broadcastIndex: idx,
                  totalBroadcasts: playlist.length,
                }),
              });
            } else {
              await telnyxCommand(callControlId, 'speak', {
                payload: 'That was the last broadcast. Goodbye.',
                voice: 'female',
                language: 'en-US',
                client_state: encodeState({ mode: 'inbound_ivr', step: 'goodbye', callerPhone }),
              });
            }
          } catch (err) {
            console.error('[IVR] Error fetching next broadcast:', err);
            await telnyxCommand(callControlId, 'hangup', {});
          }
        } else {
          await telnyxCommand(callControlId, 'speak', {
            payload: 'That was the last broadcast. Goodbye.',
            voice: 'female',
            language: 'en-US',
            client_state: encodeState({ mode: 'inbound_ivr', step: 'goodbye', callerPhone }),
          });
        }
      } else {
        // Ignore playback events from gather_using_audio or other internal playback
        console.log(`[IVR] Ignoring playback ended for step: ${step} (likely from gather_using_audio)`);
      }
      break;
    }

    case 'call.recording.saved': {
      const callLegId = payload?.call_leg_id || '';
      // Use the recording proxy for permanent playback URLs (Telnyx URLs expire after 10 minutes)
      const proxyRecordingUrl = callLegId
        ? `https://telnyx-webhook-proxy2.vercel.app/api/recording?leg=${callLegId}`
        : '';
      console.log(`[IVR] Recording saved — call_leg_id: ${callLegId}, proxy URL: ${proxyRecordingUrl}`);
      if (proxyRecordingUrl) {
        try {
          await base44.asServiceRole.entities.InboundMessage.create({
            caller_phone: callerPhone,
            recording_url: proxyRecordingUrl,
            status: 'new',
          });
          console.log('[IVR] InboundMessage created with proxy URL');
        } catch (err) {
          console.error('[IVR] Error saving inbound message:', err);
        }
      }
      await telnyxCommand(callControlId, 'speak', {
        payload: 'Thank you. Your message has been received. Goodbye.',
        voice: 'female',
        language: 'en-US',
        client_state: encodeState({ mode: 'inbound_ivr', step: 'record_saved', callerPhone }),
      });
      break;
    }

    case 'call.hangup': {
      console.log(`[IVR] Inbound call from ${callerPhone} ended`);

      // Log inbound call to CallReport so it appears in Base44 app
      try {
        const hangupCause = payload?.hangup_cause || 'unknown';
        const startTime = payload?.start_time ? new Date(payload.start_time) : null;
        const endTime = payload?.end_time ? new Date(payload.end_time) : null;
        const durationSeconds = startTime && endTime
          ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
          : 0;

        let callStatus = 'failed';
        if (hangupCause === 'normal_clearing' || hangupCause === 'originator_cancel') {
          callStatus = durationSeconds > 0 ? 'answered' : 'no_answer';
        } else if (hangupCause === 'user_busy') {
          callStatus = 'busy';
        } else if (['no_answer', 'timeout', 'call_rejected'].includes(hangupCause)) {
          callStatus = 'no_answer';
        }

        await base44.asServiceRole.entities.CallReport.create({
          broadcast_id: '',
          contact_name: callerPhone,
          phone_number: callerPhone,
          call_status: callStatus,
          duration_seconds: durationSeconds,
          called_at: startTime ? startTime.toISOString() : new Date().toISOString(),
          created_by: 'inbound',
          direction: 'incoming',
        });
        console.log(`[IVR] Inbound CallReport created for ${callerPhone}`);
      } catch (err) {
        console.error('[IVR] Error creating inbound CallReport:', err);
      }
      break;
    }

    default:
      console.log(`[IVR] Unhandled inbound event: ${eventType}`);
      break;
  }
}

// =============================================
// OUTBOUND BROADCAST HANDLER
// =============================================
async function handleOutbound(eventType, payload, callControlId, state, base44) {
  const { broadcastId, contactName, phone, audioUrl, createdBy } = state;

  switch (eventType) {
    case 'call.initiated':
      break;

    case 'call.answered': {
      if (audioUrl) {
        await telnyxCommand(callControlId, 'playback_start', {
          audio_url: audioUrl,
          client_state: encodeState(state),
        });
      } else {
        await telnyxCommand(callControlId, 'speak', {
          payload: 'You have a new voice broadcast from VoiceCast. Please check the system for details.',
          voice: 'female',
          language: 'en-US',
          client_state: encodeState(state),
        });
      }
      break;
    }

    case 'call.playback.ended':
    case 'call.speak.ended': {
      await telnyxCommand(callControlId, 'hangup', {});
      break;
    }

    case 'call.hangup': {
      if (!broadcastId || !phone) break;

      const hangupCause = payload?.hangup_cause || 'unknown';
      const startTime = payload?.start_time ? new Date(payload.start_time) : null;
      const endTime = payload?.end_time ? new Date(payload.end_time) : null;
      const durationSeconds = startTime && endTime
        ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
        : 0;

      let callStatus = 'failed';
      if (hangupCause === 'normal_clearing' || hangupCause === 'originator_cancel') {
        callStatus = durationSeconds > 0 ? 'answered' : 'no_answer';
      } else if (hangupCause === 'user_busy') {
        callStatus = 'busy';
      } else if (['no_answer', 'timeout', 'call_rejected'].includes(hangupCause)) {
        callStatus = 'no_answer';
      }

      const reports = await base44.asServiceRole.entities.CallReport.filter({
        broadcast_id: broadcastId,
        phone_number: phone,
      });

      if (reports.length > 0) {
        await base44.asServiceRole.entities.CallReport.update(reports[0].id, {
          call_status: callStatus,
          duration_seconds: durationSeconds,
        });
      } else {
        await base44.asServiceRole.entities.CallReport.create({
          broadcast_id: broadcastId,
          contact_name: contactName || '',
          phone_number: phone,
          call_status: callStatus,
          duration_seconds: durationSeconds,
          called_at: new Date().toISOString(),
          created_by: createdBy || '',
        });
      }

      const allReports = await base44.asServiceRole.entities.CallReport.filter({
        broadcast_id: broadcastId,
      });

      const delivered = allReports.filter((r) => r.call_status === 'answered').length;
      const failed = allReports.filter((r) =>
        ['no_answer', 'busy', 'failed'].includes(r.call_status)
      ).length;
      const initiated = allReports.filter((r) => r.call_status === 'initiated').length;

      const updateData = { delivered, failed, pending: Math.max(0, allReports.length - delivered - failed) };

      if (initiated === 0 && updateData.pending === 0 && (delivered + failed) > 0) {
        updateData.status = 'completed';
      }

      await base44.asServiceRole.entities.Broadcast.update(broadcastId, updateData);
      break;
    }

    default:
      console.log(`[OUT] Unhandled outbound event: ${eventType}`);
      break;
  }
}

// =============================================
// MAIN HANDLER
// =============================================
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let event;
  try {
    event = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event?.data?.event_type || event?.event_type;
  const payload = event?.data?.payload || event?.payload || {};
  const callControlId = payload?.call_control_id;
  const state = decodeState(payload?.client_state);
  const direction = payload?.direction;

  console.log(`[EVENT] ${eventType} | direction: ${direction || 'n/a'} | mode: ${state.mode || 'outbound'} | step: ${state.step || 'none'}`);

  try {
    if (direction === 'incoming' || state.mode === 'inbound_ivr') {
      await handleInbound(eventType, payload, callControlId, state, base44);
    } else {
      await handleOutbound(eventType, payload, callControlId, state, base44);
    }
  } catch (err) {
    console.error('callEventHandler error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }

  return Response.json({ ok: true, event: eventType });
});
