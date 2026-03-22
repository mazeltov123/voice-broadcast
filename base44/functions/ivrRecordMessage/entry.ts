import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.text();
  const params = new URLSearchParams(body);

  const recordingUrl = params.get('recording_url') || params.get('RecordingUrl');
  const callerPhone = params.get('From') || params.get('Caller') || params.get('from') || 'Unknown';

  if (recordingUrl) {
    await base44.asServiceRole.entities.InboundMessage.create({
      caller_phone: callerPhone,
      recording_url: recordingUrl,
      status: 'new',
    });

    const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you. Your message has been received. Goodbye.</Say>
  <Hangup/>
</Response>`;
    return new Response(texml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Load announcement MP3
  const settings = await base44.asServiceRole.entities.IvrSettings.list();
  const announcementUrl = settings[0]?.record_announcement_url || '';

  const appId = Deno.env.get('BASE44_APP_ID');
  const selfUrl = `https://api.base44.app/api/apps/${appId}/functions/ivrRecordMessage`;

  let announcementXml = '';
  if (announcementUrl) {
    announcementXml = `<Play>${announcementUrl}</Play>`;
  } else {
    announcementXml = `<Say>Please record your message after the tone. Press pound when you are finished.</Say>`;
  }

  const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${announcementXml}
  <Record action="${selfUrl}" method="POST" maxLength="300" finishOnKey="#" playBeep="true"/>
  <Say>We did not receive a recording. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new Response(texml, { headers: { 'Content-Type': 'text/xml' } });
});