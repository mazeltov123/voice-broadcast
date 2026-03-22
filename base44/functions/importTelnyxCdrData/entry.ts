import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Step 3: Download the CSV from report_url and import records
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reportUrl = body.report_url;
  if (!reportUrl) return Response.json({ error: "report_url required" }, { status: 400 });

  // Download the CSV
  const csvRes = await fetch(reportUrl);
  if (!csvRes.ok) {
    return Response.json({ error: `Failed to download report: ${csvRes.status}` }, { status: 502 });
  }
  const csvText = await csvRes.text();

  // Parse CSV
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    return Response.json({ imported: 0, skipped: 0, message: "Report is empty" });
  }

  // Extract header
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/ /g, "_"));

  const getCol = (row, name) => {
    const idx = headers.indexOf(name);
    if (idx === -1) return null;
    const val = row[idx]?.replace(/^"|"$/g, "").trim();
    return val || null;
  };

  // Load existing records to avoid duplicates
  const existing = await base44.asServiceRole.entities.InboundMessage.list("-created_date", 1000);
  const existingCallIds = new Set(existing.map(m => m.telnyx_call_control_id).filter(Boolean));

  let imported = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV split (handles quoted commas naively)
    const row = line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(",");

    // Try to extract direction - skip outbound if desired
    const direction = getCol(row, "call_direction") || getCol(row, "direction") || "";
    if (direction && direction.toLowerCase() === "outbound") { skipped++; continue; }

    // Call leg/session IDs for dedup
    const callLegId = getCol(row, "call_leg_id") || getCol(row, "leg_id") || null;
    const callingNumber = getCol(row, "calling_number") || getCol(row, "from") || getCol(row, "cli") || null;
    const calledNumber = getCol(row, "called_number") || getCol(row, "to") || getCol(row, "cld") || null;
    const startTime = getCol(row, "start_time") || getCol(row, "call_start") || null;
    const durationStr = getCol(row, "duration_(seconds)") || getCol(row, "duration_secs") || getCol(row, "duration") || "0";
    const durationSecs = parseInt(durationStr) || 0;
    const hangupCause = getCol(row, "hangup_cause") || null;

    // Dedup by call leg ID
    if (callLegId && existingCallIds.has(callLegId)) { skipped++; continue; }

    let callOutcome = "hung_up_early";
    if (durationSecs >= 30) callOutcome = "listened_to_broadcasts";
    else if (durationSecs >= 5) callOutcome = "no_selection";

    await base44.asServiceRole.entities.InboundMessage.create({
      caller_phone: callingNumber || "unknown",
      caller_name: null,
      duration_seconds: durationSecs,
      called_at: startTime,
      telnyx_call_control_id: callLegId,
      call_outcome: callOutcome,
      ivr_selections: hangupCause,
      status: "reviewed",
    });

    if (callLegId) existingCallIds.add(callLegId);
    imported++;
  }

  return Response.json({
    imported,
    skipped,
    total_rows: lines.length - 1,
    message: `Imported ${imported} records, skipped ${skipped}.`,
  });
});