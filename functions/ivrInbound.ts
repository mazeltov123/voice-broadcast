Deno.serve(async (req) => {
  const baseUrl = req.url.replace(/\/[^\/]*(\?.*)?$/, '/');

  const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${baseUrl}ivrHandleMenu" method="POST">
    <Say>Welcome to Voice Cast. Press 1 to listen to previous broadcasts. Press 2 to record and send a new message.</Say>
  </Gather>
  <Say>We did not receive your input. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new Response(texml, {
    headers: { 'Content-Type': 'text/xml' }
  });
});