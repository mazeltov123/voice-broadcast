import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const appId = Deno.env.get('BASE44_APP_ID');
  const handleMenuUrl = `https://api.base44.app/api/apps/${appId}/functions/ivrHandleMenu`;

  const base44 = createClientFromRequest(req);
  const settings = await base44.asServiceRole.entities.IvrSettings.list();
  const greetingUrl = settings[0]?.greeting_url || '';

  let greetingXml = '';
  if (greetingUrl) {
    greetingXml = `<Play>${greetingUrl}</Play>`;
  } else {
    greetingXml = `<Say>Welcome to Voice Cast. Press 1 to listen to previous broadcasts. Press 2 to record and send a new message.</Say>`;
  }

  const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${handleMenuUrl}" method="POST">
    ${greetingXml}
  </Gather>
  <Say>We did not receive your input. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new Response(texml, {
    headers: { 'Content-Type': 'text/xml' }
  });
});