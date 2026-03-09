Deno.serve(async (req) => {
  const appId = Deno.env.get('BASE44_APP_ID');
  const handleMenuUrl = `https://api.base44.app/api/apps/${appId}/functions/ivrHandleMenu`;

  const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${handleMenuUrl}" method="POST">
    <Say>Welcome to Voice Cast. Press 1 to listen to previous broadcasts. Press 2 to record and send a new message.</Say>
  </Gather>
  <Say>We did not receive your input. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new Response(texml, {
    headers: { 'Content-Type': 'text/xml' }
  });
});