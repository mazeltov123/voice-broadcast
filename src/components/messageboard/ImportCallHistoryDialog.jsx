import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Download, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

const STEPS = {
  CONFIGURE: "configure",
  REQUESTING: "requesting",
  WAITING: "waiting",
  IMPORTING: "importing",
  DONE: "done",
  ERROR: "error",
};

export default function ImportCallHistoryDialog({ open, onClose, onImported }) {
  const [step, setStep] = useState(STEPS.CONFIGURE);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportId, setReportId] = useState(null);
  const [reportUrl, setReportUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [reportStatus, setReportStatus] = useState(null);

  const reset = () => {
    setStep(STEPS.CONFIGURE);
    setReportId(null);
    setReportUrl(null);
    setResult(null);
    setError(null);
    setReportStatus(null);
  };

  const handleRequestReport = async () => {
    setStep(STEPS.REQUESTING);
    setError(null);
    const startIso = new Date(startDate + "T00:00:00Z").toISOString();
    const endIso = new Date(endDate + "T23:59:59Z").toISOString();
    const res = await base44.functions.invoke("requestTelnyxCdrReport", {
      start_time: startIso,
      end_time: endIso,
    });
    const data = res.data;
    if (data.error) {
      setError(data.error + (data.details ? ": " + data.details : ""));
      setStep(STEPS.ERROR);
      return;
    }
    setReportId(data.report?.id);
    setReportStatus(data.report?.status);
    setStep(STEPS.WAITING);
  };

  const handleCheckStatus = async () => {
    if (!reportId) return;
    const res = await base44.functions.invoke("checkTelnyxCdrStatus", { report_id: reportId });
    const data = res.data;
    if (data.error) {
      setError(data.error);
      setStep(STEPS.ERROR);
      return;
    }
    const report = data.report;
    setReportStatus(report?.status);
    // status=2 means completed in Telnyx
    if (report?.report_url && (report.status === 2 || report.status === "completed")) {
      setReportUrl(report.report_url);
    }
  };

  const handleImport = async () => {
    if (!reportUrl) return;
    setStep(STEPS.IMPORTING);
    const res = await base44.functions.invoke("importTelnyxCdrData", { report_url: reportUrl });
    const data = res.data;
    if (data.error) {
      setError(data.error);
      setStep(STEPS.ERROR);
      return;
    }
    setResult(data);
    setStep(STEPS.DONE);
    onImported?.();
  };

  const statusLabel = {
    1: "Queued",
    2: "Completed",
    3: "Failed",
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Import Call History from Telnyx
          </DialogTitle>
          <DialogDescription>
            Fetches your historical CDR (call detail records) from Telnyx and imports them into the Message Board.
          </DialogDescription>
        </DialogHeader>

        {step === STEPS.CONFIGURE && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">From Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">To Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
              Telnyx generates a report asynchronously — this may take a minute. After requesting, check status until the report is ready, then import.
            </p>
            <Button className="w-full" onClick={handleRequestReport}>
              Request CDR Report
            </Button>
          </div>
        )}

        {step === STEPS.REQUESTING && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Requesting report from Telnyx…</p>
          </div>
        )}

        {step === STEPS.WAITING && (
          <div className="space-y-4 mt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-amber-800">Report requested</p>
              <p className="text-amber-700 mt-1">Report ID: <code className="bg-amber-100 px-1 rounded text-xs">{reportId}</code></p>
              <p className="text-amber-700 mt-1">Status: <strong>{statusLabel[reportStatus] || `Code ${reportStatus}`}</strong></p>
            </div>
            {!reportUrl ? (
              <Button variant="outline" className="w-full gap-2" onClick={handleCheckStatus}>
                <RefreshCw className="h-4 w-4" /> Check Status
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Report is ready!
                </p>
                <Button className="w-full" onClick={handleImport}>
                  Import Records Now
                </Button>
              </div>
            )}
          </div>
        )}

        {step === STEPS.IMPORTING && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Downloading and importing records…</p>
          </div>
        )}

        {step === STEPS.DONE && result && (
          <div className="space-y-4 mt-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800 space-y-1">
              <p className="font-semibold flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Import complete!</p>
              <p>Imported: <strong>{result.imported}</strong> records</p>
              <p>Skipped (duplicates): <strong>{result.skipped}</strong></p>
              <p>Total rows in report: <strong>{result.total_rows}</strong></p>
            </div>
            <Button className="w-full" onClick={() => { reset(); onClose(); }}>Done</Button>
          </div>
        )}

        {step === STEPS.ERROR && (
          <div className="space-y-4 mt-2">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
              <p className="font-semibold flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Error</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={reset}>Try Again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}