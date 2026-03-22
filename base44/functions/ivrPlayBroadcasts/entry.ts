import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const appId = Deno.env.get('BASE44_APP_ID');
  const baseUrl = `https://api.base44.app/api/apps/${appId}/functions/ivrPlayBroadcasts`;

  const url = new URL(req.url);
  let index = parseInt(url.searchParams.get('index') || '0', 10);

  // Read digit from POST body if present
  let digit = '';
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      digit = body?.data?.payload?.digit || body?.digit || '';
    } catch (_) {}
  }

  // # = go back, anything else = already at next index (set by caller)
  // When gather posts here with index=N+1, if digit is # we go to N-1 instead
  if (digit === '#') {
    // Go back two (since index was already advanced by the action URL)
    index = Math.max(0, index - 2);
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const allBroadcasts = await base44.asServiceRole.entities.Broadcast.list('-created_date', 100);
  const broadcasts = allBroadcasts.filter(b =>
    b.status === 'completed' &&
    new Date(b.created_date) >= oneYearAgo
  );

  const audioFiles = await base44.asServiceRole.entities.AudioFile.list();
  const audioMap = Object.fromEntries(audioFiles.map(a => [a.id, a]));

  let inner = '';

  if (broadcasts.length === 0) {
    inner = `  <Say>There are no broadcasts available from the past year. Goodbye.</Say>\n  <Hangup/>`;
  } else if (index >= broadcasts.length) {
    inner = `  <Say>You have reached the end of all broadcasts. Goodbye.</Say>\n  <Hangup/>`;
  } else {
    const broadcast = broadcasts[index];
    const isFirst = index === 0;
    const isLast = index === broadcasts.length - 1;

    const date = new Date(broadcast.scheduled_at || broadcast.created_date);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
    });

    if (index === 0) {
      inner += `  <Say>You have ${broadcasts.length} broadcast${broadcasts.length !== 1 ? 's' : ''} from the past year. Playing most recent first.</Say>\n`;
    }

    inner += `  <Say>Broadcast ${index + 1} of ${broadcasts.length}, from ${dateStr}.</Say>\n`;

    const audioFile = audioMap[broadcast.audio_file_id];
    if (audioFile?.file_url) {
      inner += `  <Play>${audioFile.file_url}</Play>\n`;
    } else {
      inner += `  <Say>Audio is not available for this broadcast.</Say>\n`;
    }

    const nextUrl = `${baseUrl}?index=${index + 1}`;

    if (!isLast) {
      let hint = 'Press any key to play the next message.';
      if (!isFirst) hint += ' Press pound to go back.';

      inner += `  <Gather action="${nextUrl}" method="POST" numDigits="1" timeout="5" finishOnKey="">\n`;
      inner += `    <Say>${hint}</Say>\n`;
      inner += `  </Gather>\n`;
      // Timeout: auto-advance
      inner += `  <Redirect method="GET">${nextUrl}</Redirect>\n`;
    } else {
      let hint = 'This is the last broadcast.';
      if (!isFirst) hint += ' Press pound to go back, or hang up.';

      inner += `  <Gather action="${nextUrl}" method="POST" numDigits="1" timeout="8" finishOnKey="">\n`;
      inner += `    <Say>${hint}</Say>\n`;
      inner += `  </Gather>\n`;
      inner += `  <Say>Goodbye.</Say>\n  <Hangup/>`;
    }
  }

  const texml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${inner}\n</Response>`;

  return new Response(texml, {
    headers: { 'Content-Type': 'text/xml' }
  });
});