import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { LayoutDashboard, Film, Users, Inbox, Settings, LogOut, Sparkles } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

const nav = [
  { to: "/admin", label: "Boshqaruv", icon: LayoutDashboard, exact: true, accent: "text-violet" },
  { to: "/admin/movies", label: "Kinolar", icon: Film, accent: "text-magenta" },
  { to: "/admin/users", label: "Foydalanuvchilar", icon: Users, accent: "text-cyan" },
  { to: "/admin/requests", label: "Buyurtmalar", icon: Inbox, accent: "text-amber" },
  { to: "/admin/settings", label: "Sozlamalar", icon: Settings, accent: "text-emerald" },
];

function AdminLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !session) navigate({ to: "/login" }); }, [loading, session, navigate]);
  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Yuklanmoqda…</div>;
  }
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-hero">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border/40 backdrop-blur-md bg-background/40 px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-magenta" />
              <span className="text-sm text-muted-foreground">Admin paneli</span>
            </div>
          </header>
          <main className="flex-1 overflow-x-auto"><Outlet /></main>
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
      <SidebarContent>
        <div className="px-4 py-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="grid place-items-center h-8 w-8 rounded-lg btn-gradient">
            <Film className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="font-display font-bold text-lg leading-none">
              Cine<span className="text-gradient-primary">Bot</span>
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((n) => {
                const active = isActive(n);
                return (
                  <SidebarMenuItem key={n.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={n.label}>
                      <Link to={n.to} className="flex items-center gap-3">
                        <n.icon className={`h-4 w-4 ${active ? "" : n.accent}`} />
                        {!collapsed && <span>{n.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto p-2 border-t border-sidebar-border">
        <button
          onClick={() => signOut().then(() => navigate({ to: "/login" }))}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition"
        >
          <LogOut className="h-4 w-4 text-destructive" />
          {!collapsed && <span>Chiqish</span>}
        </button>
      </div>
    </Sidebar>
  );
}
