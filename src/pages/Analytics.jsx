import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, subDays, eachDayOfInterval, parseISO, startOfDay } from "date-fns";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendingUp, Phone, PhoneIncoming, Radio } from "lucide-react";

const RANGE_OPTIONS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

const OUTCOME_COLORS = {
  listened_to_broadcasts: "#3B82F6",
  recorded_message: "#10B981",
  no_selection: "#F59E0B",
  hung_up_early: "#EF4444",
};

const OUTCOME_LABELS = {
  listened_to_broadcasts: "Listened",
  recorded_message: "Left Message",
  no_selection: "No Selection",
  hung_up_early: "Hung Up Early",
};

const CALL_STATUS_COLORS = {
  answered: "#10B981",
  no_answer: "#F59E0B",
  busy: "#F97316",
  failed: "#EF4444",
  voicemail: "#3B82F6",
};

export default function Analytics() {
  const [rangeDays, setRangeDays] = useState(14);

  const { data: callReports = [] } = useQuery({
    queryKey: ["callReports-all"],
    queryFn: () => base44.entities.CallReport.list("-called_at", 500),
  });

  const { data: inboundMessages = [] } = useQuery({
    queryKey: ["inbound-all"],
    queryFn: () => base44.entities.InboundMessage.list("-created_date", 500),
  });

  const { data: broadcasts = [] } = useQuery({
    queryKey: ["broadcasts-all"],
    queryFn: () => base44.entities.Broadcast.list("-created_date", 100),
  });

  // Build daily date range
  const today = startOfDay(new Date());
  const start = subDays(today, rangeDays - 1);
  const days = eachDayOfInterval({ start, end: today });

  // --- Delivery success rate per day ---
  const deliveryByDay = days.map(day => {
    const key = format(day, "MMM d");
    const dayReports = callReports.filter(r => {
      if (!r.called_at) return false;
      return format(startOfDay(parseISO(r.called_at)), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
    });
    const answered = dayReports.filter(r => r.call_status === "answered").length;
    const total = dayReports.length;
    return {
      date: key,
      answered,
      failed: total - answered,
      total,
      rate: total > 0 ? Math.round((answered / total) * 100) : null,
    };
  });

  // --- Inbound calls per day ---
  const inboundByDay = days.map(day => {
    const key = format(day, "MMM d");
    const count = inboundMessages.filter(m => {
      const d = m.called_at || m.created_date;
      if (!d) return false;
      return format(startOfDay(parseISO(d)), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
    }).length;
    return { date: key, inbound: count };
  });

  // --- Call outcome breakdown (pie) ---
  const outcomeCounts = {};
  inboundMessages.forEach(m => {
    if (m.call_outcome) outcomeCounts[m.call_outcome] = (outcomeCounts[m.call_outcome] || 0) + 1;
  });
  const outcomeData = Object.entries(outcomeCounts).map(([key, value]) => ({
    name: OUTCOME_LABELS[key] || key,
    value,
    color: OUTCOME_COLORS[key] || "#94A3B8",
  }));

  // --- Outbound call status breakdown (pie) ---
  const statusCounts = {};
  callReports.forEach(r => {
    if (r.call_status) statusCounts[r.call_status] = (statusCounts[r.call_status] || 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([key, value]) => ({
    name: key.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()),
    value,
    color: CALL_STATUS_COLORS[key] || "#94A3B8",
  }));

  // --- Broadcasts launched per day ---
  const broadcastsByDay = days.map(day => {
    const key = format(day, "MMM d");
    const count = broadcasts.filter(b => {
      const d = b.scheduled_at || b.created_date;
      if (!d) return false;
      return format(startOfDay(parseISO(d)), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
    }).length;
    return { date: key, broadcasts: count };
  });

  const totalAnswered = callReports.filter(r => r.call_status === "answered").length;
  const overallRate = callReports.length > 0 ? Math.round((totalAnswered / callReports.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Trends and performance over time</p>
        </div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.days}
              onClick={() => setRangeDays(opt.days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                rangeDays === opt.days
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Outbound Calls", value: callReports.length, icon: Phone, color: "text-primary bg-primary/10" },
          { label: "Overall Answer Rate", value: `${overallRate}%`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
          { label: "Total Inbound Calls", value: inboundMessages.length, icon: PhoneIncoming, color: "text-blue-600 bg-blue-50" },
          { label: "Total Broadcasts", value: broadcasts.filter(b => b.status === "completed").length, icon: Radio, color: "text-violet-600 bg-violet-50" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground leading-tight">{stat.label}</p>
                  <p className="text-2xl font-bold leading-tight">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delivery success rate over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Outbound Call Delivery — Answered vs Failed per Day</CardTitle>
        </CardHeader>
        <CardContent>
          {callReports.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={deliveryByDay} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94A3B8" }} />
                <YAxis fontSize={11} tick={{ fill: "#94A3B8" }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="answered" fill="#10B981" name="Answered" radius={[3, 3, 0, 0]} />
                <Bar dataKey="failed" fill="#EF4444" name="Failed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">No call data yet</div>
          )}
        </CardContent>
      </Card>

      {/* Success rate line */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily Answer Rate (%)</CardTitle>
        </CardHeader>
        <CardContent>
          {callReports.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={deliveryByDay} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94A3B8" }} />
                <YAxis fontSize={11} domain={[0, 100]} tick={{ fill: "#94A3B8" }} unit="%" />
                <Tooltip formatter={(v) => v != null ? `${v}%` : "No calls"} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  name="Answer Rate"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No call data yet</div>
          )}
        </CardContent>
      </Card>

      {/* Pies + inbound trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Outbound call status breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Outbound Call Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {statusData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span>
                      <span className="font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Inbound call outcome breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inbound Call Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {outcomeData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={outcomeData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {outcomeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {outcomeData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span>
                      <span className="font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No inbound data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Inbound calls per day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inbound Calls per Day</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={inboundByDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={10} tick={{ fill: "#94A3B8" }} />
                <YAxis fontSize={10} tick={{ fill: "#94A3B8" }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="inbound" fill="#6366F1" name="Inbound Calls" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Broadcasts launched per day */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Broadcasts Launched per Day</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={broadcastsByDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94A3B8" }} />
              <YAxis fontSize={11} tick={{ fill: "#94A3B8" }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="broadcasts" fill="#8B5CF6" name="Broadcasts" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}