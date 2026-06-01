import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/admin.functions";
import { Users, Film, Code2, Eye, Inbox, Send } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: DashboardPage });

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </div>
  );
}

function DashboardPage() {
  const fn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({ queryKey: ["dash"], queryFn: () => fn() });
  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Yuklanmoqda…</div>;
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Boshqaruv paneli</h1>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Users} label="Foydalanuvchilar" value={data.counts.users} />
        <Stat icon={Film} label="Kinolar" value={data.counts.movies} />
        <Stat icon={Code2} label="Kodlar" value={data.counts.codes} />
        <Stat icon={Eye} label="Ko‘rishlar" value={data.counts.views} />
        <Stat icon={Inbox} label="Kutilayotgan" value={data.counts.pendingRequests} />
        <Stat icon={Send} label="Kanal postlari" value={data.counts.channelPosts} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl p-6">
          <h2 className="font-semibold mb-4">Top kinolar</h2>
          <ul className="space-y-2">
            {data.topMovies.map((m: any) => (
              <li key={m.id} className="flex items-center justify-between text-sm border-b border-border/50 py-2">
                <span>{m.title} {m.year ? `(${m.year})` : ""}</span>
                <span className="text-muted-foreground">👁 {m.views_count}</span>
              </li>
            ))}
            {!data.topMovies.length && <p className="text-sm text-muted-foreground">Hali maʼlumot yo‘q.</p>}
          </ul>
        </div>
        <div className="glass-card rounded-xl p-6">
          <h2 className="font-semibold mb-4">So‘nggi foydalanuvchilar</h2>
          <ul className="space-y-2">
            {data.latestUsers.map((u: any) => (
              <li key={u.id} className="flex items-center justify-between text-sm border-b border-border/50 py-2">
                <span>{u.first_name ?? u.username ?? u.telegram_id}</span>
                <span className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
              </li>
            ))}
            {!data.latestUsers.length && <p className="text-sm text-muted-foreground">Hali foydalanuvchi yo‘q.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
