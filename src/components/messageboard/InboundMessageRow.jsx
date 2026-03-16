import React, { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { MoreHorizontal, Eye, Archive, PhoneIncoming, Clock, Play, Pause, Radio, Mic, PhoneOff, HelpCircle, Trash2, Download, Volume2 } from "lucide-react";
import { format } from "date-fns";

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

function InlinePlayer({ audioUrl }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  return (
    <div className="mt-2 flex items-center gap-3 bg-muted/50 rounded-xl px-3 py-2">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={togglePlay}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums w-20 shrink-0">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      <Slider
        value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
        max={100}
        step={0.1}
        onValueChange={([v]) => {
          if (audioRef.current && duration > 0) {
            audioRef.current.currentTime = (v / 100) * duration;
          }
        }}
        className="flex-1"
      />
      <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Slider
        value={[volume * 100]}
        max={100}
        step={1}
        onValueChange={([v]) => {
          const vol = v / 100;
          setVolume(vol);
          if (audioRef.current) audioRef.current.volume = vol;
        }}
        className="w-16 shrink-0"
      />
    </div>
  );
}

const statusStyles = {
  new: "bg-primary/10 text-primary border-primary/20",
  reviewed: "bg-slate-50 text-slate-700 border-slate-200",
  archived: "bg-slate-50 text-slate-500 border-slate-200",
};

const outcomeConfig = {
  listened_to_broadcasts: { label: "Listened to broadcasts", icon: Radio, color: "text-blue-600 bg-blue-50" },
  recorded_message: { label: "Left a message", icon: Mic, color: "text-emerald-600 bg-emerald-50" },
  no_selection: { label: "No selection", icon: HelpCircle, color: "text-amber-600 bg-amber-50" },
  hung_up_early: { label: "Hung up early", icon: PhoneOff, color: "text-red-500 bg-red-50" },
};

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function InboundMessageRow({ message, onStatusChange, onDelete, onDownload }) {
  const outcome = message.call_outcome ? outcomeConfig[message.call_outcome] : null;
  const OutcomeIcon = outcome?.icon;
  const [showPlayer, setShowPlayer] = useState(false);

  return (
    <div className="p-4 rounded-xl bg-white border border-border/50 hover:shadow-sm transition-all">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
          <PhoneIncoming className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{message.caller_name || message.caller_phone}</p>
            {message.caller_name && (
              <span className="text-xs text-muted-foreground font-mono">{message.caller_phone}</span>
            )}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusStyles[message.status] || ""}`}>
              {message.status}
            </Badge>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {outcome && (
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${outcome.color}`}>
                <OutcomeIcon className="h-3 w-3" />
                {outcome.label}
              </span>
            )}
            {message.duration_seconds > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDuration(message.duration_seconds)}
              </span>
            )}
            {message.called_at && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(message.called_at), "MMM d, yyyy h:mm a")}
              </span>
            )}
          </div>

          {message.ivr_selections && (
            <p className="text-xs text-muted-foreground mt-1">IVR selections: {message.ivr_selections}</p>
          )}
          {message.broadcast_name && (
            <p className="text-xs text-muted-foreground mt-0.5">Re: {message.broadcast_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {message.recording_url && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPlayer(v => !v)} title="Play recording">
              {showPlayer ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
            {message.recording_url && (
              <DropdownMenuItem onClick={() => onDownload(message)}>
                <Download className="h-3.5 w-3.5 mr-2" /> Download Recording
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(message)}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      {showPlayer && message.recording_url && (
        <InlinePlayer audioUrl={message.recording_url} />
      )}
    </div>
  );
}