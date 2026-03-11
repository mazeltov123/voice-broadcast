import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');
const TELNYX_MESSAGING_PROFILE_ID = Deno.env.get('TELNYX_MESSAGING_PROFILE_ID');
const TELNYX_FROM_NUMBER_RAW = Deno.env.get('TELNYX_FROM_NUMBER');
const TELNYX_CONNECTION_ID = Deno.env.get('TELNYX_CONNECTION_ID');

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return '+1' + cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return '+' + cleaned;
  return '+' + cleaned;
}

const TELNYX_FROM_NUMBER = normalizePhone(TELNYX_FROM_NUMBER_RAW);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendSMS(to, text) {
  if (!TELNYX_MESSAGING_PROFILE_ID) return false;
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
    console.error(`[SMS] Error for ${to}:`, await res.text());
  }
  return res.ok;
}

async function makeVoiceCall(to, audioUrl, broadcastId, contactName, createdBy) {
  const appId = Deno.env.get('BASE44_APP_ID');
  const webhookUrl = `https://api.base44.app/api/apps/${appId}/functions/callEventHandler`;

  const clientState = btoa(JSON.stringify({
    broadcastId,
    contactName,
    phone: to,
    audioUrl,
    createdBy,
  }));

  const res = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connection_id: TELNYX_CONNECTION_ID,
      to,
      from: TELNYX_FROM_NUMBER,
      webhook_url: webhookUrl,
      webhook_url_method: 'POST',
      client_state: clientState,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[CALL] Error for ${to}:`, errText);
    if (errText.includes('90041') || errText.includes('channel limit')) {
      return 'channel_limit';
    }
    return 'failed';
  }
  console.log(`[CALL] OK for ${to}`);
  return 'ok';
}

Deno.serve(async (req) => {
  console.log('[START] sendBroadcastNotification invoked');

  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { broadcastId, broadcastName, targetGroups } = await req.json();

  const broadcasts = await base44.asServiceRole.entities.Broadcast.filter({ id: broadcastId });
  const broadcast = broadcasts[0];
  if (!broadcast) {
    return Response.json({ error: 'Broadcast not found' }, { status: 404 });
  }

  let audioUrl = '';
  if (broadcast.audio_file_id) {
    const audioFiles = await base44.asServiceRole.entities.AudioFile.list();
    const audioFile = audioFiles.find((a) => a.id === broadcast.audio_file_id);
    audioUrl = audioFile?.file_url || '';
  }

  await base44.asServiceRole.entities.Broadcast.update(broadcastId, {
    status: 'in_progress',
  });

  const allContacts = await base44.asServiceRole.entities.Contact.filter({ status: 'active' });
  let recipients = allContacts;
  if (targetGroups && targetGroups.length > 0) {
    recipients = allContacts.filter((c) =>
      (c.groups || []).some((g) => targetGroups.includes(g))
    );
  }

  if (recipients.length === 0) {
    return Response.json({ success: true, recipients: 0, sms_sent: 0, calls_made: 0, errors: 0 });
  }

  // THROTTLE SETTINGS
  // 5 seconds between calls = max ~12 concurrent calls
  // If channel limit hit, wait 20 seconds for calls to finish
  const DELAY_BETWEEN_CALLS = 5000;
  const CHANNEL_LIMIT_WAIT = 20000;

  const results = { sms_sent: 0, calls_made: 0, errors: 0 };
  const retryQueue = [];

  console.log(`[BROADCAST] Starting ${recipients.length} contacts, ${DELAY_BETWEEN_CALLS / 1000}s between calls`);

  for (let i = 0; i < recipients.length; i++) {
    const contact = recipients[i];
    const rawPhone = contact.phone_number;
    if (!rawPhone) continue;

    const phone = normalizePhone(rawPhone);
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'there';
    console.log(`[PROCESS] ${i + 1}/${recipients.length} ${name}: ${phone}`);

    if (audioUrl) {
      const callResult = await makeVoiceCall(phone, audioUrl, broadcastId, name, user.email);

      if (callResult === 'ok') {
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
      } else if (callResult === 'channel_limit') {
        console.log(`[THROTTLE] Channel limit hit at #${i + 1}, waiting ${CHANNEL_LIMIT_WAIT / 1000}s...`);
        retryQueue.push({ phone, name });
        await sleep(CHANNEL_LIMIT_WAIT);
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
      }
    }

    // Wait between calls to avoid hitting channel limit
    if (i < recipients.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS);
    }
  }

  // Retry any calls that failed due to channel limit
  if (retryQueue.length > 0) {
    console.log(`[RETRY] Retrying ${retryQueue.length} channel-limited calls after 30s cooldown...`);
    await sleep(30000);

    for (let r = 0; r < retryQueue.length; r++) {
      const { phone, name } = retryQueue[r];
      console.log(`[RETRY] ${r + 1}/${retryQueue.length} ${name}: ${phone}`);

      const callResult = await makeVoiceCall(phone, audioUrl, broadcastId, name, user.email);

      if (callResult === 'ok') {
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
      }

      if (r < retryQueue.length - 1) {
        await sleep(DELAY_BETWEEN_CALLS);
      }
    }
  }

  console.log(`[DONE] Results: ${JSON.stringify(results)}`);
  return Response.json({
    success: true,
    recipients: recipients.length,
    ...results,
  });
});