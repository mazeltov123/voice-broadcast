import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Step 2: Check status and get report_url when ready
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
  if (!TELNYX_API_KEY) return Response.json({ error: "TELNYX_API_KEY not set" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const reportId = body.report_id;
  if (!reportId) return Response.json({ error: "report_id required" }, { status: 400 });

  const res = await fetch(`https://api.telnyx.com/v2/legacy_reporting/batch_detail_records/voice/${reportId}`, {
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `Telnyx error: ${res.status}`, details: err }, { status: 502 });
  }

  const data = await res.json();
  return Response.json({ report: data.data });
});