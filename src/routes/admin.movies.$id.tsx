import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMovie, createCodes, deleteCode, toggleCode, postMovieToChannel } from "@/lib/admin.functions";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Send } from "lucide-react";

export const Route = createFileRoute("/admin/movies/$id")({ component: MovieDetail });

function MovieDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getMovie);
  const make = useServerFn(createCodes);
  const del = useServerFn(deleteCode);
  const tog = useServerFn(toggleCode);
  const post = useServerFn(postMovieToChannel);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["movie", id], queryFn: () => fn({ data: { id } }) });
  const [mode, setMode] = useState<"unlimited" | "single" | "limited">("unlimited");
  const [count, setCount] = useState(5);
  const [maxUses, setMaxUses] = useState(100);
  const [custom, setCustom] = useState("");

  const inv = () => qc.invalidateQueries({ queryKey: ["movie", id] });
  const mCreate = useMutation({
    mutationFn: () => make({ data: { movie_id: id, mode, count, max_uses: maxUses, custom_code: custom || null } }),
    onSuccess: (r) => { toast.success(`${r.created} ta kod yaratildi`); setCustom(""); inv(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!data?.movie) return <div className="p-8">Yuklanmoqda…</div>;
  const m = data.movie;
  return (
    <div className="p-8 space-y-6">
      <Link to="/admin/movies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Orqaga</Link>
      <div className="glass-card rounded-xl p-6 flex gap-6">
        {m.poster_url && <img src={m.poster_url} alt={m.title} className="w-32 h-48 object-cover rounded-md" />}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{m.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{m.year} • {m.genre} • {m.country} • ⭐ {m.imdb_rating ?? "—"}</p>
          <p className="mt-3 text-sm">{m.description}</p>
          <button onClick={() => post({ data: { movie_id: id } }).then(() => toast.success("Kanalga yuborildi")).catch((e: any) => toast.error(e.message))} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"><Send className="h-4 w-4" /> Kanalga yuborish</button>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="font-semibold mb-4">Kod yaratish</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Rejim</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
              <option value="unlimited">Cheksiz</option>
              <option value="single">Bir martalik</option>
              <option value="limited">Limitli</option>
            </select>
          </div>
          {mode === "limited" && (
            <div>
              <label className="text-xs text-muted-foreground">Maksimal foydalanish</label>
              <input type="number" value={maxUses} onChange={(e) => setMaxUses(+e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">Soni</label>
            <input type="number" value={count} onChange={(e) => setCount(+e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Maxsus kod (sonini bekor qiladi)</label>
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. TRANSFORMER01" className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
        </div>
        <button onClick={() => mCreate.mutate()} disabled={mCreate.isPending} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">Yaratish</button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left"><tr><th className="px-4 py-3">Kod</th><th>Rejim</th><th>Ishlatildi</th><th>Faol</th><th></th></tr></thead>
          <tbody>
            {data.codes.map((c: any) => (
              <tr key={c.id} className="border-t border-border/40">
                <td className="px-4 py-3 font-mono">{c.code}</td>
                <td>{c.mode}{c.max_uses ? ` (${c.max_uses})` : ""}</td>
                <td>{c.uses_count}</td>
                <td><input type="checkbox" checked={c.is_active} onChange={(e) => tog({ data: { id: c.id, is_active: e.target.checked } }).then(inv)} /></td>
                <td className="text-right pr-3"><button onClick={() => del({ data: { id: c.id } }).then(inv)} className="p-2 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {!data.codes.length && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Hali kod yo‘q.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
