import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, PhoneIncoming, Info, MessageSquare, Download } from "lucide-react";
import InboundMessageRow from "@/components/messageboard/InboundMessageRow";
import InboundSmsRow from "@/components/messageboard/InboundSmsRow";
import ImportCallHistoryDialog from "@/components/messageboard/ImportCallHistoryDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function MessageBoard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [section, setSection] = useState("calls");
  const [showImport, setShowImport] = useState(false);
  const audioRef = useRef(null);
  const [playingUrl, setPlayingUrl] = useState(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["inbound"],
    queryFn: () => base44.entities.InboundMessage.list("-created_date"),
  });

  const { data: smsList = [], isLoading: smsLoading } = useQuery({
    queryKey: ["inboundSms"],
    queryFn: () => base44.entities.InboundSms.list("-created_date"),
  });

  const updateMessage = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InboundMessage.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inbound"] }),
  });

  const updateSms = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InboundSms.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inboundSms"] }),
  });

  const handleStatusChange = (message, status) => {
    updateMessage.mutate({ id: message.id, data: { status } });
  };

  const handleSmsStatusChange = (sms, status) => {
    updateSms.mutate({ id: sms.id, data: { status } });
  };

  const handlePlay = (message) => {
    if (playingUrl === message.recording_url) {
      audioRef.current?.pause();
      setPlayingUrl(null);
    } else {
      setPlayingUrl(message.recording_url);
    }
  };

  useEffect(() => {
    if (playingUrl && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().catch(() => {
        setPlayingUrl(null);
      });
    }
  }, [playingUrl]);

  const filtered = messages.filter(m => {
    const matchesSearch = !search || `${m.caller_name} ${m.caller_phone} ${m.broadcast_name}`.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === "all" || m.status === tab;
    return matchesSearch && matchesTab;
  });

  const filteredSms = smsList.filter(m => {
    const matchesSearch = !search || `${m.sender_name} ${m.from_number} ${m.body}`.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === "all" || m.status === tab;
    return matchesSearch && matchesTab;
  });

  const newCount = messages.filter(m => m.status === "new").length;
  const newSmsCount = smsList.filter(m => m.status === "new").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Message Board</h1>
        <p className="text-sm text-muted-foreground mt-1">Inbound calls and SMS messages</p>
      </div>

      {/* Section toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSection("calls")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === "calls" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <PhoneIncoming className="h-4 w-4" />
          Calls {newCount > 0 && <span className="ml-1 bg-white/20 rounded-full px-1.5 text-xs">{newCount}</span>}
        </button>
        <button
          onClick={() => setSection("sms")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === "sms" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <MessageSquare className="h-4 w-4" />
          SMS {newSmsCount > 0 && <span className="ml-1 bg-white/20 rounded-full px-1.5 text-xs">{newSmsCount}</span>}
        </button>
      </div>

      {section === "calls" && (
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200/50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-900">IVR Voice Portal</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                When recipients call back, the IVR menu plays previous broadcast messages in descending date order (newest first).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {section === "calls" ? (
        isLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <PhoneIncoming className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No inbound calls</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(m => (
              <InboundMessageRow key={m.id} message={m} onStatusChange={handleStatusChange} onPlay={handlePlay} />
            ))}
          </div>
        )
      ) : (
        smsLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : filteredSms.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No inbound SMS messages</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Point your Telnyx webhook to the <strong>smsInbound</strong> function URL</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSms.map(m => (
              <InboundSmsRow key={m.id} sms={m} onStatusChange={handleSmsStatusChange} />
            ))}
          </div>
        )
      )}

      <audio ref={audioRef} src={playingUrl || ""} onEnded={() => setPlayingUrl(null)} className="hidden" />
    </div>
  );
}