import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

async function telnyxGet(path, apiKey) {
  const res = await fetch(`${TELNYX_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Telnyx ${res.status}: ${JSON.stringify(json.errors || json)}`);
  return json;
}

async function telnyxPost(path, apiKey, body) {
  const res = await fetch(`${TELNYX_API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Telnyx ${res.status}: ${JSON.stringify(json.errors || json)}`);
  return json;
}

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = Deno.env.get("TELNYX_API_KEY");
  if (!apiKey) return Response.json({ error: "TELNYX_API_KEY not set" }, { status: 500 });

  const body = await req.json().catch(() => ({}));

  // Step 1: If a report_id is provided, check its status
  if (body.report_id) {
    const reportData = await telnyxGet(`/reporting/cdr_detailed_records/${body.report_id}`, apiKey);
    const report = reportData.data;
    // status: 1=pending, 2=complete, 3=failed
    if (report.status === 2 && report.report_url) {
      // Download and parse CSV
      const csvRes = await fetch(report.report_url);
      const csvText = await csvRes.text();
      const records = parseCsv(csvText);
      return Response.json({ status: "complete", records, report_url: report.report_url });
    }
    if (report.status === 3) return Response.json({ status: "failed" });
    return Response.json({ status: "pending" });
  }

  // Probe to find working endpoints
  if (body._probe_endpoint) {
    const path = body._probe_endpoint;
    const method = body._method || "GET";
    const probeBody = body._body;
    const url = `${TELNYX_API_BASE}${path}`;
    const opts = {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    };
    if (probeBody) opts.body = JSON.stringify(probeBody);
    const res = await fetch(url, opts);
    const text = await res.text();
    return Response.json({ status: res.status, body: text.slice(0, 2000) });
  }

  // Step 2: Create a new CDR report request
  // Default: last 90 days
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const callTypes = body.direction === "inbound" ? [1]
    : body.direction === "outbound" ? [2]
    : [1, 2];

  const reportRes = await telnyxPost("/reporting/cdr_detailed_records", apiKey, {
    start_time: body.start_time || startTime,
    end_time: body.end_time || endTime,
    call_types: callTypes,
    record_types: [1, 2],
    report_name: "VoiceCast Import",
    source: "calls",
    include_all_metadata: true,
  });

  const report = reportRes.data;
  return Response.json({ status: "pending", report_id: report.id });
  } catch (err) {
    console.error("importTelnyxCallLogs error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

function parseCsv(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}