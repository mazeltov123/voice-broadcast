import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Radio } from "lucide-react";
import BroadcastFormDialog from "@/components/broadcasts/BroadcastFormDialog";
import BroadcastCard from "@/components/broadcasts/BroadcastCard";
import BroadcastReportDialog from "@/components/broadcasts/BroadcastReportDialog";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function Broadcasts() {
  const queryClient = useQueryClient();
  const [createDialog, setCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [tab, setTab] = useState("all");

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => base44.entities.Broadcast.list("-created_date"),
  });
  const { data: audioFiles = [] } = useQuery({
    queryKey: ["audioFiles"],
    queryFn: () => base44.entities.AudioFile.list(),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.ContactGroup.list(),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list(),
  });

  const createBroadcast = useMutation({
    mutationFn: (data) => base44.entities.Broadcast.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["broadcasts"] }); setCreateDialog(false); },
  });
  const updateBroadcast = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Broadcast.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["broadcasts"] }),
  });
  const deleteBroadcast = useMutation({
    mutationFn: (id) => base44.entities.Broadcast.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["broadcasts"] }); setDeleteTarget(null); },
  });

  const handleStart = (broadcast) => {
    updateBroadcast.mutate({ id: broadcast.id, data: { status: "in_progress" } });
  };
  const handleCancel = (broadcast) => {
    updateBroadcast.mutate({ id: broadcast.id, data: { status: "cancelled" } });
  };

  const filtered = tab === "all" ? broadcasts : broadcasts.filter(b => b.status === tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Broadcasts</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage voice broadcast campaigns</p>
        </div>
        <Button size="sm" onClick={() => setCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Broadcast
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({broadcasts.length})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({broadcasts.filter(b => b.status === "draft").length})</TabsTrigger>
          <TabsTrigger value="in_progress">Active ({broadcasts.filter(b => b.status === "in_progress").length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({broadcasts.filter(b => b.status === "completed").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Radio className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No broadcasts found</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Create your first broadcast campaign</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(b => (
            <BroadcastCard
              key={b.id}
              broadcast={b}
              onStart={handleStart}
              onCancel={handleCancel}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <BroadcastFormDialog
        open={createDialog}
        onOpenChange={setCreateDialog}
        audioFiles={audioFiles}
        groups={groups}
        contacts={contacts}
        onSave={(data) => createBroadcast.mutate(data)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Broadcast</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteBroadcast.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}