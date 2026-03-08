import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const baseUrl = req.url.replace(/\/[^\/]*(\?.*)?$/, '/');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${baseUrl}ivrHandleMenu" method="POST">
    <Say voice="alice">Welcome. Press 1 to listen to previous broadcasts. Press 2 to record and send a new message.</Say>
  </Gather>
  <Say voice="alice">We did not receive your input. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' }
  });
});