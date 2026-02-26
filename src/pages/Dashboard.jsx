import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, Radio, Music, PhoneIncoming, Megaphone } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list(),
  });
  const { data: broadcasts = [], isLoading: loadingBroadcasts } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => base44.entities.Broadcast.list("-created_date", 20),
  });
  const { data: audioFiles = [] } = useQuery({
    queryKey: ["audioFiles"],
    queryFn: () => base44.entities.AudioFile.list(),
  });
  const { data: inbound = [] } = useQuery({
    queryKey: ["inbound"],
    queryFn: () => base44.entities.InboundMessage.list("-created_date", 20),
  });

  const activeBroadcasts = broadcasts.filter(b => b.status === "in_progress").length;
  const totalDelivered = broadcasts.reduce((acc, b) => acc + (b.delivered || 0), 0);
  const loading = loadingContacts || loadingBroadcasts;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your voice broadcast system</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total Contacts"
            value={contacts.length}
            subtitle={`${contacts.filter(c => c.status === "active").length} active`}
            icon={Users}
            color="primary"
          />
          <StatCard
            title="Broadcasts"
            value={broadcasts.length}
            subtitle={`${activeBroadcasts} active now`}
            icon={Radio}
            color="emerald"
          />
          <StatCard
            title="Audio Files"
            value={audioFiles.length}
            subtitle="In library"
            icon={Music}
            color="violet"
          />
          <StatCard
            title="Calls Delivered"
            value={totalDelivered}
            subtitle="All time"
            icon={Megaphone}
            color="amber"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity broadcasts={broadcasts} inboundMessages={inbound} />
        
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-semibold">Quick Broadcast</h3>
            <p className="text-sm text-white/70 mt-1">
              Send a voice message to your contacts in seconds
            </p>
            <div className="flex gap-3 mt-4">
              <a
                href={"/Broadcasts"}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = "/Broadcasts";
                }}
                className="inline-flex items-center gap-2 bg-white text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
              >
                <Radio className="h-4 w-4" />
                New Broadcast
              </a>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-semibold">Inbound Portal</h3>
            <p className="text-sm text-white/70 mt-1">
              {inbound.filter(m => m.status === "new").length} new messages waiting for review
            </p>
            <div className="flex items-center gap-2 mt-3">
              <PhoneIncoming className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/80">IVR plays messages newest first</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}