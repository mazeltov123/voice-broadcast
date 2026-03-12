import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, PhoneIncoming, PhoneOutgoing, Download, RefreshCw, CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

function formatDuration(secs) {
  if (!secs) return "0s";
  const n = parseInt(secs, 10);
  if (isNaN(n)) return secs;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(d) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy h:mm a"); } catch { return d; }
}

export default function TelnyxCallLog() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pollingStatus, setPollingStatus] = useState(null); // null | "pending" | "complete" | "failed"
  const [error, setError] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [direction, setDirection] = useState("inbound");
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const pollReport = (reportId) => {
    let attempts = 0;
    const maxAttempts = 30; // up to ~5 minutes
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        stopPolling();
        setLoading(false);
        setPollingStatus("failed");
        setError("Report timed out. Telnyx may still be generating it — try again in a few minutes.");
        return;
      }
      const res = await base44.functions.invoke("importTelnyxCallLogs", { report_id: reportId });
      const data = res.data;
      if (data.status === "complete") {
        stopPolling();
        setLoading(false);
        setPollingStatus("complete");
        setRecords(data.records || []);
      } else if (data.status === "failed") {
        stopPolling();
        setLoading(false);
        setPollingStatus("failed");
        setError("Telnyx report generation failed.");
      }
      // else still pending, keep polling
    }, 10000); // poll every 10s
  };

  const fetchLogs = async () => {
    stopPolling();
    setLoading(true);
    setError(null);
    setImportResult(null);
    setRecords([]);
    setPollingStatus("pending");

    const res = await base44.functions.invoke("importTelnyxCallLogs", { direction });
    const data = res.data;

    if (data?.error) {
      setError(data.error);
      setLoading(false);
      setPollingStatus(null);
      return;
    }

    if (data?.report_id) {
      pollReport(data.report_id);
    } else {
      setLoading(false);
      setPollingStatus(null);
      setError("Unexpected response from Telnyx.");
    }
  };

  const importToMessageBoard = async () => {
    if (!records.length) return;
    setLoading(true);
    const existing = await base44.entities.InboundMessage.list("-created_date", 1000);
    const existingIds = new Set(existing.map(m => m.telnyx_call_control_id).filter(Boolean));

    const toCreate = records
      .filter(r => {
        const id = r.call_leg_id || r.id || r["Call Leg ID"];
        return id && !existingIds.has(id);
      })
      .map(r => ({
        caller_phone: r.cli || r.from || r["CLI"] || "unknown",
        broadcast_name: "Telnyx Import",
        duration_seconds: parseInt(r.duration || r.duration_secs || r["Duration"] || "0", 10) || 0,
        call_outcome: "no_selection",
        telnyx_call_control_id: r.call_leg_id || r.id || r["Call Leg ID"],
        called_at: r.start_time || r["Start Time"] || new Date().toISOString(),
        status: "reviewed",
      }));

    if (toCreate.length > 0) {
      await base44.entities.InboundMessage.bulkCreate(toCreate);
    }
    setLoading(false);
    setImportResult({ imported: toCreate.length, total: records.length });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Telnyx Call Log Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fetch historical call records from Telnyx and optionally import them into the Message Board
        </p>
      </div>

      <Card>
        <CardContent className="p-5 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {["inbound", "outbound", "both"].map(d => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                  direction === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {d === "inbound" && <span className="flex items-center gap-1"><PhoneIncoming className="h-3.5 w-3.5" /> Inbound</span>}
                {d === "outbound" && <span className="flex items-center gap-1"><PhoneOutgoing className="h-3.5 w-3.5" /> Outbound</span>}
                {d === "both" && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Both</span>}
              </button>
            ))}
          </div>

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? "Generating report..." : "Fetch Logs"}
            </Button>
            {records.length > 0 && (
              <Button onClick={importToMessageBoard} disabled={loading}>
                <Download className="h-4 w-4" />
                Import to Message Board
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {pollingStatus === "pending" && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-center gap-2 text-blue-700 text-sm">
            <Clock className="h-4 w-4 shrink-0 animate-pulse" />
            Telnyx is generating your report — this usually takes 30–90 seconds. Checking every 10 seconds...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-start gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {importResult && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 flex items-center gap-2 text-emerald-700 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Imported <strong>{importResult.imported}</strong> new records out of{" "}
            <strong>{importResult.total}</strong> fetched. Duplicates skipped.
          </CardContent>
        </Card>
      )}

      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{records.length} Call Records (last 90 days)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Direction</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">From</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">To</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Duration</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.slice(0, 200).map((r, i) => {
                    const from = r.cli || r.from || r["CLI"] || r["From"] || "—";
                    const to = r.cld || r.to || r["CLD"] || r["To"] || "—";
                    const date = r.start_time || r["Start Time"] || r.created_at || "";
                    const duration = r.duration || r.duration_secs || r["Duration"] || "0";
                    const callType = r.call_type || r["Call Type"] || "";
                    const isInbound = callType === "1" || callType === "Inbound" || String(callType).toLowerCase().includes("inbound");
                    const status = r.status || r["Status"] || (parseInt(duration) > 0 ? "answered" : "no_answer");
                    const statusBg = status === "answered" || status === "Completed" ? "bg-emerald-100 text-emerald-700"
                      : status === "no_answer" ? "bg-yellow-100 text-yellow-700"
                      : status === "busy" ? "bg-orange-100 text-orange-700"
                      : "bg-slate-100 text-slate-600";

                    return (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          {isInbound
                            ? <span className="flex items-center gap-1 text-blue-600"><PhoneIncoming className="h-3.5 w-3.5" /> Inbound</span>
                            : <span className="flex items-center gap-1 text-violet-600"><PhoneOutgoing className="h-3.5 w-3.5" /> Outbound</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">{from}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{to}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDate(date)}</td>
                        <td className="px-4 py-2.5">{formatDuration(duration)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBg}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {records.length > 200 && (
                <p className="text-xs text-muted-foreground p-4">Showing first 200 of {records.length} records</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && records.length === 0 && pollingStatus !== "pending" && !error && (
        <div className="text-center py-16 text-muted-foreground">
          <Phone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Click "Fetch Logs" to request call records from Telnyx</p>
          <p className="text-xs mt-1 opacity-70">Telnyx generates a report asynchronously — usually ready in under 2 minutes</p>
        </div>
      )}
    </div>
  );
}