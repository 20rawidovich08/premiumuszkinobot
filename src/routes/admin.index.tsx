import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/admin.functions";
import { Users, Film, Code2, Eye, Inbox, Send, TrendingUp, Clock } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: DashboardPage });

const STATS = [
  { key: "users",          label: "Foydalanuvchilar", icon: Users, tone: "stat-violet",  iconClass: "text-violet" },
  { key: "movies",         label: "Kinolar",          icon: Film,  tone: "stat-magenta", iconClass: "text-magenta" },
  { key: "codes",          label: "Kodlar",           icon: Code2, tone: "stat-cyan",    iconClass: "text-cyan" },
  { key: "views",          label: "Ko'rishlar",       icon: Eye,   tone: "stat-amber",   iconClass: "text-amber" },
  { key: "pendingRequests",label: "Kutilayotgan",     icon: Inbox, tone: "stat-rose",    iconClass: "text-destructive" },
  { key: "channelPosts",   label: "Kanal postlari",   icon: Send,  tone: "stat-emerald", iconClass: "text-emerald" },
] as const;

function Stat({ icon: Icon, label, value, tone, iconClass }: any) {
  return (
    <div className={`${tone} rounded-2xl p-5 border backdrop-blur-md transition hover:scale-[1.02]`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <div className={`grid place-items-center h-9 w-9 rounded-xl bg-background/40 ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 text-3xl font-display font-bold tabular-nums">{value ?? 0}</div>
    </div>
  );
}

function DashboardPage() {
  const fn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({ queryKey: ["dash"], queryFn: () => fn() });
  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Yuklanmoqda…</div>;
  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Xush kelibsiz 👋</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            Boshqaruv <span className="text-gradient-primary">paneli</span>
          </h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {STATS.map((s) => (
          <Stat key={s.key} icon={s.icon} label={s.label} value={(data.counts as any)[s.key]} tone={s.tone} iconClass={s.iconClass} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card-glow rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-magenta" />
            <h2 className="font-display font-semibold text-lg">Top kinolar</h2>
          </div>
          <ul className="space-y-1">
            {data.topMovies.map((m: any, i: number) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/30 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid place-items-center h-7 w-7 rounded-md bg-magenta/15 text-magenta text-xs font-bold tabular-nums">{i + 1}</span>
                  <span className="truncate">{m.title} {m.year ? <span className="text-muted-foreground text-sm">({m.year})</span> : ""}</span>
                </div>
                <span className="text-muted-foreground text-sm whitespace-nowrap">👁 {m.views_count}</span>
              </li>
            ))}
            {!data.topMovies.length && <p className="text-sm text-muted-foreground px-3 py-6 text-center">Hali maʼlumot yo'q.</p>}
          </ul>
        </div>

        <div className="glass-card-glow rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-cyan" />
            <h2 className="font-display font-semibold text-lg">So'nggi foydalanuvchilar</h2>
          </div>
          <ul className="space-y-1">
            {data.latestUsers.map((u: any) => (
              <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/30 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid place-items-center h-8 w-8 rounded-full bg-cyan/15 text-cyan text-xs font-bold">
                    {(u.first_name ?? u.username ?? "?").toString().slice(0, 1).toUpperCase()}
                  </div>
                  <span className="truncate">{u.first_name ?? u.username ?? u.telegram_id}</span>
                </div>
                <span className="text-muted-foreground text-sm whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</span>
              </li>
            ))}
            {!data.latestUsers.length && <p className="text-sm text-muted-foreground px-3 py-6 text-center">Hali foydalanuvchi yo'q.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
