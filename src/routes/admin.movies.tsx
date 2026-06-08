import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listMovies, upsertMovie, deleteMovie, postMovieToChannel } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Plus, Trash2, Send, Pencil, Search, Film, Eye, Star } from "lucide-react";

export const Route = createFileRoute("/admin/movies")({ component: MoviesPage });

function MoviesPage() {
  const list = useServerFn(listMovies);
  const save = useServerFn(upsertMovie);
  const del = useServerFn(deleteMovie);
  const post = useServerFn(postMovieToChannel);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["movies"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const items = data ?? [];
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter((m: any) =>
      [m.title, m.genre, m.country, String(m.year ?? "")].some((v) => (v ?? "").toLowerCase().includes(s))
    );
  }, [data, q]);

  const saveM = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => { toast.success("Saqlandi"); setEditing(null); qc.invalidateQueries({ queryKey: ["movies"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("O'chirildi"); qc.invalidateQueries({ queryKey: ["movies"] }); },
  });
  const postM = useMutation({
    mutationFn: (id: string) => post({ data: { movie_id: id } }),
    onSuccess: () => toast.success("Kanalga yuborildi"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Kontent katalogi</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Kinolar</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Qidirish — nomi, janri, yili…"
              className="w-full md:w-80 pl-9 pr-3 py-2.5 rounded-xl bg-input border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button onClick={() => setEditing({})} className="inline-flex items-center justify-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-sm font-medium">
            <Plus className="h-4 w-4" /> Kino qo'shish
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Yuklanmoqda…</p>
      ) : !filtered.length ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <Film className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Hech qanday kino topilmadi.</p>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((m: any) => (
            <article key={m.id} className="group glass-card rounded-2xl overflow-hidden hover-lift flex flex-col">
              <Link to="/admin/movies/$id" params={{ id: m.id }} className="block relative aspect-[2/3] bg-muted overflow-hidden">
                {m.poster_url ? (
                  <img src={m.poster_url} alt={m.title} className="w-full h-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-muted-foreground"><Film className="h-10 w-10" /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent opacity-90" />
                <div className="absolute top-2 left-2 flex gap-1.5">
                  {m.is_published ? (
                    <span className="text-[10px] uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-success/20 text-success border border-success/30">E'lon</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-muted text-muted-foreground border border-border">Qoralama</span>
                  )}
                </div>
                {m.imdb_rating != null && (
                  <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-background/70 backdrop-blur px-1.5 py-0.5 text-[11px] font-medium">
                    <Star className="h-3 w-3 text-amber" /> {m.imdb_rating}
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="text-sm font-semibold leading-tight line-clamp-2">{m.title}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2">
                    {m.year && <span>{m.year}</span>}
                    {m.genre && <span>• {m.genre}</span>}
                  </div>
                </div>
              </Link>
              <div className="p-3 flex items-center justify-between gap-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {m.views_count}</div>
                <div className="flex items-center gap-1">
                  <button onClick={() => postM.mutate(m.id)} title="Kanalga yuborish" className="p-1.5 rounded-md hover:bg-accent/50 hover:text-emerald transition"><Send className="h-4 w-4" /></button>
                  <button onClick={() => setEditing(m)} title="Tahrirlash" className="p-1.5 rounded-md hover:bg-accent/50 hover:text-primary transition"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => confirm("O'chirilsinmi?") && delM.mutate(m.id)} title="O'chirish" className="p-1.5 rounded-md hover:bg-accent/50 hover:text-destructive transition"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && <MovieDialog initial={editing} onClose={() => setEditing(null)} onSave={(v: any) => saveM.mutate(v)} busy={saveM.isPending} />}
    </div>
  );
}

function MovieDialog({ initial, onClose, onSave, busy }: any) {
  const [f, setF] = useState<any>({ is_published: true, ...initial });
  const upd = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const fields: [string, string, string?][] = [
    ["title", "Nomi *"], ["description", "Tavsif", "textarea"],
    ["poster_url", "Poster URL"], ["header_url", "Header banner URL"],
    ["telegram_file_id", "Telegram video file_id"], ["trailer_url", "Treyler URL"],
    ["country", "Davlat"], ["year", "Yili", "number"], ["genre", "Janr"],
    ["imdb_rating", "IMDb", "number"], ["language", "Til"],
    ["quality", "Sifat"], ["duration_minutes", "Davomiyligi (daq)", "number"],
  ];
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card-glow rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-display font-bold mb-4">{initial?.id ? "Kinoni tahrirlash" : "Yangi kino"}</h2>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(([k, label, t]) => (
            <div key={k} className={t === "textarea" ? "col-span-2" : ""}>
              <label className="text-xs text-muted-foreground">{label}</label>
              {t === "textarea" ? (
                <textarea value={f[k] ?? ""} onChange={(e) => upd(k, e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              ) : (
                <input type={t ?? "text"} value={f[k] ?? ""} onChange={(e) => upd(k, e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              )}
            </div>
          ))}
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.is_published} onChange={(e) => upd("is_published", e.target.checked)} />
            E'lon qilingan
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent/40">Bekor qilish</button>
          <button disabled={busy} onClick={() => onSave(f)} className="rounded-lg btn-gradient px-4 py-2 text-sm font-medium disabled:opacity-60">Saqlash</button>
        </div>
      </div>
    </div>
  );
}
