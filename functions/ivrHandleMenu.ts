Deno.serve(async (req) => {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const digit = params.get('Digits') || params.get('digit');

  const baseUrl = req.url.replace(/\/[^\/]*(\?.*)?$/, '/');

  if (digit === '1') {
    const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${baseUrl}ivrPlayBroadcasts</Redirect>
</Response>`;
    return new Response(texml, { headers: { 'Content-Type': 'text/xml' } });
  }

  if (digit === '2') {
    const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${baseUrl}ivrRecordMessage</Redirect>
</Response>`;
    return new Response(texml, { headers: { 'Content-Type': 'text/xml' } });
  }

  const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Invalid selection. Goodbye.</Say>
  <Hangup/>
</Response>`;
  return new Response(texml, { headers: { 'Content-Type': 'text/xml' } });
});