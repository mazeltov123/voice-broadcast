Deno.serve(async (req) => {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const digit = params.get('Digits') || params.get('digit');

  const appId = Deno.env.get('BASE44_APP_ID');
  const playBroadcastsUrl = `https://api.base44.app/api/apps/${appId}/functions/ivrPlayBroadcasts`;
  const recordMessageUrl = `https://api.base44.app/api/apps/${appId}/functions/ivrRecordMessage`;

  if (digit === '1') {
    const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${playBroadcastsUrl}</Redirect>
</Response>`;
    return new Response(texml, { headers: { 'Content-Type': 'text/xml' } });
  }

  if (digit === '2') {
    const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${recordMessageUrl}</Redirect>
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