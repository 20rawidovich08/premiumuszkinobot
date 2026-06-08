import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Film, Tv, KeyRound, Megaphone, Users, Inbox,
  BarChart3, Settings, LogOut, Sparkles,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

const nav = [
  { to: "/admin",          label: "Boshqaruv paneli", emoji: "🏠", icon: LayoutDashboard, exact: true },
  { to: "/admin/movies",   label: "Kinolar",          emoji: "🎬", icon: Film },
  { to: "/admin/series",   label: "Seriallar",        emoji: "📺", icon: Tv },
  { to: "/admin/codes",    label: "Kodlar",           emoji: "🔑", icon: KeyRound },
  { to: "/admin/posts",    label: "Kanal postlari",   emoji: "📢", icon: Megaphone },
  { to: "/admin/users",    label: "Foydalanuvchilar", emoji: "👥", icon: Users },
  { to: "/admin/requests", label: "Buyurtmalar",      emoji: "📥", icon: Inbox },
  { to: "/admin/stats",    label: "Statistika",       emoji: "📊", icon: BarChart3 },
  { to: "/admin/settings", label: "Sozlamalar",       emoji: "⚙️", icon: Settings },
];

function AdminLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !session) navigate({ to: "/login" }); }, [loading, session, navigate]);
  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground bg-app">Yuklanmoqda…</div>;
  }
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-app">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center gap-3 border-b border-border/40 backdrop-blur-xl bg-background/60 px-5 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <span className="relative grid place-items-center h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-sm text-muted-foreground">Tizim ishlamoqda</span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet" />
              <span>Premium Telegram Kino Boshqaruv Markazi</span>
            </div>
          </header>
          <main className="flex-1 overflow-x-auto animate-fade-in"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const isActive = (n: typeof nav[number]) => n.exact ? path === n.to : path.startsWith(n.to);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-sidebar">
        <div className="px-4 py-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="grid place-items-center h-9 w-9 rounded-xl btn-gradient ring-glow">
            <Film className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display font-bold text-base">
                Cine<span className="text-gradient-primary">Bot</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Boshqaruv markazi</div>
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-2 py-3">
              {nav.map((n) => {
                const active = isActive(n);
                return (
                  <SidebarMenuItem key={n.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={n.label} className="h-10">
                      <Link to={n.to} className="flex items-center gap-3 rounded-lg">
                        <span className={`text-base leading-none ${active ? "" : "opacity-90"}`}>{n.emoji}</span>
                        {!collapsed && <span className="text-sm">{n.label}</span>}
                        {!collapsed && active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto p-3 border-t border-sidebar-border bg-sidebar">
        <button
          onClick={() => signOut().then(() => navigate({ to: "/login" }))}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition"
        >
          <LogOut className="h-4 w-4 text-destructive" />
          {!collapsed && <span>Chiqish</span>}
        </button>
      </div>
    </Sidebar>
  );
}
