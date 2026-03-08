import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.text();
  const params = new URLSearchParams(body);

  // Telnyx posts recording_url (snake_case) after recording completes
  const recordingUrl = params.get('recording_url') || params.get('RecordingUrl');
  const callerPhone = params.get('From') || params.get('Caller') || 'Unknown';

  if (recordingUrl) {
    await base44.asServiceRole.entities.InboundMessage.create({
      caller_phone: callerPhone,
      recording_url: recordingUrl,
      status: 'new',
    });

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you. Your message has been received. Goodbye.</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Initial prompt
  const selfUrl = req.url.split('?')[0];
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Please record your message after the tone. Press pound when you are finished.</Say>
  <Record action="${selfUrl}" method="POST" maxLength="300" finishOnKey="#" playBeep="true"/>
  <Say voice="Polly.Joanna">We did not receive a recording. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
});