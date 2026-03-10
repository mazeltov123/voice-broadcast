import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import toast from "react-hot-toast";
import { MessageSquare } from "lucide-react";

export default function SendSmsDialog({ open, onOpenChange, contact }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    const loadingToast = toast.loading("Sending SMS...");
    const res = await base44.functions.invoke("sendSms", {
      to: contact.phone_number,
      message: message.trim(),
    });
    setSending(false);
    if (res.data?.success) {
      toast.success("SMS sent!", { id: loadingToast });
      setMessage("");
      onOpenChange(false);
    } else {
      toast.error(res.data?.error || "Failed to send SMS", { id: loadingToast });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Send SMS to {contact?.first_name} {contact?.last_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <p className="text-sm font-medium">{contact?.phone_number}</p>
          </div>
          <div>
            <Label htmlFor="sms-message">Message</Label>
            <Textarea
              id="sms-message"
              placeholder="Type your message..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              className="mt-1 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{message.length} characters</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()}>
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Send SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}