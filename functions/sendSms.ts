import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { to, message } = await req.json();
    if (!to || !message) return Response.json({ error: 'Missing to or message' }, { status: 400 });

    const apiKey = Deno.env.get('TELNYX_API_KEY');
    const fromNumber = Deno.env.get('TELNYX_FROM_NUMBER');
    const messagingProfileId = Deno.env.get('TELNYX_MESSAGING_PROFILE_ID');

    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to,
        text: message,
        messaging_profile_id: messagingProfileId,
      }),
    });

    const data = await res.json();
    if (!res.ok) return Response.json({ error: data?.errors?.[0]?.detail || 'Failed to send SMS' }, { status: res.status });

    return Response.json({ success: true, message_id: data.data?.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});