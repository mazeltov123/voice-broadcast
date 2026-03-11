import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Phone, Clock, CheckCircle2, XCircle, PhoneOff, PhoneMissed, Voicemail, Loader2, Play, Pause, Music, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const statusColors = {
  answered: "bg-emerald-100 text-emerald-700",
  no_answer: "bg-yellow-100 text-yellow-700",
  busy: "bg-orange-100 text-orange-700",
  failed: "bg-red-100 text-red-700",
  voicemail: "bg-blue-100 text-blue-700",
};

const statusLabels = {
  answered: "Answered",
  no_answer: "No Answer",
  busy: "Busy",
  failed: "Failed",
  voicemail: "Voicemail",
};

function formatDuration(seconds) {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function BroadcastReportDialog({ broadcast, open, onOpenChange }) {
  const [reports, setReports] = useState([]);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const { data: audioFile } = useQuery({
    queryKey: ["audioFile", broadcast?.audio_file_id],
    queryFn: () => base44.entities.AudioFile.filter({ id: broadcast.audio_file_id }),
    enabled: !!broadcast?.audio_file_id && open,
    select: (data) => data[0],
  });

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const { data: fetchedReports = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["callReports", broadcast?.id],
    queryFn: () => base44.entities.CallReport.filter({ broadcast_id: broadcast.id }, "-called_at"),
    enabled: !!broadcast?.id && open,
    refetchInterval: broadcast?.status === "in_progress" ? 15000 : false,
  });

  useEffect(() => {
    setReports(fetchedReports);
  }, [fetchedReports]);

  // Real-time subscription for in_progress
  useEffect(() => {
    if (!broadcast?.id || !open || broadcast?.status !== "in_progress") return;
    const unsubscribe = base44.entities.CallReport.subscribe((event) => {
      if (event.data?.broadcast_id !== broadcast.id) return;
      setReports((prev) => {
        if (event.type === "create") return [event.data, ...prev];
        if (event.type === "update") return prev.map((r) => r.id === event.id ? event.data : r);
        if (event.type === "delete") return prev.filter((r) => r.id !== event.id);
        return prev;
      });
    });
    return unsubscribe;
  }, [broadcast?.id, broadcast?.status, open]);

  if (!broadcast) return null;

  const total = broadcast.total_recipients || 0;
  const answered = reports.filter((r) => r.call_status === "answered");
  const notAnswered = reports.filter((r) => r.call_status !== "answered");
  const totalDuration = answered.reduce((sum, r) => sum + (r.duration_seconds || 0), 0);
  const avgDuration = answered.length ? Math.round(totalDuration / answered.length) : 0;
  const remaining = total - reports.length;
  const isLive = broadcast.status === "in_progress";

  const stats = [
    { label: "Total Called", value: reports.length, icon: Phone, color: "text-primary" },
    { label: "Answered", value: answered.length, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Not Answered", value: notAnswered.length, icon: PhoneMissed, color: "text-red-500" },
    { label: "Avg Duration", value: formatDuration(avgDuration), icon: Clock, color: "text-blue-600" },
  ];

  if (isLive) {
    stats.push({ label: "Calls Left", value: remaining > 0 ? remaining : 0, icon: Loader2, color: "text-amber-500" });
  }

  // Breakdown by status
  const breakdown = Object.entries(statusLabels).map(([key, label]) => ({
    key,
    label,
    count: reports.filter((r) => r.call_status === key).length,
    duration: reports.filter((r) => r.call_status === key).reduce((s, r) => s + (r.duration_seconds || 0), 0),
  })).filter((b) => b.count > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between w-full pr-6">
            <DialogTitle className="flex items-center gap-2">
              {isLive && <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse inline-block" />}
              {broadcast.name} — {isLive ? "Live Progress" : "Full Report"}
            </DialogTitle>
            {isLive && (
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 text-xs">
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Audio Player */}
        {audioFile?.file_url && (
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border">
            <button
              onClick={togglePlay}
              className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Music className="h-3.5 w-3.5 text-muted-foreground" />
                {audioFile.title}
              </p>
              <p className="text-xs text-muted-foreground">Broadcast message</p>
            </div>
            <audio
              ref={audioRef}
              src={audioFile.file_url}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading report...</div>
        ) : (
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.map((s) => (
                <Card key={s.label}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-2">
                      <s.icon className={`h-4 w-4 ${s.color} ${s.label === "Calls Left" && isLive ? "animate-spin" : ""}`} />
                      <div>
                        <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
                        <p className="text-lg font-bold leading-tight">{s.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Total duration */}
            {totalDuration > 0 && (
              <p className="text-sm text-muted-foreground">
                Total talk time: <span className="font-semibold text-foreground">{formatDuration(totalDuration)}</span>
              </p>
            )}

            {/* Breakdown */}
            {breakdown.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {breakdown.map((b) => (
                  <div key={b.key} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusColors[b.key]}`}>
                    <span>{statusLabels[b.key]}: {b.count}</span>
                    {b.duration > 0 && <span className="opacity-70">· {formatDuration(b.duration)}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Called At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {isLive ? "Waiting for calls to start..." : "No call data recorded"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      reports.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.contact_name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{r.phone_number}</TableCell>
                          <TableCell>
                            <Badge className={`${statusColors[r.call_status]} text-xs`}>
                              {statusLabels[r.call_status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.call_status === "answered" ? formatDuration(r.duration_seconds) : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {r.called_at ? format(new Date(r.called_at), "MMM d, h:mm a") : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}