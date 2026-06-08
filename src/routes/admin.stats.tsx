import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getStatsOverview } from "@/lib/admin.functions";
import { BarChart3, TrendingUp, Users, Film } from "lucide-react";

export const Route = createFileRoute("/admin/stats")({ component: StatsPage });

function Chart({ data, color, label }: { data: { day: string; value: number }[]; color: string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold">{label}</h2>
        <span className="text-xs text-muted-foreground">So'nggi 14 kun</span>
      </div>
      <div className="flex items-end gap-1.5 h-44">
        {data.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="w-full rounded-md transition hover:opacity-80 relative"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: 4, background: color }}>
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] opacity-0 group-hover:opacity-100 bg-background border border-border rounded px-1.5 py-0.5 whitespace-nowrap">
                {d.value}
              </div>
            </div>
            <div className="text-[9px] text-muted-foreground">{d.day.slice(5)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsPage() {
  const fn = useServerFn(getStatsOverview);
  const { data } = useQuery({ queryKey: ["stats"], queryFn: () => fn() });

  if (!data) return <div className="p-8 text-muted-foreground">Yuklanmoqda…</div>;

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-violet" />
        <div>
          <p className="text-sm text-muted-foreground">Tahliliy ko'rsatkichlar</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Statistika</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Chart data={data.viewsSeries} color="linear-gradient(180deg, oklch(0.7 0.22 295), oklch(0.5 0.22 295))" label="📈 Ko'rishlar dinamikasi" />
        <Chart data={data.usersSeries} color="linear-gradient(180deg, oklch(0.72 0.18 158), oklch(0.5 0.18 158))" label="👥 Yangi foydalanuvchilar" />
      </div>

      <div className="glass-card-glow rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-magenta" />
          <h2 className="font-display font-semibold">Top 10 kinolar</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.topMovies.map((m: any, i: number) => (
            <Link key={m.id} to="/admin/movies/$id" params={{ id: m.id }} className="flex items-center gap-3 rounded-xl p-3 hover:bg-accent/40 transition">
              <span className="grid place-items-center h-8 w-8 rounded-md bg-magenta/15 text-magenta text-xs font-bold">{i + 1}</span>
              <div className="h-14 w-10 rounded-md bg-muted overflow-hidden shrink-0">
                {m.poster_url ? <img src={m.poster_url} alt={m.title} className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-muted-foreground"><Film className="h-4 w-4" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.title}</div>
                <div className="text-xs text-muted-foreground">{m.year ?? ""}</div>
              </div>
              <div className="text-sm tabular-nums text-muted-foreground">👁 {m.views_count}</div>
            </Link>
          ))}
          {!data.topMovies.length && <p className="text-sm text-muted-foreground py-8 text-center">Ma'lumot yo'q.</p>}
        </div>
      </div>
    </div>
  );
}
