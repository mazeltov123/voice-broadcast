import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Music } from "lucide-react";
import AudioUploadDialog from "@/components/audio/AudioUploadDialog";
import AudioCard from "@/components/audio/AudioCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function AudioLibrary() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [uploadDialog, setUploadDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: audioFiles = [], isLoading } = useQuery({
    queryKey: ["audioFiles"],
    queryFn: () => base44.entities.AudioFile.list("-created_date"),
  });

  const createAudio = useMutation({
    mutationFn: (data) => base44.entities.AudioFile.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["audioFiles"] }); setUploadDialog(false); },
  });
  const deleteAudio = useMutation({
    mutationFn: (id) => base44.entities.AudioFile.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["audioFiles"] }); setDeleteTarget(null); },
  });

  const filtered = audioFiles.filter(a =>
    !search || `${a.title} ${a.description}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audio Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload and manage your broadcast audio files</p>
        </div>
        <Button size="sm" onClick={() => setUploadDialog(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Upload Audio
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search audio files..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Music className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No audio files yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Upload your first MP3 to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(audio => (
            <AudioCard key={audio.id} audio={audio} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      <AudioUploadDialog open={uploadDialog} onOpenChange={setUploadDialog} onSave={(data) => createAudio.mutate(data)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Audio File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAudio.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}