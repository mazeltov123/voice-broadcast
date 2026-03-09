import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');
const TELNYX_CONNECTION_ID = Deno.env.get('TELNYX_CONNECTION_ID');
const TELNYX_FROM_NUMBER = Deno.env.get('TELNYX_FROM_NUMBER');

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { to } = await req.json();

  if (!to) {
    return Response.json({ error: 'Missing required field: to (phone number)' }, { status: 400 });
  }

  const appId = Deno.env.get('BASE44_APP_ID');
  const webhookUrl = `https://api.base44.com/api/apps/${appId}/functions/callEventHandler`;

  const body = {
    connection_id: TELNYX_CONNECTION_ID,
    to,
    from: TELNYX_FROM_NUMBER,
    webhook_url: webhookUrl,
    webhook_url_method: 'POST',
  };

  const res = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return Response.json({ success: false, error: data }, { status: res.status });
  }

  return Response.json({
    success: true,
    call_control_id: data.data?.call_control_id,
    call_leg_id: data.data?.call_leg_id,
    message: `Test call initiated to ${to}`,
  });
});