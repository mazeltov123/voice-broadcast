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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { X, Music, Users, Search, Mic, Calendar, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import VoiceRecorder from "./VoiceRecorder";

export default function BroadcastFormDialog({ open, onOpenChange, audioFiles = [], groups = [], contacts = [], onSave, editBroadcast = null }) {
  const isEditing = !!editBroadcast;

  const [form, setForm] = useState({
    name: "",
    audio_file_id: "",
    target_mode: "groups",
    target_groups: [],
    target_contact_ids: [],
    throttle_mode: "throttled",
    calls_per_minute: 10,
    status: "draft",
    scheduled_at: "",
  });
  const [contactSearch, setContactSearch] = useState("");
  const [showRecorder, setShowRecorder] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);

  useEffect(() => {
    if (open) {
      if (editBroadcast) {
        const scheduledAt = editBroadcast.scheduled_at
          ? new Date(editBroadcast.scheduled_at).toISOString().slice(0, 16)
          : "";
        setForm({
          name: editBroadcast.name || "",
          audio_file_id: editBroadcast.audio_file_id || "",
          target_mode: editBroadcast.target_mode || "groups",
          target_groups: editBroadcast.target_groups || [],
          target_contact_ids: editBroadcast.target_contact_ids || [],
          throttle_mode: editBroadcast.throttle_mode || "throttled",
          calls_per_minute: editBroadcast.calls_per_minute || 10,
          status: editBroadcast.status || "draft",
          scheduled_at: scheduledAt,
        });
        setScheduleEnabled(!!scheduledAt);
      } else {
        setForm({
          name: "",
          audio_file_id: "",
          target_mode: "groups",
          target_groups: [],
          target_contact_ids: [],
          throttle_mode: "throttled",
          calls_per_minute: 10,
          status: "draft",
          scheduled_at: "",
        });
        setScheduleEnabled(false);
      }
      setContactSearch("");
      setShowRecorder(false);
    }
  }, [open, editBroadcast]);

  const toggleGroup = (groupId) => {
    setForm(prev => ({
      ...prev,
      target_groups: prev.target_groups.includes(groupId)
        ? prev.target_groups.filter(g => g !== groupId)
        : [...prev.target_groups, groupId],
    }));
  };

  const toggleContact = (contactId) => {
    setForm(prev => ({
      ...prev,
      target_contact_ids: prev.target_contact_ids.includes(contactId)
        ? prev.target_contact_ids.filter(c => c !== contactId)
        : [...prev.target_contact_ids, contactId],
    }));
  };

  const getRecipientCount = () => {
    if (form.target_mode === "contacts") return form.target_contact_ids.length;
    if (form.target_groups.length === 0) return contacts.filter(c => c.status === "active").length;
    const unique = new Set();
    contacts.filter(c => c.status === "active").forEach(c => {
      if ((c.groups || []).some(g => form.target_groups.includes(g))) {
        unique.add(c.id);
      }
    });
    return unique.size;
  };

  const selectedAudio = audioFiles.find(a => a.id === form.audio_file_id);
  const activeContacts = contacts.filter(c => c.status === "active");
  const filteredContacts = activeContacts.filter(c => {
    const name = `${c.first_name} ${c.last_name || ""} ${c.phone_number}`.toLowerCase();
    return name.includes(contactSearch.toLowerCase());
  });

  const handleSave = () => {
    const recipientCount = getRecipientCount();
    const targetGroupNames = form.target_groups.map(gid => groups.find(g => g.id === gid)?.name).filter(Boolean);
    const isScheduled = scheduleEnabled && !!form.scheduled_at;
    onSave({
      ...form,
      audio_file_title: selectedAudio?.title || "",
      target_group_names: targetGroupNames,
      total_recipients: recipientCount,
      pending: recipientCount,
      delivered: 0,
      failed: 0,
      status: isScheduled ? "scheduled" : "draft",
      scheduled_at: isScheduled ? new Date(form.scheduled_at).toISOString() : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Broadcast</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Campaign Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weekly Update - Jan 15" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Audio Message *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground px-2"
                onClick={() => setShowRecorder(v => !v)}
              >
                <Mic className="h-3 w-3 mr-1" />
                {showRecorder ? "Pick from library" : "Record new"}
              </Button>
            </div>
            {showRecorder ? (
              <VoiceRecorder
                onRecordingReady={(audioFile) => {
                  setForm(prev => ({ ...prev, audio_file_id: audioFile.id }));
                  setShowRecorder(false);
                }}
              />
            ) : (
              <>
                <Select value={form.audio_file_id} onValueChange={v => setForm({ ...form, audio_file_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an audio file" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioFiles.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex items-center gap-2">
                          <Music className="h-3.5 w-3.5" />
                          {a.title}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAudio?.file_url && (
                  <audio
                    key={selectedAudio.id}
                    controls
                    className="w-full h-9 mt-1.5"
                    src={selectedAudio.file_url}
                  />
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Target By</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.target_mode === "groups" ? "default" : "outline"}
                onClick={() => setForm({ ...form, target_mode: "groups" })}
              >
                Groups
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.target_mode === "contacts" ? "default" : "outline"}
                onClick={() => setForm({ ...form, target_mode: "contacts" })}
              >
                Specific Contacts
              </Button>
            </div>
          </div>

          {form.target_mode === "groups" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Target Groups</Label>
              <p className="text-[11px] text-muted-foreground">Leave empty to send to all active contacts</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {groups.map(g => (
                  <Badge
                    key={g.id}
                    variant={form.target_groups.includes(g.id) ? "default" : "outline"}
                    className="cursor-pointer transition-all"
                    onClick={() => toggleGroup(g.id)}
                    style={form.target_groups.includes(g.id) ? { backgroundColor: g.color } : { borderColor: g.color, color: g.color }}
                  >
                    {g.name}
                    {form.target_groups.includes(g.id) && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Select Contacts</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => {
                    const allIds = activeContacts.map(c => c.id);
                    const allSelected = allIds.every(id => form.target_contact_ids.includes(id));
                    setForm(prev => ({ ...prev, target_contact_ids: allSelected ? [] : allIds }));
                  }}
                >
                  {activeContacts.every(c => form.target_contact_ids.includes(c.id)) ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                />
              </div>
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border/50">
                {filteredContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No active contacts found</p>
                ) : (
                  filteredContacts.map(c => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                      <Checkbox
                        checked={form.target_contact_ids.includes(c.id)}
                        onCheckedChange={() => toggleContact(c.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.first_name} {c.last_name || ""}</p>
                        <p className="text-xs text-muted-foreground">{c.phone_number}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{getRecipientCount()} recipients</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Delivery Mode</Label>
            <Select value={form.throttle_mode} onValueChange={v => setForm({ ...form, throttle_mode: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simultaneous">Simultaneous (all at once)</SelectItem>
                <SelectItem value="throttled">Throttled (calls per minute)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.throttle_mode === "throttled" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Calls per Minute</Label>
                <span className="text-sm font-semibold text-primary">{form.calls_per_minute}</span>
              </div>
              <Slider
                value={[form.calls_per_minute]}
                onValueChange={([v]) => setForm({ ...form, calls_per_minute: v })}
                min={1}
                max={50}
                step={1}
              />
              <p className="text-[11px] text-muted-foreground">
                Estimated completion: ~{Math.ceil(getRecipientCount() / form.calls_per_minute)} minutes
              </p>
            </div>
          )}
          {/* Schedule toggle */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-medium cursor-pointer" htmlFor="schedule-toggle">Schedule for later</Label>
              </div>
              <Switch
                id="schedule-toggle"
                checked={scheduleEnabled}
                onCheckedChange={setScheduleEnabled}
              />
            </div>
            {scheduleEnabled && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Send date & time</Label>
                <div className="relative">
                  <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="datetime-local"
                    className="pl-8"
                    value={form.scheduled_at}
                    min={new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)}
                    onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                  />
                </div>
                {form.scheduled_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Will send on {new Date(form.scheduled_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={
              !form.name ||
              !form.audio_file_id ||
              (form.target_mode === "contacts" && form.target_contact_ids.length === 0) ||
              (scheduleEnabled && !form.scheduled_at)
            }
          >
            {scheduleEnabled && form.scheduled_at ? "Schedule Broadcast" : "Create Broadcast"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}