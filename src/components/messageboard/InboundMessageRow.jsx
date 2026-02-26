import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Archive, PhoneIncoming, Clock, Play } from "lucide-react";
import { format } from "date-fns";

const statusStyles = {
  new: "bg-primary/10 text-primary border-primary/20",
  reviewed: "bg-slate-50 text-slate-700 border-slate-200",
  archived: "bg-slate-50 text-slate-500 border-slate-200",
};

export default function InboundMessageRow({ message, onStatusChange, onPlay }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-border/50 hover:shadow-sm transition-all">
      <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
        <PhoneIncoming className="h-5 w-5 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{message.caller_name || message.caller_phone}</p>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusStyles[message.status] || ""}`}>
            {message.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {message.caller_name && <span>{message.caller_phone}</span>}
          {message.duration_seconds > 0 && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" /> {message.duration_seconds}s
            </span>
          )}
          {message.broadcast_name && <span>Re: {message.broadcast_name}</span>}
          {message.created_date && (
            <span>{format(new Date(message.created_date), "MMM d, h:mm a")}</span>
          )}
        </div>
        {message.ivr_selections && (
          <p className="text-xs text-muted-foreground mt-1">IVR: {message.ivr_selections}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {message.recording_url && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPlay(message)}>
            <Play className="h-4 w-4" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onStatusChange(message, "reviewed")}>
              <Eye className="h-3.5 w-3.5 mr-2" /> Mark as Reviewed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(message, "archived")}>
              <Archive className="h-3.5 w-3.5 mr-2" /> Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}