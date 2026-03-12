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
  const pageSize = body.page_size || 100;

  // Fetch CDR (call detail records) from Telnyx reporting API
  // This endpoint returns all completed calls
  const url = new URL("https://api.telnyx.com/v2/reports/cdrs");
  url.searchParams.set("filter[call_direction]", "inbound");
  url.searchParams.set("page[size]", String(pageSize));
  if (FROM_NUMBER) url.searchParams.set("filter[called_number]", FROM_NUMBER);

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
    return Response.json({ imported: 0, skipped: 0, message: "No call records found in Telnyx" });
  }

  // Load existing telnyx_call_control_ids to avoid duplicates
  const existing = await base44.asServiceRole.entities.InboundMessage.list("-created_date", 500);
  const existingIds = new Set(existing.map(m => m.telnyx_call_control_id).filter(Boolean));
  const existingPhoneDates = new Set(
    existing.map(m => `${m.caller_phone}__${m.called_at ? m.called_at.substring(0, 16) : ""}`)
  );

  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const callId = record.call_leg_id || record.id || null;
    const callerPhone = record.calling_number || record.from || null;
    const calledAt = record.start_time || record.created_at || null;

    // Skip duplicates
    if (callId && existingIds.has(callId)) { skipped++; continue; }
    const dedupeKey = `${callerPhone}__${calledAt ? calledAt.substring(0, 16) : ""}`;
    if (existingPhoneDates.has(dedupeKey)) { skipped++; continue; }

    const durationSecs = record.duration_secs != null
      ? parseInt(record.duration_secs)
      : (record.billing_secs != null ? parseInt(record.billing_secs) : 0);

    const callStatus = record.hangup_cause === "NORMAL_CLEARING"
      ? "answered"
      : record.hangup_cause
        ? record.hangup_cause.toLowerCase().replace(/_/g, " ")
        : "unknown";

    await base44.asServiceRole.entities.InboundMessage.create({
      caller_phone: callerPhone || "unknown",
      caller_name: null,
      duration_seconds: durationSecs,
      called_at: calledAt,
      telnyx_call_control_id: callId,
      call_outcome: durationSecs > 10 ? "listened_to_broadcasts" : "hung_up_early",
      status: "reviewed",
      ivr_selections: record.hangup_cause || null,
    });

    imported++;
  }

  return Response.json({
    imported,
    skipped,
    total_fetched: records.length,
    message: `Imported ${imported} call records, skipped ${skipped} duplicates.`,
  });
});