import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, PhoneIncoming, PhoneOutgoing, Download, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

const statusColor = {
  answered: "bg-emerald-100 text-emerald-700",
  no_answer: "bg-yellow-100 text-yellow-700",
  busy: "bg-orange-100 text-orange-700",
  failed: "bg-red-100 text-red-700",
};

function formatDuration(secs) {
  if (!secs) return "0s";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(d) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy h:mm a"); } catch { return d; }
}

export default function TelnyxCallLog() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [direction, setDirection] = useState("inbound");

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    setImportResult(null);
    const res = await base44.functions.invoke("importTelnyxCallLogs", {
      direction,
      page_size: 100,
      import_records: false,
    });
    setLoading(false);
    if (res.data?.error) {
      setError(res.data.error + (res.data.details ? ": " + res.data.details : ""));
    } else {
      setRecords(res.data?.records || []);
    }
  };

  const importLogs = async () => {
    setImportLoading(true);
    setError(null);
    const res = await base44.functions.invoke("importTelnyxCallLogs", {
      direction,
      page_size: 100,
      import_records: true,
    });
    setImportLoading(false);
    if (res.data?.error) {
      setError(res.data.error + (res.data.details ? ": " + res.data.details : ""));
    } else {
      setImportResult(res.data);
      setRecords(res.data?.records || []);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Telnyx Call Log Import</h1>
        <p className="text-sm text-muted-foreground mt-1">Fetch historical call records from your Telnyx account</p>
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
                {d === "inbound" ? <span className="flex items-center gap-1"><PhoneIncoming className="h-3.5 w-3.5" /> Inbound</span>
                  : d === "outbound" ? <span className="flex items-center gap-1"><PhoneOutgoing className="h-3.5 w-3.5" /> Outbound</span>
                  : <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Both</span>}
              </button>
            ))}
          </div>

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={fetchLogs} disabled={loading || importLoading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Fetching..." : "Preview Logs"}
            </Button>
            <Button onClick={importLogs} disabled={loading || importLoading}>
              <Download className={`h-4 w-4 ${importLoading ? "animate-spin" : ""}`} />
              {importLoading ? "Importing..." : "Import to Message Board"}
            </Button>
          </div>
        </CardContent>
      </Card>

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
            Successfully imported <strong>{importResult.imported}</strong> new records out of{" "}
            <strong>{importResult.total}</strong> fetched. Duplicates skipped.
          </CardContent>
        </Card>
      )}

      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{records.length} Call Records</CardTitle>
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
                  {records.map((r, i) => {
                    const isInbound = r.call_direction === "incoming";
                    const status = r.hangup_cause?.toLowerCase() === "normal_clearing" ? "answered"
                      : r.hangup_cause?.toLowerCase().includes("no_answer") ? "no_answer"
                      : r.hangup_cause?.toLowerCase().includes("busy") ? "busy"
                      : r.duration_secs > 0 ? "answered" : "no_answer";

                    return (
                      <tr key={r.id || i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          {isInbound
                            ? <span className="flex items-center gap-1 text-blue-600"><PhoneIncoming className="h-3.5 w-3.5" /> Inbound</span>
                            : <span className="flex items-center gap-1 text-violet-600"><PhoneOutgoing className="h-3.5 w-3.5" /> Outbound</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">{r.from || r.caller_id_number || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{r.to || r.destination || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.start_time || r.created_at)}</td>
                        <td className="px-4 py-2.5">{formatDuration(r.duration_secs || 0)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[status] || "bg-slate-100 text-slate-600"}`}>
                            {status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && records.length === 0 && !error && (
        <div className="text-center py-16 text-muted-foreground">
          <Phone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Click "Preview Logs" to fetch call records from Telnyx</p>
        </div>
      )}
    </div>
  );
}