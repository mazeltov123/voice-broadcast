import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

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
  } else {
    inner += `  <Say>You have ${broadcasts.length} broadcast${broadcasts.length !== 1 ? 's' : ''} from the past year. Playing most recent first.</Say>\n`;

    for (const broadcast of broadcasts) {
      const date = new Date(broadcast.scheduled_at || broadcast.created_date);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
      });

      inner += `  <Say>Broadcast from ${dateStr}.</Say>\n`;

      const audioFile = audioMap[broadcast.audio_file_id];
      if (audioFile?.file_url) {
        inner += `  <Play>${audioFile.file_url}</Play>\n`;
      } else {
        inner += `  <Say>Audio is not available for this broadcast.</Say>\n`;
      }

      inner += `  <Pause length="1"/>\n`;
    }

    inner += `  <Say>You have reached the end of all broadcasts. Goodbye.</Say>\n  <Hangup/>`;
  }

  const texml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${inner}\n</Response>`;

  return new Response(texml, {
    headers: { 'Content-Type': 'text/xml' }
  });
});