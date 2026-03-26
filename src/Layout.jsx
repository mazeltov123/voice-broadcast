import React, { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard,
  Users,
  Music,
  Radio,
  PhoneIncoming,
  Megaphone,
  FileText,
  ShieldCheck,
  LogOut,
  BarChart2,
  ChevronLeft,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/components/useCurrentUser";
import { base44 } from "@/api/base44Client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AnimatePresence, motion } from "framer-motion";

// System dark mode
function useDarkMode() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (e) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    apply(mq);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
}

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Contacts", icon: Users, page: "Contacts" },
  { name: "Audio Library", icon: Music, page: "AudioLibrary" },
  { name: "Broadcasts", icon: Radio, page: "Broadcasts" },
  { name: "Message Board", icon: PhoneIncoming, page: "MessageBoard" },
  { name: "Call Reports", icon: FileText, page: "CallReport" },
  { name: "Analytics", icon: BarChart2, page: "Analytics" },
];

// Bottom bar: 4 primary destinations
const bottomNavItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Broadcasts", icon: Radio, page: "Broadcasts" },
  { name: "Contacts", icon: Users, page: "Contacts" },
  { name: "Messages", icon: PhoneIncoming, page: "MessageBoard" },
];

// Top-level pages (no Back button)
const topLevelPages = new Set(["Dashboard", "Broadcasts", "Contacts", "MessageBoard"]);

const pageVariants = {
  initial: { x: 16, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -16, opacity: 0 },
};

export default function Layout({ children, currentPageName }) {
  useDarkMode();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const location = useLocation();
  const navigate = useNavigate();

  const isChildScreen = !topLevelPages.has(currentPageName);
  const pageTitle = navItems.find((n) => n.page === currentPageName)?.name || currentPageName;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-card border-r border-border fixed h-full z-30">
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
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        {isAdmin && (
          <div className="px-4 pb-2">
            <Link
              to={createPageUrl("AdminPanel")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentPageName === "AdminPanel"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin Panel
            </Link>
          </div>
        )}
        <div className="p-4 border-t border-border">
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4">
            {currentUser && (
              <div className="mb-3 pb-3 border-b border-primary/10">
                <p className="text-xs font-semibold text-foreground truncate">{currentUser.full_name || currentUser.email}</p>
                <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
              </div>
            )}
            <p className="text-xs font-medium text-primary">System Status</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">All systems operational</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-start text-xs text-muted-foreground h-7 px-1"
              onClick={() => base44.auth.logout()}
            >
              <LogOut className="h-3 w-3 mr-2" /> Sign out
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full justify-start text-xs text-destructive h-7 px-1 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-2" /> Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Your account and all associated data will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => base44.auth.logout()}
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </aside>

      {/* Mobile header with safe-area + back button */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-card/90 backdrop-blur-xl border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center px-3 h-14 gap-2">
          {isChildScreen ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Megaphone className="h-4 w-4 text-white" />
            </div>
          )}
          <span className="font-semibold text-sm flex-1 truncate">
            {isChildScreen ? pageTitle : "VoiceCast"}
          </span>
          {isAdmin && (
            <Link to={createPageUrl("AdminPanel")} className="p-1 text-muted-foreground hover:text-foreground">
              <ShieldCheck className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Main content with slide transitions */}
      <main
        className="flex-1 lg:ml-64 mt-14 lg:mt-0 mb-16 lg:mb-0"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="p-4 md:p-8 max-w-7xl mx-auto"
            style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom navigation bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-card/95 backdrop-blur-xl border-t border-border grid grid-cols-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {bottomNavItems.map((item) => {
          const isActive = currentPageName === item.page;
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "stroke-2" : "stroke-[1.5]"}`} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <Toaster position="top-right" />
    </div>
  );
}