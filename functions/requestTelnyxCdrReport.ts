import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Step 1: Request a CDR report from Telnyx (async - they generate a CSV file)
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
  if (!TELNYX_API_KEY) return Response.json({ error: "TELNYX_API_KEY not set" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const startTime = body.start_time || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const endTime = body.end_time || new Date().toISOString();

  const payload = {
    start_time: startTime,
    end_time: endTime,
    call_types: [1, 2], // 1=inbound, 2=outbound
    record_types: [1],  // 1=complete calls only
    report_name: `VoiceCast Import ${new Date().toLocaleDateString()}`,
    include_all_metadata: true,
  };

  const res = await fetch("https://api.telnyx.com/v2/legacy_reporting/batch_detail_records/voice", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `Telnyx error: ${res.status}`, details: err }, { status: 502 });
  }

  const data = await res.json();
  return Response.json({ report: data.data });
});