import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, PhoneIncoming, Music, Users } from "lucide-react";
import { format } from "date-fns";

export default function RecentActivity({ broadcasts, inboundMessages }) {
  const activities = [
    ...(broadcasts || []).map(b => ({
      type: "broadcast",
      title: b.name,
      subtitle: `${b.total_recipients || 0} recipients`,
      status: b.status,
      date: b.created_date,
      icon: Radio,
    })),
    ...(inboundMessages || []).map(m => ({
      type: "inbound",
      title: `Call from ${m.caller_name || m.caller_phone}`,
      subtitle: `${m.duration_seconds || 0}s duration`,
      status: m.status,
      date: m.created_date,
      icon: PhoneIncoming,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  const statusColor = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200",
    draft: "bg-slate-50 text-slate-700 border-slate-200",
    scheduled: "bg-amber-50 text-amber-700 border-amber-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
    new: "bg-primary/10 text-primary border-primary/20",
    reviewed: "bg-slate-50 text-slate-700 border-slate-200",
    archived: "bg-slate-50 text-slate-500 border-slate-200",
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <activity.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">{activity.subtitle}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor[activity.status] || ""}`}>
                    {activity.status?.replace(/_/g, " ")}
                  </Badge>
                  {activity.date && (
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(activity.date), "MMM d")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}