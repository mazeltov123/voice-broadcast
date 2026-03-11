import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

export default function ContactFormDialog({ open, onOpenChange, contact, groups, onSave }) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    email: "",
    groups: [],
    status: "active",
    sms_enabled: true,
    notes: "",
  });

  useEffect(() => {
    if (contact) {
      setForm({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        phone_number: contact.phone_number || "",
        email: contact.email || "",
        groups: contact.groups || [],
        status: contact.status || "active",
        sms_enabled: contact.sms_enabled !== false,
        notes: contact.notes || "",
      });
    } else {
      setForm({ first_name: "", last_name: "", phone_number: "", email: "", groups: [], status: "active", sms_enabled: true, notes: "" });
    }
  }, [contact, open]);

  const toggleGroup = (groupId) => {
    setForm(prev => ({
      ...prev,
      groups: prev.groups.includes(groupId)
        ? prev.groups.filter(g => g !== groupId)
        : [...prev.groups, groupId],
    }));
  };

  const handleSave = () => {
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "Add Contact"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="John" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name</Label>
              <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Doe" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone Number *</Label>
            <Input value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} placeholder="+1 (555) 123-4567" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="do_not_call">Do Not Call</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Groups</Label>
            <div className="flex flex-wrap gap-2">
              {(groups || []).map(g => (
                <Badge
                  key={g.id}
                  variant={form.groups.includes(g.id) ? "default" : "outline"}
                  className="cursor-pointer transition-all"
                  onClick={() => toggleGroup(g.id)}
                  style={form.groups.includes(g.id) ? { backgroundColor: g.color } : {}}
                >
                  {g.name}
                  {form.groups.includes(g.id) && <X className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
              {(!groups || groups.length === 0) && (
                <p className="text-xs text-muted-foreground">No groups created yet</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 py-1">
            <Checkbox
              id="sms-enabled"
              checked={form.sms_enabled}
              onCheckedChange={v => setForm({ ...form, sms_enabled: !!v })}
            />
            <Label htmlFor="sms-enabled" className="text-xs cursor-pointer">Can receive SMS messages</Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.first_name || !form.phone_number}>
            {contact ? "Update" : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}