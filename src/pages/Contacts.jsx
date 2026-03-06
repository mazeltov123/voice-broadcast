import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search, Upload, Users, FolderOpen, Trash2, Pencil } from "lucide-react";
import ContactFormDialog from "@/components/contacts/ContactFormDialog";
import GroupFormDialog from "@/components/contacts/GroupFormDialog";
import ContactTable from "@/components/contacts/ContactTable";
import { Card, CardContent } from "@/components/ui/card";
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

export default function Contacts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [contactDialog, setContactDialog] = useState(false);
  const [groupDialog, setGroupDialog] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filterGroup, setFilterGroup] = useState("all");
  const [importDialog, setImportDialog] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list(),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.ContactGroup.list(),
  });

  const createContact = useMutation({
    mutationFn: (data) => base44.entities.Contact.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); setContactDialog(false); },
  });
  const updateContact = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contact.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); setContactDialog(false); setEditingContact(null); },
  });
  const deleteContact = useMutation({
    mutationFn: (id) => base44.entities.Contact.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); setDeleteTarget(null); },
  });
  const createGroup = useMutation({
    mutationFn: (data) => base44.entities.ContactGroup.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); setGroupDialog(false); },
  });
  const updateGroup = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContactGroup.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); setGroupDialog(false); setEditingGroup(null); },
  });
  const deleteGroup = useMutation({
    mutationFn: (id) => base44.entities.ContactGroup.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const loadingToast = toast.loading("Importing contacts...");
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              last_name: { type: "string" },
              first_name: { type: "string" },
              phone1: { type: "string" },
              phone2: { type: "string" },
              phone3: { type: "string" },
            },
          },
        },
      });
      
      if (result.status === "success" && Array.isArray(result.output)) {
        // Each row with multiple phones becomes multiple contacts
        const contacts = [];
        for (const c of result.output) {
          const base = { first_name: c.first_name || "", last_name: c.last_name || "", status: "active", groups: [] };
          if (c.phone1) contacts.push({ ...base, phone_number: c.phone1 });
          if (c.phone2) contacts.push({ ...base, phone_number: c.phone2 });
          if (c.phone3) contacts.push({ ...base, phone_number: c.phone3 });
          // fallback if no phone columns matched
          if (!c.phone1 && !c.phone2 && !c.phone3) contacts.push({ ...base, phone_number: "" });
        }
        await base44.entities.Contact.bulkCreate(contacts);
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        toast.success(`Successfully imported ${contacts.length} contacts`, { id: loadingToast });
      } else {
        toast.error(result.details || "Failed to import contacts", { id: loadingToast });
      }
    } catch (error) {
      toast.error("Failed to import contacts. Please check your file format.", { id: loadingToast });
    }
    
    e.target.value = "";
  };

  const filtered = contacts.filter(c => {
    const matchesSearch = !search || `${c.first_name} ${c.last_name} ${c.phone_number} ${c.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = filterGroup === "all" || (c.groups || []).includes(filterGroup);
    return matchesSearch && matchesGroup;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Address Book</h1>
          <p className="text-sm text-muted-foreground mt-1">{contacts.length} contacts across {groups.length} groups</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImportCSV} />
            <Button variant="outline" size="sm" asChild>
              <span><Upload className="h-4 w-4 mr-1.5" /> Import</span>
            </Button>
          </label>
          <Button size="sm" variant="outline" onClick={() => { setEditingGroup(null); setGroupDialog(true); }}>
            <FolderOpen className="h-4 w-4 mr-1.5" /> New Group
          </Button>
          <Button size="sm" onClick={() => { setEditingContact(null); setContactDialog(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Contact
          </Button>
        </div>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts"><Users className="h-3.5 w-3.5 mr-1.5" />Contacts</TabsTrigger>
          <TabsTrigger value="groups"><FolderOpen className="h-3.5 w-3.5 mr-1.5" />Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Badge
                variant={filterGroup === "all" ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setFilterGroup("all")}
              >
                All ({contacts.length})
              </Badge>
              {groups.map(g => (
                <Badge
                  key={g.id}
                  variant={filterGroup === g.id ? "default" : "outline"}
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => setFilterGroup(g.id)}
                  style={filterGroup === g.id ? { backgroundColor: g.color } : { borderColor: g.color, color: g.color }}
                >
                  {g.name} ({contacts.filter(c => (c.groups || []).includes(g.id)).length})
                </Badge>
              ))}
            </div>
          </div>
          <ContactTable
            contacts={filtered}
            groups={groups}
            onEdit={(c) => { setEditingContact(c); setContactDialog(true); }}
            onDelete={(c) => setDeleteTarget(c)}
          />
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(g => (
              <Card key={g.id} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: g.color + "20" }}>
                        <FolderOpen className="h-5 w-5" style={{ color: g.color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{contacts.filter(c => (c.groups || []).includes(g.id)).length} contacts</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingGroup(g); setGroupDialog(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteGroup.mutate(g.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {g.description && <p className="text-xs text-muted-foreground mt-3">{g.description}</p>}
                </CardContent>
              </Card>
            ))}
            {groups.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm">No groups created yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ContactFormDialog
        open={contactDialog}
        onOpenChange={setContactDialog}
        contact={editingContact}
        groups={groups}
        onSave={(data) => {
          if (editingContact) {
            updateContact.mutate({ id: editingContact.id, data });
          } else {
            createContact.mutate(data);
          }
        }}
      />
      <GroupFormDialog
        open={groupDialog}
        onOpenChange={setGroupDialog}
        group={editingGroup}
        onSave={(data) => {
          if (editingGroup) {
            updateGroup.mutate({ id: editingGroup.id, data });
          } else {
            createGroup.mutate(data);
          }
        }}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.first_name} {deleteTarget?.last_name}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteContact.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}