import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { recording_url } = await req.json();
    if (!recording_url) return Response.json({ error: 'Missing recording_url' }, { status: 400 });

    const apiKey = Deno.env.get("TELNYX_API_KEY");
    
    // Fetch the recording from Telnyx with auth
    const response = await fetch(recording_url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });

    if (!response.ok) {
      return Response.json({ error: `Failed to fetch recording: ${response.status}` }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "audio/mpeg";
    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.byteLength.toString(),
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});