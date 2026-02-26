import React, { useState } from "react";
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
import { Upload, Loader2, Music } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AudioUploadDialog({ open, onOpenChange, onSave }) {
  const [form, setForm] = useState({ title: "", description: "" });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file || !form.title) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const audioData = {
      title: form.title,
      description: form.description,
      file_url,
      format: file.name.split(".").pop()?.toLowerCase() || "mp3",
      file_size_kb: Math.round(file.size / 1024),
      status: "ready",
    };
    onSave(audioData);
    setForm({ title: "", description: "" });
    setFile(null);
    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Audio File</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Weekly Update - Jan 15" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Audio File *</Label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:bg-muted/30 transition-colors">
              <input type="file" accept="audio/*,.mp3,.wav" className="hidden" onChange={e => setFile(e.target.files[0])} />
              {file ? (
                <div className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload MP3, WAV, or other audio</p>
                </>
              )}
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!form.title || !file || uploading}>
            {uploading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Uploading...</> : "Upload & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}