import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');
const TELNYX_FROM_NUMBER = Deno.env.get('TELNYX_FROM_NUMBER');
const TELNYX_CONNECTION_ID = Deno.env.get('TELNYX_CONNECTION_ID');
const APP_ID = Deno.env.get('BASE44_APP_ID');

async function makeVoiceCall(to) {
  const ivrUrl = `https://api.base44.app/api/apps/${APP_ID}/functions/ivrInbound`;
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
      webhook_url: ivrUrl,
    }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { contactIds } = await req.json();
  if (!contactIds || contactIds.length === 0) {
    return Response.json({ error: 'No contacts provided' }, { status: 400 });
  }

  const results = { calls_made: 0, errors: 0, details: [] };

  for (const contactId of contactIds) {
    const contact = await base44.asServiceRole.entities.Contact.get(contactId);
    if (!contact || !contact.phone_number) {
      results.errors++;
      continue;
    }
    const { ok, data } = await makeVoiceCall(contact.phone_number);
    if (ok) {
      results.calls_made++;
    } else {
      results.errors++;
    }
    results.details.push({ contact: `${contact.first_name} ${contact.last_name}`, phone: contact.phone_number, success: ok });
  }

  return Response.json({ success: true, ...results });
});