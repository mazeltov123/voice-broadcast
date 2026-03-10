import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Phone, User } from "lucide-react";
import { format } from "date-fns";

const statusColors = {
  new: "bg-blue-100 text-blue-700",
  reviewed: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-600",
};

export default function InboundSmsRow({ sms, onStatusChange }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {sms.sender_name || "Unknown"}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {sms.from_number}
                </span>
                <Badge className={`text-xs ${statusColors[sms.status]}`}>{sms.status}</Badge>
              </div>
              <p className="text-sm mt-1 text-foreground break-words">{sms.body}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {sms.created_date ? format(new Date(sms.created_date), "MMM d, yyyy h:mm a") : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {sms.status !== "reviewed" && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onStatusChange(sms, "reviewed")}>
                Mark Reviewed
              </Button>
            )}
            {sms.status !== "archived" && (
              <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={() => onStatusChange(sms, "archived")}>
                Archive
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}