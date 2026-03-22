const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');
const TELNYX_FROM_NUMBER = Deno.env.get('TELNYX_FROM_NUMBER');
const TELNYX_CONNECTION_ID = Deno.env.get('TELNYX_CONNECTION_ID');

Deno.serve(async (req) => {
  console.log('=== TEST TELNYX CALL ===');
  console.log('TELNYX_API_KEY:', TELNYX_API_KEY ? 'SET (' + TELNYX_API_KEY.substring(0, 10) + '...)' : 'MISSING');
  console.log('TELNYX_FROM_NUMBER:', TELNYX_FROM_NUMBER || 'MISSING');
  console.log('TELNYX_CONNECTION_ID:', TELNYX_CONNECTION_ID || 'MISSING');

  let toNumber;
  try {
    const body = await req.json();
    toNumber = body.to;
  } catch {
    toNumber = null;
  }

  if (!toNumber) {
    console.log('ERROR: No phone number provided');
    return Response.json({
      error: 'Provide a phone number in the payload like: {"to": "+1234567890"}',
      env_check: {
        api_key: TELNYX_API_KEY ? 'SET' : 'MISSING',
        from_number: TELNYX_FROM_NUMBER || 'MISSING',
        connection_id: TELNYX_CONNECTION_ID || 'MISSING',
      }
    });
  }

  console.log('Calling:', toNumber);

  const res = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connection_id: TELNYX_CONNECTION_ID,
      to: toNumber,
      from: TELNYX_FROM_NUMBER,
    }),
  });

  const responseText = await res.text();
  console.log('Telnyx status:', res.status);
  console.log('Telnyx response:', responseText);

  return Response.json({
    success: res.ok,
    status: res.status,
    telnyx_response: JSON.parse(responseText),
  });
});
