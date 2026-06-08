import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listBotUsers } from "@/lib/admin.functions";
import { Search, Users as UsersIcon, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

function initials(u: any) {
  return (u.first_name ?? u.username ?? "?").toString().slice(0, 2).toUpperCase();
}

function UsersPage() {
  const fn = useServerFn(listBotUsers);
  const { data } = useQuery({ queryKey: ["bot_users"], queryFn: () => fn() });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const items = data ?? [];
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter((u: any) =>
      [u.first_name, u.last_name, u.username, String(u.telegram_id)].some((v) => (v ?? "").toLowerCase().includes(s))
    );
  }, [data, q]);

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Bot foydalanuvchilari</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Foydalanuvchilar</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish — ism, username, ID…" className="w-full md:w-80 pl-9 pr-3 py-2.5 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      {!filtered.length ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <UsersIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Hali foydalanuvchi yo'q.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((u: any) => (
            <article key={u.id} className="glass-card rounded-2xl p-5 hover-lift">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-12 w-12 rounded-xl bg-gradient-to-br from-violet/30 to-magenta/30 text-foreground font-display font-bold ring-1 ring-border">
                  {initials(u)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{u.first_name} {u.last_name ?? ""}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.username ? `@${u.username}` : `ID ${u.telegram_id}`}
                  </div>
                </div>
                {u.is_blocked && <span className="text-[10px] uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-destructive/20 text-destructive border border-destructive/30">Bloklangan</span>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Telegram ID</div>
                  <div className="font-mono text-xs mt-0.5">{u.telegram_id}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Ko'rilgan</div>
                  <div className="inline-flex items-center gap-1 mt-0.5"><Eye className="h-3 w-3 text-cyan" /> {u.movies_watched}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Qo'shilgan</div>
                  <div className="text-xs mt-0.5">{new Date(u.created_at).toLocaleDateString("uz-UZ")}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">So'nggi faollik</div>
                  <div className="text-xs mt-0.5">{new Date(u.last_activity_at).toLocaleDateString("uz-UZ")}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
