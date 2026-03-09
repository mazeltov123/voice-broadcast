import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, Music, Mic, Square, Play, Pause, Trash2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AudioUploadDialog({ open, onOpenChange, onSave }) {
  const [form, setForm] = useState({ title: "", description: "" });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Recording state
  const [recState, setRecState] = useState("idle"); // idle | recording | recorded | uploading
  const [recTime, setRecTime] = useState(0);
  const [recTitle, setRecTitle] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const handleUpload = async () => {
    if (!file || !form.title) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onSave({
      title: form.title,
      description: form.description,
      file_url,
      format: file.name.split(".").pop()?.toLowerCase() || "mp3",
      file_size_kb: Math.round(file.size / 1024),
      status: "ready",
    });
    setForm({ title: "", description: "" });
    setFile(null);
    setUploading(false);
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      stream.getTracks().forEach(t => t.stop());
      setRecState("recorded");
    };
    mediaRecorder.start();
    setRecState("recording");
    setRecTime(0);
    timerRef.current = setInterval(() => setRecTime(prev => prev + 1), 1000);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  };

  const discardRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecTime(0);
    setRecTitle("");
    setRecState("idle");
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  };

  const saveRecording = async () => {
    if (!audioBlob) return;
    setRecState("uploading");
    const title = recTitle || `Recording ${new Date().toLocaleString()}`;
    const recFile = new File([audioBlob], "recording.webm", { type: "audio/webm" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file: recFile });
    onSave({ title, file_url, format: "mp3", status: "ready" });
    discardRecording();
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const handleClose = () => {
    discardRecording();
    setForm({ title: "", description: "" });
    setFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Audio File</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="upload">
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1"><Upload className="h-3.5 w-3.5 mr-1.5" />Upload File</TabsTrigger>
            <TabsTrigger value="record" className="flex-1"><Mic className="h-3.5 w-3.5 mr-1.5" />Record</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 py-2">
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
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!form.title || !file || uploading}>
                {uploading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Uploading...</> : "Upload & Save"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="record" className="py-2">
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20 min-h-[180px] flex flex-col justify-center">
              {recState === "idle" && (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="h-14 w-14 rounded-full bg-rose-50 flex items-center justify-center">
                    <Mic className="h-6 w-6 text-rose-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">Click to start recording</p>
                  <Button size="sm" variant="outline" onClick={startRecording} className="border-rose-200 text-rose-600 hover:bg-rose-50">
                    <Mic className="h-4 w-4 mr-1" /> Start Recording
                  </Button>
                </div>
              )}

              {recState === "recording" && (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="h-14 w-14 rounded-full bg-rose-500 flex items-center justify-center animate-pulse">
                    <Mic className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xl font-mono font-semibold text-rose-600">{formatTime(recTime)}</span>
                  <Button size="sm" variant="destructive" onClick={stopRecording}>
                    <Square className="h-4 w-4 mr-1" /> Stop
                  </Button>
                </div>
              )}

              {recState === "recorded" && (
                <div className="space-y-3">
                  <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} style={{ display: "none" }} />
                  <Input placeholder="Recording title (optional)" value={recTitle} onChange={e => setRecTitle(e.target.value)} className="h-8 text-sm" />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={togglePlay}>
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isPlaying ? "Pause" : "Preview"}
                    </Button>
                    <span className="text-xs text-muted-foreground">{formatTime(recTime)}</span>
                    <div className="flex-1" />
                    <Button size="sm" variant="ghost" onClick={discardRecording} className="text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={saveRecording}>
                      <Check className="h-4 w-4 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              )}

              {recState === "uploading" && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Saving recording...</span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}