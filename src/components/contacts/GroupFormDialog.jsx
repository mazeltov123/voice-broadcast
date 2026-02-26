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

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

export default function GroupFormDialog({ open, onOpenChange, group, onSave }) {
  const [form, setForm] = useState({ name: "", description: "", color: "#3B82F6" });

  useEffect(() => {
    if (group) {
      setForm({ name: group.name || "", description: group.description || "", color: group.color || "#3B82F6" });
    } else {
      setForm({ name: "", description: "", color: "#3B82F6" });
    }
  }, [group, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{group ? "Edit Group" : "Create Group"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Group Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Emergency List" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description..." rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-7 w-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name}>
            {group ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}