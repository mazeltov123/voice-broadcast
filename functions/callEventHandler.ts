import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');

async function telnyxCommand(callControlId, action, body = {}) {
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
    console.error(`Telnyx ${action} error:`, await res.text());
  }
  return res.ok;
}

function decodeClientState(encoded) {
  if (!encoded) return {};
  try {
    return JSON.parse(atob(encoded));
  } catch {
    return {};
  }
}

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
  const clientState = decodeClientState(payload?.client_state);

  const { broadcastId, contactName, phone, audioUrl, createdBy } = clientState;

  console.log(`Call event: ${eventType} | phone: ${phone} | broadcast: ${broadcastId}`);

  try {
    switch (eventType) {
      case 'call.initiated':
        break;

      case 'call.answered': {
        if (audioUrl) {
          const newClientState = btoa(JSON.stringify(clientState));
          await telnyxCommand(callControlId, 'playback_start', {
            audio_url: audioUrl,
            client_state: newClientState,
          });
        } else {
          const newClientState = btoa(JSON.stringify(clientState));
          await telnyxCommand(callControlId, 'speak', {
            payload: 'You have a new voice broadcast from VoiceCast. Please check the system for details.',
            voice: 'female',
            language: 'en-US',
            client_state: newClientState,
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
        } else if (hangupCause === 'no_answer' || hangupCause === 'timeout') {
          callStatus = 'no_answer';
        } else if (hangupCause === 'call_rejected') {
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

        const updateData = { delivered, failed, pending: Math.max(0, allReports.length - delivered - failed) };

        const initiated = allReports.filter((r) => r.call_status === 'initiated').length;
        if (initiated === 0 && updateData.pending === 0 && (delivered + failed) > 0) {
          updateData.status = 'completed';
        }

        await base44.asServiceRole.entities.Broadcast.update(broadcastId, updateData);
        break;
      }

      default:
        console.log(`Unhandled event type: ${eventType}`);
        break;
    }
  } catch (err) {
    console.error('callEventHandler error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }

  return Response.json({ ok: true, event: eventType });
});