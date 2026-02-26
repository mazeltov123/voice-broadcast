import React from "react";
import { Card } from "@/components/ui/card";

export default function StatCard({ title, value, subtitle, icon: Icon, color = "primary" }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <Card className="p-5 hover:shadow-md transition-shadow border-border/50">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}