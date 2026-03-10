import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const data = payload?.data?.payload;
    if (!data) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Only handle inbound messages
    if (payload?.data?.event_type !== 'message.received') {
      return Response.json({ received: true });
    }

    const fromNumber = data.from?.phone_number || '';
    const toNumber = data.to?.[0]?.phone_number || '';
    const body = data.text || '';
    const telnyxMessageId = data.id || '';

    // Try to match sender to a contact
    let senderName = '';
    const contacts = await base44.asServiceRole.entities.Contact.filter({ phone_number: fromNumber });
    if (contacts.length > 0) {
      const c = contacts[0];
      senderName = [c.first_name, c.last_name].filter(Boolean).join(' ');
    }

    await base44.asServiceRole.entities.InboundSms.create({
      from_number: fromNumber,
      to_number: toNumber,
      body,
      sender_name: senderName,
      telnyx_message_id: telnyxMessageId,
      status: 'new',
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});