import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');
const TELNYX_MESSAGING_PROFILE_ID = Deno.env.get('TELNYX_MESSAGING_PROFILE_ID');
const TELNYX_FROM_NUMBER = Deno.env.get('TELNYX_FROM_NUMBER');
const TELNYX_CONNECTION_ID = Deno.env.get('TELNYX_CONNECTION_ID');

async function sendSMS(to, text) {
  console.log(`[SMS] Sending to ${to}...`);
  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: TELNYX_FROM_NUMBER,
      to,
      text,
      messaging_profile_id: TELNYX_MESSAGING_PROFILE_ID,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[SMS] Error for ${to}:`, err);
  } else {
    console.log(`[SMS] Sent OK to ${to}`);
  }
  return res.ok;
}

async function makeVoiceCall(to, audioUrl, broadcastId, contactName, createdBy) {
  const appId = Deno.env.get('BASE44_APP_ID');
  const webhookUrl = `https://api.base44.app/api/apps/${appId}/functions/callEventHandler`;

  console.log(`[CALL] Calling ${to} via connection ${TELNYX_CONNECTION_ID}...`);
  console.log(`[CALL] Webhook URL: ${webhookUrl}`);
  console.log(`[CALL] Audio URL: ${audioUrl}`);

  const clientState = btoa(JSON.stringify({
    broadcastId,
    contactName,
    phone: to,
    audioUrl,
    createdBy,
  }));

  const body = {
    connection_id: TELNYX_CONNECTION_ID,
    to,
    from: TELNYX_FROM_NUMBER,
    webhook_url: webhookUrl,
    webhook_url_method: 'POST',
    client_state: clientState,
  };

  console.log(`[CALL] Request body:`, JSON.stringify(body));

  const res = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  console.log(`[CALL] Response status: ${res.status}`);
  console.log(`[CALL] Response body: ${responseText}`);

  return res.ok;
}

Deno.serve(async (req) => {
  console.log('[START] sendBroadcastNotification invoked');

  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  console.log('[AUTH] User:', user ? user.email : 'NOT AUTHENTICATED');

  if (!user) {
    console.error('[AUTH] No user - returning 401');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    console.error('[PARSE] Failed to parse request body:', e.message);
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { broadcastId, broadcastName, targetGroups } = payload;
  console.log(`[INPUT] broadcastId=${broadcastId}, broadcastName=${broadcastName}, targetGroups=${JSON.stringify(targetGroups)}`);

  // Check env vars
  console.log(`[ENV] TELNYX_API_KEY: ${TELNYX_API_KEY ? 'SET (' + TELNYX_API_KEY.substring(0, 8) + '...)' : 'MISSING'}`);
  console.log(`[ENV] TELNYX_CONNECTION_ID: ${TELNYX_CONNECTION_ID || 'MISSING'}`);
  console.log(`[ENV] TELNYX_FROM_NUMBER: ${TELNYX_FROM_NUMBER || 'MISSING'}`);
  console.log(`[ENV] TELNYX_MESSAGING_PROFILE_ID: ${TELNYX_MESSAGING_PROFILE_ID || 'MISSING'}`);

  // Get the broadcast
  let broadcast;
  try {
    const allBroadcasts = await base44.asServiceRole.entities.Broadcast.list('-created_date', 100);
    console.log(`[DB] Found ${allBroadcasts.length} total broadcasts`);
    broadcast = allBroadcasts.find(b => b.id === broadcastId);
    if (!broadcast) {
      console.error(`[DB] Broadcast ${broadcastId} not found in list. Available IDs: ${allBroadcasts.map(b => b.id).join(', ')}`);
      return Response.json({ error: 'Broadcast not found' }, { status: 404 });
    }
    console.log(`[DB] Found broadcast: ${broadcast.name}, audio_file_id=${broadcast.audio_file_id}`);
  } catch (e) {
    console.error('[DB] Error fetching broadcasts:', e.message);
    return Response.json({ error: 'DB error: ' + e.message }, { status: 500 });
  }

  // Get audio file
  let audioUrl = '';
  if (broadcast.audio_file_id) {
    try {
      const audioFiles = await base44.asServiceRole.entities.AudioFile.list();
      console.log(`[DB] Found ${audioFiles.length} audio files`);
      const audioFile = audioFiles.find((a) => a.id === broadcast.audio_file_id);
      audioUrl = audioFile?.file_url || '';
      console.log(`[DB] Audio URL: ${audioUrl || 'NONE'}`);
    } catch (e) {
      console.error('[DB] Error fetching audio files:', e.message);
    }
  } else {
    console.log('[DB] No audio_file_id on broadcast');
  }

  // Update broadcast status
  try {
    await base44.asServiceRole.entities.Broadcast.update(broadcastId, { status: 'in_progress' });
    console.log('[DB] Updated broadcast status to in_progress');
  } catch (e) {
    console.error('[DB] Error updating broadcast status:', e.message);
  }

  // Get recipients
  let recipients;
  try {
    const allContacts = await base44.asServiceRole.entities.Contact.filter({ status: 'active' });
    console.log(`[DB] Found ${allContacts.length} active contacts`);
    recipients = allContacts;
    if (targetGroups && targetGroups.length > 0) {
      recipients = allContacts.filter((c) =>
        (c.groups || []).some((g) => targetGroups.includes(g))
      );
      console.log(`[DB] Filtered to ${recipients.length} recipients by target groups`);
    }
  } catch (e) {
    console.error('[DB] Error fetching contacts:', e.message);
    return Response.json({ error: 'DB error: ' + e.message }, { status: 500 });
  }

  if (recipients.length === 0) {
    console.log('[DONE] No recipients found');
    return Response.json({ success: true, recipients: 0, sms_sent: 0, calls_made: 0, errors: 0 });
  }

  const callsPerMinute = broadcast.calls_per_minute || 10;
  const isThrottled = broadcast.throttle_mode === 'throttled';
  const delayMs = isThrottled ? Math.floor(60000 / callsPerMinute) : 200;

  const results = { sms_sent: 0, calls_made: 0, errors: 0 };

  for (const contact of recipients) {
    const phone = contact.phone_number;
    if (!phone) {
      console.log(`[SKIP] Contact ${contact.first_name} has no phone number`);
      continue;
    }

    const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'there';
    console.log(`[PROCESS] Contact: ${name} (${phone})`);

    const smsText = `Hi ${name}, a new broadcast "${broadcastName}" has been created on VoiceCast. Stay tuned!`;
    const smsSent = await sendSMS(phone, smsText);
    if (smsSent) results.sms_sent++;

    if (audioUrl) {
      const callMade = await makeVoiceCall(phone, audioUrl, broadcastId, name, user.email);
      if (callMade) {
        results.calls_made++;
        await base44.asServiceRole.entities.CallReport.create({
          broadcast_id: broadcastId,
          contact_name: name,
          phone_number: phone,
          call_status: 'initiated',
          duration_seconds: 0,
          called_at: new Date().toISOString(),
          created_by: user.email,
        });
        console.log(`[CALL] CallReport created for ${phone}`);
      } else {
        results.errors++;
        await base44.asServiceRole.entities.CallReport.create({
          broadcast_id: broadcastId,
          contact_name: name,
          phone_number: phone,
          call_status: 'failed',
          duration_seconds: 0,
          called_at: new Date().toISOString(),
          created_by: user.email,
        });
        console.log(`[CALL] FAILED for ${phone}`);
      }
    } else {
      console.log(`[SKIP] No audio URL, skipping call to ${phone}`);
    }

    if (delayMs > 0 && recipients.indexOf(contact) < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[DONE] Results: ${JSON.stringify(results)}`);
  return Response.json({ success: true, recipients: recipients.length, ...results });
});
