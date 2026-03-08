import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.text();
  const params = new URLSearchParams(body);
  const recordingUrl = params.get('RecordingUrl');
  const callerPhone = params.get('From') || params.get('Caller') || 'Unknown';

  // If Twilio is posting back with a recording, save it
  if (recordingUrl) {
    await base44.asServiceRole.entities.InboundMessage.create({
      caller_phone: callerPhone,
      recording_url: recordingUrl,
      status: 'new',
    });

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you. Your message has been received. Goodbye.</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Initial prompt — ask caller to record
  const selfUrl = req.url.split('?')[0];
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please record your message after the tone. Press pound when you are finished.</Say>
  <Record action="${selfUrl}" method="POST" maxLength="300" finishOnKey="#" playBeep="true"/>
  <Say voice="alice">We did not receive a recording. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
});