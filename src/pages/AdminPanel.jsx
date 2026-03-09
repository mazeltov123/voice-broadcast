import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/components/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, ShieldCheck, Radio, Phone, UserPlus, Mail, Music, Upload, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function AdminPanel() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [emailList, setEmailList] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [uploadingGreeting, setUploadingGreeting] = useState(false);
  const [uploadingAnnouncement, setUploadingAnnouncement] = useState(false);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(),
    enabled: currentUser?.role === "admin",
  });

  const { data: broadcasts = [] } = useQuery({
    queryKey: ["allBroadcasts"],
    queryFn: () => base44.entities.Broadcast.list("-created_date"),
    enabled: currentUser?.role === "admin",
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["allContacts"],
    queryFn: () => base44.entities.Contact.list(),
    enabled: currentUser?.role === "admin",
  });

  const { data: callReports = [] } = useQuery({
    queryKey: ["allCallReports"],
    queryFn: () => base44.entities.CallReport.list("-called_at"),
    enabled: currentUser?.role === "admin",
  });

  const { data: ivrSettingsList = [] } = useQuery({
    queryKey: ["ivrSettings"],
    queryFn: () => base44.entities.IvrSettings.list(),
    enabled: currentUser?.role === "admin",
  });
  const ivrSettings = ivrSettingsList[0] || {};

  const uploadIvrFile = async (file, field, setUploading) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const update = { [field]: file_url };
    if (ivrSettings.id) {
      await base44.entities.IvrSettings.update(ivrSettings.id, update);
    } else {
      await base44.entities.IvrSettings.create(update);
    }
    queryClient.invalidateQueries({ queryKey: ["ivrSettings"] });
    toast.success("File uploaded successfully");
    setUploading(false);
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Admin access only</p>
        </div>
      </div>
    );
  }

  const addEmail = () => {
    const trimmed = inviteEmail.trim();
    if (!trimmed || emailList.includes(trimmed)) return;
    setEmailList(prev => [...prev, trimmed]);
    setInviteEmail("");
  };

  const removeEmail = (email) => setEmailList(prev => prev.filter(e => e !== email));

  const handleInvite = async () => {
    const toInvite = emailList.length > 0 ? emailList : inviteEmail.trim() ? [inviteEmail.trim()] : [];
    if (toInvite.length === 0) return;
    setInviting(true);
    let success = 0, failed = 0;
    for (const email of toInvite) {
      try {
        await base44.users.inviteUser(email, "user");
        success++;
      } catch {
        failed++;
      }
    }
    if (success > 0) toast.success(`Invitation${success > 1 ? "s" : ""} sent to ${success} user${success > 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`Failed to send ${failed} invitation${failed > 1 ? "s" : ""}`);
    setEmailList([]);
    setInviteEmail("");
    setInviteDialog(false);
    setInviting(false);
  };

  // Group broadcasts by user
  const broadcastsByUser = users.map(u => ({
    ...u,
    broadcasts: broadcasts.filter(b => b.created_by === u.email),
    contacts: contacts.filter(c => c.created_by === u.email),
    callReports: callReports.filter(r => r.created_by === u.email),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage users and view all activity</p>
        </div>
        <Button onClick={() => setInviteDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "text-primary" },
          { label: "Total Broadcasts", value: broadcasts.length, icon: Radio, color: "text-blue-600" },
          { label: "Total Contacts", value: contacts.length, icon: Users, color: "text-emerald-600" },
          { label: "Total Call Reports", value: callReports.length, icon: Phone, color: "text-orange-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-semibold">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Broadcasts</TableHead>
                <TableHead>Call Reports</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : broadcastsByUser.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                </TableRow>
              ) : (
                broadcastsByUser.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "outline"} className="text-xs">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{u.contacts.length}</TableCell>
                    <TableCell>{u.broadcasts.length}</TableCell>
                    <TableCell>{u.callReports.length}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.created_date ? format(new Date(u.created_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={inviteDialog} onOpenChange={(open) => { setInviteDialog(open); if (!open) { setEmailList([]); setInviteEmail(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Users</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Email Address</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="user@example.com"
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  />
                </div>
                <Button type="button" variant="outline" onClick={addEmail} disabled={!inviteEmail.trim()}>Add</Button>
              </div>
            </div>
            {emailList.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Queue ({emailList.length})</Label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {emailList.map(email => (
                    <span key={email} className="inline-flex items-center gap-1 bg-muted text-xs rounded-md px-2 py-1">
                      {email}
                      <button onClick={() => removeEmail(email)} className="text-muted-foreground hover:text-foreground ml-1">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={(!inviteEmail.trim() && emailList.length === 0) || inviting}>
              {inviting ? "Sending..." : `Send Invite${emailList.length > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}