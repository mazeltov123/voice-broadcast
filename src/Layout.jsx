import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Users,
  Music,
  Radio,
  PhoneIncoming,
  Menu,
  X,
  Megaphone
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Contacts", icon: Users, page: "Contacts" },
  { name: "Audio Library", icon: Music, page: "AudioLibrary" },
  { name: "Broadcasts", icon: Radio, page: "Broadcasts" },
  { name: "Message Board", icon: PhoneIncoming, page: "MessageBoard" },
];

export default function Layout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-border fixed h-full z-30">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">VoiceCast</h1>
              <p className="text-xs text-muted-foreground">Broadcast System</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4">
            <p className="text-xs font-medium text-primary">System Status</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">All systems operational</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm">VoiceCast</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-14 left-0 right-0 bg-white border-b border-border shadow-xl p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4.5 w-4.5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-64 mt-14 lg:mt-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}