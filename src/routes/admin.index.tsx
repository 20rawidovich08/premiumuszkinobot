import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats, getActivityFeed, getBotStatus } from "@/lib/admin.functions";
import {
  Users, Film, KeyRound, Eye, Inbox, Megaphone,
  TrendingUp, Activity, Radio, Bot,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: DashboardPage });

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return `${s} soniya oldin`;
  const m = Math.floor(s / 60); if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} soat oldin`;
  const d = Math.floor(h / 24); return `${d} kun oldin`;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 hover-lift">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className={`relative grid place-items-center h-2.5 w-2.5 rounded-full ${ok ? "bg-success" : "bg-destructive"}`}>
          {ok && <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />}
        </span>
      </div>
      <div className="mt-3 text-2xl font-display font-bold">
        {ok ? "Faol" : "Nofaol"}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {ok ? "Hammasi joyida" : "Tekshirib ko'ring"}
      </div>
    </div>
  );
}

function Widget({ icon: Icon, label, value, tone, iconClass }: any) {
  return (
    <div className={`${tone} rounded-2xl p-5 border backdrop-blur-md hover-lift`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">{label}</span>
        <div className={`grid place-items-center h-10 w-10 rounded-xl bg-background/40 ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 text-3xl font-display font-bold tabular-nums">{value ?? 0}</div>
    </div>
  );
}

function DashboardPage() {
  const fn = useServerFn(getDashboardStats);
  const feedFn = useServerFn(getActivityFeed);
  const statusFn = useServerFn(getBotStatus);
  const { data } = useQuery({ queryKey: ["dash"], queryFn: () => fn() });
  const { data: feed } = useQuery({ queryKey: ["feed"], queryFn: () => feedFn(), refetchInterval: 15000 });
  const { data: status } = useQuery({ queryKey: ["bot-status"], queryFn: () => statusFn(), refetchInterval: 30000 });

  if (!data) return <div className="p-8 text-muted-foreground">Yuklanmoqda…</div>;

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Xush kelibsiz 👋</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            Boshqaruv <span className="text-gradient-primary">paneli</span>
          </h1>
        </div>
        <div className="text-xs text-muted-foreground">
          Yangilangan: {new Date().toLocaleString("uz-UZ")}
        </div>
      </div>

      {/* Top: status + key counters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatusPill ok={!!status?.bot} label="🟢 Bot holati" />
        <StatusPill ok={!!status?.channel} label="📡 Kanal holati" />
        <Widget icon={Users}      label="👥 Foydalanuvchilar" value={data.counts.users}        tone="stat-violet"  iconClass="text-violet" />
        <Widget icon={Film}       label="🎬 Kinolar"          value={data.counts.movies}       tone="stat-magenta" iconClass="text-magenta" />
        <Widget icon={KeyRound}   label="🔑 Faol kodlar"      value={status?.activeCodes ?? 0} tone="stat-amber"   iconClass="text-amber" />
        <Widget icon={Megaphone}  label="📢 Kanal postlari"   value={data.counts.channelPosts} tone="stat-emerald" iconClass="text-emerald" />
      </div>

      {/* Secondary counters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Widget icon={Eye}   label="Jami ko'rishlar"        value={data.counts.views}           tone="stat-cyan"  iconClass="text-cyan" />
        <Widget icon={Inbox} label="Kutilayotgan buyurtma"  value={data.counts.pendingRequests} tone="stat-rose"  iconClass="text-destructive" />
        <Widget icon={KeyRound} label="Jami kodlar"         value={data.counts.codes}           tone="stat-magenta" iconClass="text-magenta" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Activity Feed */}
        <section className="lg:col-span-3 glass-card-glow rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet" />
              <h2 className="font-display font-semibold text-lg">Jonli faollik oqimi</h2>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative grid place-items-center h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-success" />
              </span>
              Real vaqtda
            </div>
          </div>
          <ul className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
            {(feed ?? []).map((e: any, i: number) => (
              <li key={i} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-accent/30 transition">
                <span className="text-lg leading-none mt-0.5">{e.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{e.text}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{timeAgo(e.at)}</div>
                </div>
              </li>
            ))}
            {!feed?.length && <p className="text-sm text-muted-foreground px-3 py-10 text-center">Hozircha hech qanday faollik yo'q.</p>}
          </ul>
        </section>

        {/* Top movies + quick links */}
        <section className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-magenta" />
              <h2 className="font-display font-semibold text-lg">Eng ko'p ko'rilgan</h2>
            </div>
            <ul className="space-y-1">
              {data.topMovies.map((m: any, i: number) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/30 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid place-items-center h-7 w-7 rounded-md bg-magenta/15 text-magenta text-xs font-bold tabular-nums">{i + 1}</span>
                    <Link to="/admin/movies/$id" params={{ id: m.id }} className="truncate hover:text-primary">
                      {m.title} {m.year ? <span className="text-muted-foreground text-sm">({m.year})</span> : ""}
                    </Link>
                  </div>
                  <span className="text-muted-foreground text-sm whitespace-nowrap">👁 {m.views_count}</span>
                </li>
              ))}
              {!data.topMovies.length && <p className="text-sm text-muted-foreground px-3 py-6 text-center">Hali ma'lumot yo'q.</p>}
            </ul>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-cyan" />
              <h2 className="font-display font-semibold text-lg">Tezkor amallar</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/admin/movies" className="rounded-lg border border-border/60 px-3 py-3 text-sm hover:bg-accent/40 transition flex items-center gap-2"><Film className="h-4 w-4 text-magenta" /> Kino qo'shish</Link>
              <Link to="/admin/codes" className="rounded-lg border border-border/60 px-3 py-3 text-sm hover:bg-accent/40 transition flex items-center gap-2"><KeyRound className="h-4 w-4 text-amber" /> Kod yaratish</Link>
              <Link to="/admin/posts" className="rounded-lg border border-border/60 px-3 py-3 text-sm hover:bg-accent/40 transition flex items-center gap-2"><Megaphone className="h-4 w-4 text-emerald" /> Kanal postlari</Link>
              <Link to="/admin/settings" className="rounded-lg border border-border/60 px-3 py-3 text-sm hover:bg-accent/40 transition flex items-center gap-2"><Radio className="h-4 w-4 text-violet" /> Webhook</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
