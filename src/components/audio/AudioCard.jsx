import React, { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, Trash2, Music, Clock } from "lucide-react";
import { format } from "date-fns";

export default function AudioCard({ audio, onDelete }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(audio.duration_seconds || 0);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (error) {
        console.error('Audio playback failed:', error);
        setPlaying(false);
      }
    }
  };

  const formatBadge = {
    mp3: "bg-blue-50 text-blue-700 border-blue-200",
    wav: "bg-purple-50 text-purple-700 border-purple-200",
    ulaw: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <Card className="border-border/50 hover:shadow-md transition-all group">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <button
            onClick={togglePlay}
            className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
          >
            {playing ? (
              <Pause className="h-5 w-5 text-primary" />
            ) : (
              <Play className="h-5 w-5 text-primary ml-0.5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{audio.title}</p>
            {audio.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{audio.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${formatBadge[audio.format] || ""}`}>
                {audio.format?.toUpperCase()}
              </Badge>
              {audio.file_size_kb && (
                <span className="text-[10px] text-muted-foreground">{audio.file_size_kb} KB</span>
              )}
              {audio.created_date && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {format(new Date(audio.created_date), "MMM d, yyyy")}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
            onClick={() => onDelete(audio)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <audio
          ref={audioRef}
          src={audio.file_url}
          onEnded={() => setPlaying(false)}
          onError={() => setPlaying(false)}
          onLoadedMetadata={() => {
            if (audioRef.current) setDuration(Math.round(audioRef.current.duration));
          }}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}