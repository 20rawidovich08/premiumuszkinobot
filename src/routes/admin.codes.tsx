import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listAllCodes, toggleCode, deleteCode } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Search, KeyRound, Trash2, Copy, Film } from "lucide-react";

export const Route = createFileRoute("/admin/codes")({ component: CodesPage });

const MODE_LABEL: Record<string, string> = { unlimited: "Cheksiz", single: "Bir martalik", limited: "Limitli" };

function CodesPage() {
  const fn = useServerFn(listAllCodes);
  const tog = useServerFn(toggleCode);
  const del = useServerFn(deleteCode);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["all_codes"], queryFn: () => fn() });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const items = data ?? [];
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter((c: any) => c.code.toLowerCase().includes(s) || c.movie?.title?.toLowerCase().includes(s));
  }, [data, q]);

  const inv = () => qc.invalidateQueries({ queryKey: ["all_codes"] });

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Faollashtirish kodlari</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Kodlar</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish — kod yoki kino…" className="w-full md:w-80 pl-9 pr-3 py-2.5 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      {!filtered.length ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <KeyRound className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Hech qanday kod topilmadi. Kino sahifasidan yangi kod yarating.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c: any) => (
            <article key={c.id} className="glass-card rounded-2xl p-5 hover-lift flex flex-col">
              <div className="flex items-center gap-3">
                <Link to="/admin/movies/$id" params={{ id: c.movie?.id }} className="h-14 w-10 rounded-md bg-muted overflow-hidden shrink-0">
                  {c.movie?.poster_url ? (
                    <img src={c.movie.poster_url} alt={c.movie?.title} className="h-full w-full object-cover" />
                  ) : <div className="grid place-items-center h-full w-full text-muted-foreground"><Film className="h-4 w-4" /></div>}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground truncate">{c.movie?.title ?? "—"}</div>
                  <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Nusxalandi"); }}
                    className="mt-1 inline-flex items-center gap-2 font-mono font-bold text-lg hover:text-primary transition">
                    {c.code} <Copy className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="uppercase tracking-widest text-muted-foreground">Rejim</div>
                  <div className="mt-0.5">{MODE_LABEL[c.mode] ?? c.mode}{c.max_uses ? ` (${c.max_uses})` : ""}</div>
                </div>
                <div>
                  <div className="uppercase tracking-widest text-muted-foreground">Ishlatilgan</div>
                  <div className="mt-0.5 font-medium">{c.uses_count}</div>
                </div>
                <div>
                  <div className="uppercase tracking-widest text-muted-foreground">Yaratilgan</div>
                  <div className="mt-0.5">{new Date(c.created_at).toLocaleDateString("uz-UZ")}</div>
                </div>
                <div>
                  <div className="uppercase tracking-widest text-muted-foreground">Holat</div>
                  <div className="mt-0.5">
                    <span className={`text-[10px] uppercase tracking-wider rounded-md px-1.5 py-0.5 border ${c.is_active ? "bg-success/20 text-success border-success/30" : "bg-muted text-muted-foreground border-border"}`}>
                      {c.is_active ? "Faol" : "O'chirilgan"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={c.is_active} onChange={(e) => tog({ data: { id: c.id, is_active: e.target.checked } }).then(inv)} />
                  Yoqilgan
                </label>
                <button onClick={() => confirm("O'chirilsinmi?") && del({ data: { id: c.id } }).then(() => { toast.success("O'chirildi"); inv(); })} className="p-1.5 rounded-md hover:bg-accent/50 hover:text-destructive transition"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
