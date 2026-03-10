import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Phone, PhoneCall, MessageSquare } from "lucide-react";

const statusStyles = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-50 text-slate-600 border-slate-200",
  do_not_call: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function ContactTable({ contacts, groups, onEdit, onDelete, selectedIds = [], onSelectionChange, onSendCalls }) {
  const getGroupName = (groupId) => {
    const g = (groups || []).find(g => g.id === groupId);
    return g ? g : null;
  };

  const allSelected = contacts.length > 0 && contacts.every(c => selectedIds.includes(c.id));
  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(contacts.map(c => c.id));
    }
  };
  const toggleOne = (id) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(x => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-white overflow-hidden">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-border/50">
          <span className="text-sm font-medium text-primary">{selectedIds.length} contact{selectedIds.length > 1 ? 's' : ''} selected</span>
          <Button size="sm" onClick={onSendCalls} className="gap-2">
            <PhoneCall className="h-4 w-4" /> Send Call to Selected
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            </TableHead>
            <TableHead className="text-xs font-semibold">Name</TableHead>
            <TableHead className="text-xs font-semibold">Phone</TableHead>
            <TableHead className="text-xs font-semibold hidden md:table-cell">Email</TableHead>
            <TableHead className="text-xs font-semibold hidden sm:table-cell">Groups</TableHead>
            <TableHead className="text-xs font-semibold">Status</TableHead>
            <TableHead className="text-xs font-semibold w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                No contacts yet. Add your first contact to get started.
              </TableCell>
            </TableRow>
          ) : (
            contacts.map(contact => (
              <TableRow key={contact.id} className={`hover:bg-muted/20 transition-colors ${selectedIds.includes(contact.id) ? 'bg-primary/5' : ''}`}>
                <TableCell>
                  <Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={() => toggleOne(contact.id)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {(contact.first_name?.[0] || "").toUpperCase()}{(contact.last_name?.[0] || "").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{contact.first_name} {contact.last_name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {contact.phone_number}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-muted-foreground">{contact.email || "—"}</span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {(contact.groups || []).map(gId => {
                      const group = getGroupName(gId);
                      return group ? (
                        <Badge key={gId} variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: group.color, color: group.color }}>
                          {group.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusStyles[contact.status] || ""}`}>
                    {contact.status?.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(contact)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(contact)} className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}