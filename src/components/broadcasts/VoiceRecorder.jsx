import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Square, Play, Pause, Trash2, Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function VoiceRecorder({ onRecordingReady }) {
  const [state, setState] = useState("idle"); // idle | recording | recorded | uploading
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [title, setTitle] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      stream.getTracks().forEach(t => t.stop());
      setState("recorded");
    };

    mediaRecorder.start();
    setState("recording");
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  };

  const discard = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setTitle("");
    setState("idle");
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const useRecording = async () => {
    if (!audioBlob) return;
    setState("uploading");
    const recordingTitle = title || `Recording ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`;

    const file = new File([audioBlob], "recording.webm", { type: "audio/webm" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const audioFile = await base44.entities.AudioFile.create({
      title: recordingTitle,
      file_url,
      format: "mp3",
      status: "ready",
    });

    onRecordingReady(audioFile);
    discard();
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
      {state === "idle" && (
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="h-14 w-14 rounded-full bg-rose-50 flex items-center justify-center">
            <Mic className="h-6 w-6 text-rose-500" />
          </div>
          <p className="text-xs text-muted-foreground">Click to start recording your greeting</p>
          <Button size="sm" variant="outline" onClick={startRecording} className="border-rose-200 text-rose-600 hover:bg-rose-50">
            <Mic className="h-4 w-4 mr-1" /> Start Recording
          </Button>
        </div>
      )}

      {state === "recording" && (
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="h-14 w-14 rounded-full bg-rose-500 flex items-center justify-center animate-pulse">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-mono font-semibold text-rose-600">{formatTime(recordingTime)}</span>
          <Button size="sm" variant="destructive" onClick={stopRecording}>
            <Square className="h-4 w-4 mr-1" /> Stop
          </Button>
        </div>
      )}

      {state === "recorded" && (
        <div className="space-y-3">
          <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
          <Input
            placeholder="Recording title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={togglePlay}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "Pause" : "Preview"}
            </Button>
            <span className="text-xs text-muted-foreground">{formatTime(recordingTime)}</span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={discard} className="text-muted-foreground">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={useRecording}>
              <Check className="h-4 w-4 mr-1" /> Use Recording
            </Button>
          </div>
        </div>
      )}

      {state === "uploading" && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Uploading recording...</span>
        </div>
      )}
    </div>
  );
}