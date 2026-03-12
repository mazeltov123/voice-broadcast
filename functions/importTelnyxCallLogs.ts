import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = Deno.env.get("TELNYX_API_KEY");
  if (!apiKey) return Response.json({ error: "TELNYX_API_KEY not set" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const pageSize = body.page_size || 100;
  const direction = body.direction || "inbound"; // "inbound" | "outbound" | "both"

  const allRecords = [];
  let nextPageUrl = null;

  // Build initial URL
  const buildUrl = () => {
    const params = new URLSearchParams({
      "page[size]": String(pageSize),
    });
    if (direction !== "both") {
      params.set("filter[call_direction]", direction === "inbound" ? "incoming" : "outgoing");
    }
    return `${TELNYX_API_BASE}/reports/call_records?${params}`;
  };

  let url = buildUrl();
  let pages = 0;
  const maxPages = 5; // limit to avoid timeout

  while (url && pages < maxPages) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Telnyx API error: ${res.status}`, details: err }, { status: 502 });
    }

    const json = await res.json();
    const records = json.data || [];
    allRecords.push(...records);

    // Check for next page
    url = json.meta?.next_page_token
      ? `${TELNYX_API_BASE}/reports/call_records?page[token]=${json.meta.next_page_token}&page[size]=${pageSize}`
      : null;
    pages++;
  }

  // Optionally import into InboundMessage entity
  if (body.import_records && allRecords.length > 0) {
    const existing = await base44.asServiceRole.entities.InboundMessage.list("-created_date", 1000);
    const existingIds = new Set(existing.map(m => m.telnyx_call_control_id).filter(Boolean));

    const toCreate = allRecords
      .filter(r => {
        const id = r.call_leg_id || r.id;
        return !existingIds.has(id);
      })
      .map(r => ({
        caller_phone: r.from || r.caller_id_number || "unknown",
        broadcast_name: "Telnyx Import",
        duration_seconds: r.duration_secs || 0,
        call_outcome: r.call_direction === "incoming" ? "no_selection" : null,
        telnyx_call_control_id: r.call_leg_id || r.id,
        called_at: r.start_time || r.created_at || new Date().toISOString(),
        status: "reviewed",
      }));

    if (toCreate.length > 0) {
      await base44.asServiceRole.entities.InboundMessage.bulkCreate(toCreate);
    }

    return Response.json({ records: allRecords, imported: toCreate.length, total: allRecords.length });
  }

  return Response.json({ records: allRecords, total: allRecords.length });
});