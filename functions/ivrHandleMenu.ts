Deno.serve(async (req) => {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const digit = params.get('Digits');

  const baseUrl = req.url.replace(/\/[^\/]*(\?.*)?$/, '/');

  if (digit === '1') {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${baseUrl}ivrPlayBroadcasts</Redirect>
</Response>`;
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  if (digit === '2') {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${baseUrl}ivrRecordMessage</Redirect>
</Response>`;
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Invalid selection. Goodbye.</Say>
  <Hangup/>
</Response>`;
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
});