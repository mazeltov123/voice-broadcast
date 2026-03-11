import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Square, CheckCircle, Trash2, Music, Users, Clock, CheckCircle2, XCircle, BarChart2, Pencil } from "lucide-react";
import { format } from "date-fns";

const statusConfig = {
  draft: { label: "Draft", color: "bg-slate-50 text-slate-700 border-slate-200", icon: Clock },
  scheduled: { label: "Scheduled", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Play },
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle },
};

export default function BroadcastCard({ broadcast, onStart, onCancel, onMarkComplete, onDelete, onViewReport, onEdit }) {
  const total = broadcast.total_recipients || 0;
  const delivered = broadcast.delivered || 0;
  const failed = broadcast.failed || 0;
  const progress = total > 0 ? Math.round(((delivered + failed) / total) * 100) : 0;
  const config = statusConfig[broadcast.status] || statusConfig.draft;
  const StatusIcon = config.icon;

  return (
    <Card className="border-border/50 hover:shadow-md transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-semibold text-sm">{broadcast.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
                <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                {config.label}
              </Badge>
              {broadcast.created_date && (
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(broadcast.created_date.endsWith('Z') ? broadcast.created_date : broadcast.created_date + 'Z'), "MMM d, yyyy h:mm a")}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {broadcast.status === "draft" && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onStart(broadcast)}>
                <Play className="h-3 w-3 mr-1" /> Start
              </Button>
            )}
            {broadcast.status === "in_progress" && (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs text-blue-600" onClick={() => onViewReport(broadcast)}>
                  <BarChart2 className="h-3 w-3 mr-1" /> Live
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => onMarkComplete(broadcast)}>
                  <CheckCircle className="h-3 w-3 mr-1" /> Complete
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs text-rose-600" onClick={() => onCancel(broadcast)}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              </>
            )}
            {broadcast.status === "completed" && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onViewReport(broadcast)}>
                <BarChart2 className="h-3 w-3 mr-1" /> Report
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-7 w-7 text-primary" onClick={() => onEdit(broadcast)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {(broadcast.status === "draft" || broadcast.status === "completed" || broadcast.status === "cancelled") && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(broadcast)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Music className="h-3 w-3" />
              {broadcast.audio_file_title || "Audio"}
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {total} recipients
            </div>
          </div>

          {broadcast.status === "scheduled" && broadcast.scheduled_at && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                <Clock className="h-3 w-3" />
                Scheduled for: {broadcast.scheduled_at.slice(0, 16).replace('T', ' ')}
              </div>
              {broadcast.created_date && (
                <div className="text-amber-600/80">
                  Created: {format(new Date(broadcast.created_date.endsWith('Z') ? broadcast.created_date : broadcast.created_date + 'Z'), "MMM d, yyyy h:mm a")}
                </div>
              )}
            </div>
          )}

          {(broadcast.target_group_names || []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {broadcast.target_group_names.map((name, i) => (
                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                  {name}
                </Badge>
              ))}
            </div>
          )}

          {(broadcast.status === "in_progress" || broadcast.status === "completed") && (
            <div className="space-y-1.5">
              <Progress value={progress} className="h-1.5" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <div className="flex gap-3">
                  <span className="flex items-center gap-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" /> {delivered} delivered
                  </span>
                  <span className="flex items-center gap-0.5">
                    <XCircle className="h-2.5 w-2.5 text-rose-500" /> {failed} failed
                  </span>
                </div>
                <span>{progress}%</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}