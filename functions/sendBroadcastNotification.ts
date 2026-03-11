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
console.error(`[SMS] Error for ${to}:`, await res.text());
} else {
console.log(`[SMS] Sent OK to ${to}`);
}
return res.ok;
}

async function makeVoiceCall(to, audioUrl, broadcastId, contactName, createdBy) {
const appId = Deno.env.get('BASE44_APP_ID');
const webhookUrl = `https://api.base44.app/api/apps/${appId}/functions/callEventHandler`;

console.log(`[CALL] Calling ${to}...`);

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
} else {
console.log(`[CALL] OK for ${to}`);
}

return res.ok;
}
Deno.serve(async (req) => {
console.log('[START] sendBroadcastNotification invoked');
console.log(`[ENV] FROM: ${TELNYX_FROM_NUMBER_RAW} → ${TELNYX_FROM_NUMBER}`);

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

  await base44.asServiceRole.entities.Broadcast.update(broadcastId, { status: 'in_progress' });

  const allContacts = await base44.asServiceRole.entities.Contact.filter({ status: 'active' });
  let recipients = allContacts;

  if (broadcast.target_mode === 'contacts' && broadcast.target_contact_ids && broadcast.target_contact_ids.length > 0) {
    // Contacts mode: only send to explicitly selected contacts, ignore groups
    recipients = allContacts.filter((c) => broadcast.target_contact_ids.includes(c.id));
  } else if (targetGroups && targetGroups.length > 0) {
    // Groups mode: filter by groups
    recipients = allContacts.filter((c) =>
      (c.groups || []).some((g) => targetGroups.includes(g))
    );
  }

if (recipients.length === 0) {
return Response.json({ success: true, recipients: 0, sms_sent: 0, calls_made: 0, errors: 0 });
}

const callsPerMinute = broadcast.calls_per_minute || 10;
const isThrottled = broadcast.throttle_mode === 'throttled';
const delayMs = isThrottled ? Math.floor(60000 / callsPerMinute) : 200;

const results = { sms_sent: 0, calls_made: 0, errors: 0 };

for (const contact of recipients) {
const rawPhone = contact.phone_number;
if (!rawPhone) continue;

const phone = normalizePhone(rawPhone);
const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'there';
console.log(`[PROCESS] ${name}: ${rawPhone} → ${phone}`);

const shouldSendSms = broadcast.broadcast_type === 'sms_only' || broadcast.broadcast_type === 'both';
const shouldCall = (broadcast.broadcast_type === 'voice_only' || broadcast.broadcast_type === 'both') && audioUrl;

if (shouldSendSms && contact.sms_enabled !== false) {
  const smsText = broadcast.sms_message || `Hi ${name}, a new broadcast "${broadcastName}" has been sent on VoiceCast.`;
  const smsSent = await sendSMS(phone, smsText);
  if (smsSent) results.sms_sent++;
}

if (shouldCall) {
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

if (delayMs > 0 && recipients.indexOf(contact) < recipients.length - 1) {
await new Promise(resolve => setTimeout(resolve, delayMs));
}
}

console.log(`[DONE] Results: ${JSON.stringify(results)}`);
return Response.json({
success: true,
recipients: recipients.length,
...results,
});
});