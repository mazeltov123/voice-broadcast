import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');
const TELNYX_MESSAGING_PROFILE_ID = Deno.env.get('TELNYX_MESSAGING_PROFILE_ID');
const TELNYX_FROM_NUMBER = Deno.env.get('TELNYX_FROM_NUMBER');

async function sendSMS(to, text) {
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
  return res.ok;
}

async function makeVoiceCall(to, broadcastName) {
  // Use TeXML to say the broadcast name
  const webhookUrl = `https://api.telnyx.com/v2/texml/say?text=${encodeURIComponent(`You have a new voice broadcast: ${broadcastName}. Please check the VoiceCast system for details.`)}`;

  const res = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connection_id: TELNYX_FROM_NUMBER,
      to,
      from: TELNYX_FROM_NUMBER,
      webhook_url: webhookUrl,
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { broadcastId, broadcastName, targetGroups } = await req.json();

  // Fetch all active contacts
  const allContacts = await base44.asServiceRole.entities.Contact.filter({ status: 'active' });

  // Filter to target groups if specified, otherwise all active contacts
  let recipients = allContacts;
  if (targetGroups && targetGroups.length > 0) {
    recipients = allContacts.filter(c =>
      (c.groups || []).some(g => targetGroups.includes(g))
    );
  }

  const results = { sms_sent: 0, calls_made: 0, errors: 0 };

  for (const contact of recipients) {
    const phone = contact.phone_number;
    if (!phone) continue;

    const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'there';
    const smsText = `Hi ${name}, a new broadcast "${broadcastName}" has been created on VoiceCast. Stay tuned!`;

    const [smsSent, callMade] = await Promise.all([
      sendSMS(phone, smsText),
      makeVoiceCall(phone, broadcastName),
    ]);

    if (smsSent) results.sms_sent++;
    if (callMade) results.calls_made++;
    if (!smsSent || !callMade) results.errors++;
  }

  return Response.json({ success: true, recipients: recipients.length, ...results });
});