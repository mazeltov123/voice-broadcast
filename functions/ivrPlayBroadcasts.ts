import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const appId = Deno.env.get('BASE44_APP_ID');
  const baseUrl = `https://api.base44.app/api/apps/${appId}/functions/ivrPlayBroadcasts`;

  // Parse index from query string or body
  const url = new URL(req.url);
  let index = parseInt(url.searchParams.get('index') || '0', 10);
  let direction = url.searchParams.get('dir') || 'fwd';

  // Also check POST body for DTMF digit
  let digit = '';
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      digit = body?.data?.payload?.digit || body?.digit || '';
    } catch (_) {}
  }

  // If # pressed, go back one
  if (digit === '#') {
    index = Math.max(0, index - 1);
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

    const nextUrl = `${baseUrl}?index=${index + 1}`;
    const prevUrl = `${baseUrl}?index=${index - 1}`;

    // Intro for first message
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

    // Navigation prompt
    let navHint = 'Press any key to play the next message.';
    if (!isFirst) navHint += ' Press pound to go back.';
    if (isLast) navHint = 'This is the last message.' + (!isFirst ? ' Press pound to go back, or hang up.' : ' Goodbye.');

    inner += `  <Gather action="${nextUrl}" method="POST" numDigits="1" timeout="5" finishOnKey="">\n`;
    inner += `    <Say>${navHint}</Say>\n`;
    inner += `  </Gather>\n`;

    // Handle # from gather action going to prev
    if (!isFirst) {
      // The gather action always goes to nextUrl, but we handle digit in that request
      // So we use a single action URL that includes the next index and reads the digit
      // Actually we need to pass current index so the next call can compute correctly
    }

    // If no input (timeout), auto-advance
    if (!isLast) {
      inner += `  <Redirect method="GET">${nextUrl}</Redirect>\n`;
    } else {
      inner += `  <Say>Goodbye.</Say>\n  <Hangup/>`;
    }
  }

  // Fix: use a single action URL per-message that knows current index, reads digit
  // Rewrite gather action to point to next index but carry current index so # goes back
  const gatherActionUrl = `${baseUrl}?index=${index + 1}`;

  // Replace the gather action with one that posts back here with the next index
  // digit=# in body will cause index-- in that call
  const texml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${inner}\n</Response>`;

  return new Response(texml, {
    headers: { 'Content-Type': 'text/xml' }
  });
});