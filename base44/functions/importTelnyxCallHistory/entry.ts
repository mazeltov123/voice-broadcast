import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
  const FROM_NUMBER = Deno.env.get("TELNYX_FROM_NUMBER");

  if (!TELNYX_API_KEY) {
    return Response.json({ error: "TELNYX_API_KEY not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const pageSize = Math.min(body.page_size || 250, 250);

  // Fetch recordings from Telnyx — each recording corresponds to a call
  const url = new URL("https://api.telnyx.com/v2/recordings");
  url.searchParams.set("page[size]", String(pageSize));
  // Filter to calls TO our number (inbound)
  if (FROM_NUMBER) url.searchParams.set("filter[to]", FROM_NUMBER);

  const telnyxRes = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!telnyxRes.ok) {
    const errText = await telnyxRes.text();
    return Response.json({ error: `Telnyx API error: ${telnyxRes.status}`, details: errText }, { status: 502 });
  }

  const telnyxData = await telnyxRes.json();
  const records = telnyxData.data || [];

  if (records.length === 0) {
    return Response.json({ imported: 0, skipped: 0, total_fetched: 0, message: "No recordings found in Telnyx" });
  }

  // Load existing records to avoid duplicates
  const existing = await base44.asServiceRole.entities.InboundMessage.list("-created_date", 500);
  const existingCallIds = new Set(existing.map(m => m.telnyx_call_control_id).filter(Boolean));

  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const callControlId = record.call_control_id || null;
    const callLegId = record.call_leg_id || null;

    // Deduplicate by call_control_id
    if (callControlId && existingCallIds.has(callControlId)) { skipped++; continue; }

    const durationMs = record.duration_millis || 0;
    const durationSecs = Math.round(durationMs / 1000);
    const calledAt = record.recording_started_at || record.created_at || null;
    const recordingUrl = record.download_urls?.mp3 || record.download_urls?.wav || null;

    // Determine outcome based on duration
    let callOutcome = "hung_up_early";
    if (durationSecs >= 30) callOutcome = "listened_to_broadcasts";
    else if (durationSecs >= 5) callOutcome = "no_selection";

    await base44.asServiceRole.entities.InboundMessage.create({
      caller_phone: record.from || "unknown",
      caller_name: null,
      duration_seconds: durationSecs,
      called_at: calledAt,
      recording_url: recordingUrl,
      telnyx_call_control_id: callControlId || callLegId,
      call_outcome: callOutcome,
      status: "reviewed",
    });

    if (callControlId) existingCallIds.add(callControlId);
    imported++;
  }

  return Response.json({
    imported,
    skipped,
    total_fetched: records.length,
    message: `Imported ${imported} call records, skipped ${skipped} duplicates.`,
    meta: telnyxData.meta || null,
  });
});