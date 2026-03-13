import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Phone, Clock, Plus, Search, Trash2, PhoneIncoming, PhoneOutgoing } from "lucide-react";
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

export default function CallReportPage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [search, setSearch] = useState("");
  const [filterBroadcast, setFilterBroadcast] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    broadcast_id: "",
    broadcast_name: "",
    contact_name: "",
    phone_number: "",
    direction: "outgoing",
    call_status: "answered",
    duration_seconds: "",
    called_at: new Date().toISOString().slice(0, 16),
    notes: "",
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["callReports", currentUser?.email],
    queryFn: () => isAdmin
      ? base44.entities.CallReport.list("-called_at")
      : base44.entities.CallReport.filter({ created_by: currentUser?.email }, "-called_at"),
    enabled: !!currentUser,
  });

  const { data: broadcasts = [] } = useQuery({
    queryKey: ["broadcasts", currentUser?.email],
    queryFn: () => isAdmin
      ? base44.entities.Broadcast.list()
      : base44.entities.Broadcast.filter({ created_by: currentUser?.email }),
    enabled: !!currentUser,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CallReport.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callReports"] });
      setShowForm(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CallReport.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["callReports"] }),
  });

  const resetForm = () => {
    setForm({
      broadcast_id: "",
      broadcast_name: "",
      contact_name: "",
      phone_number: "",
      direction: "outgoing",
      call_status: "answered",
      duration_seconds: "",
      called_at: new Date().toISOString().slice(0, 16),
      notes: "",
      });
      };

  const handleBroadcastSelect = (id) => {
    const bc = broadcasts.find((b) => b.id === id);
    setForm((f) => ({ ...f, broadcast_id: id, broadcast_name: bc?.name || "" }));
  };

  const handleSubmit = () => {
    createMutation.mutate({
      ...form,
      duration_seconds: Number(form.duration_seconds) || 0,
      called_at: new Date(form.called_at).toISOString(),
    });
  };

  const filtered = reports.filter((r) => {
    const matchSearch =
      !search ||
      r.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.phone_number?.includes(search);
    const matchBroadcast = filterBroadcast === "all" || r.broadcast_id === filterBroadcast;
    const matchStatus = filterStatus === "all" || r.call_status === filterStatus;
    const matchDirection = filterDirection === "all" || (r.direction || "outgoing") === filterDirection;
    return matchSearch && matchBroadcast && matchStatus && matchDirection;
  });

  // Summary stats
  const answered = filtered.filter((r) => r.call_status === "answered");
  const totalDuration = answered.reduce((sum, r) => sum + (r.duration_seconds || 0), 0);
  const avgDuration = answered.length ? Math.round(totalDuration / answered.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Call Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Track who picked up and call duration per broadcast</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Report
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Calls", value: filtered.length, icon: Phone, color: "text-primary" },
          { label: "Answered", value: answered.length, icon: Phone, color: "text-emerald-600" },
          { label: "Not Answered", value: filtered.length - answered.length, icon: Phone, color: "text-red-500" },
          { label: "Avg Duration", value: formatDuration(avgDuration), icon: Clock, color: "text-blue-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-semibold">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterBroadcast} onValueChange={setFilterBroadcast}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Broadcasts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Broadcasts</SelectItem>
            {broadcasts.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(statusLabels).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterDirection} onValueChange={setFilterDirection}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Directions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="outgoing">Outgoing</SelectItem>
            <SelectItem value="incoming">Incoming</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Broadcast</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Called At</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No call reports found</TableCell>
                </TableRow>
              ) : (
                filtered.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.contact_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{report.phone_number}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{report.broadcast_name || "—"}</TableCell>
                    <TableCell>
                      {(report.direction || "outgoing") === "incoming" ? (
                        <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1 w-fit">
                          <PhoneIncoming className="h-3 w-3" /> Incoming
                        </Badge>
                      ) : (
                        <Badge className="bg-sky-100 text-sky-700 flex items-center gap-1 w-fit">
                          <PhoneOutgoing className="h-3 w-3" /> Outgoing
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[report.call_status]}>
                        {statusLabels[report.call_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {report.call_status === "answered"
                        ? formatDuration(report.duration_seconds)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {report.called_at ? format(new Date(report.called_at), "MMM d, yyyy h:mm a") : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(report.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Report Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Call Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Broadcast</Label>
              <Select value={form.broadcast_id} onValueChange={handleBroadcastSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select broadcast" />
                </SelectTrigger>
                <SelectContent>
                  {broadcasts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Contact Name</Label>
              <Input
                placeholder="John Doe"
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone Number *</Label>
              <Input
                placeholder="+1234567890"
                value={form.phone_number}
                onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={(v) => setForm((f) => ({ ...f, direction: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outgoing">Outgoing</SelectItem>
                  <SelectItem value="incoming">Incoming</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Call Status *</Label>
                <Select value={form.call_status} onValueChange={(v) => setForm((f) => ({ ...f, call_status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Duration (seconds)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.duration_seconds}
                  onChange={(e) => setForm((f) => ({ ...f, duration_seconds: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Called At</Label>
              <Input
                type="datetime-local"
                value={form.called_at}
                onChange={(e) => setForm((f) => ({ ...f, called_at: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.phone_number || !form.call_status || createMutation.isPending}
            >
              Save Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}