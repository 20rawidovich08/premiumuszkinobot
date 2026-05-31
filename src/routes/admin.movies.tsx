import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMovies, upsertMovie, deleteMovie, postMovieToChannel } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Plus, Trash2, Send, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/movies")({ component: MoviesPage });

function MoviesPage() {
  const list = useServerFn(listMovies);
  const save = useServerFn(upsertMovie);
  const del = useServerFn(deleteMovie);
  const post = useServerFn(postMovieToChannel);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["movies"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);

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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Movies</h1>
        <button onClick={() => setEditing({})} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> Add Movie
        </button>
      </div>
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr><th className="px-4 py-3">Title</th><th>Year</th><th>Genre</th><th>Views</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((m: any) => (
                <tr key={m.id} className="border-t border-border/40">
                  <td className="px-4 py-3 font-medium">
                    <Link to="/admin/movies/$id" params={{ id: m.id }} className="hover:text-primary">{m.title}</Link>
                  </td>
                  <td>{m.year ?? "—"}</td>
                  <td className="text-muted-foreground">{m.genre ?? "—"}</td>
                  <td>{m.views_count}</td>
                  <td>{m.is_published ? "Published" : "Draft"}</td>
                  <td className="text-right pr-3">
                    <button onClick={() => postM.mutate(m.id)} title="Post to channel" className="p-2 hover:text-primary"><Send className="h-4 w-4" /></button>
                    <button onClick={() => setEditing(m)} className="p-2 hover:text-primary"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => confirm("O'chirish?") && delM.mutate(m.id)} className="p-2 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No movies yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editing && <MovieDialog initial={editing} onClose={() => setEditing(null)} onSave={(v) => saveM.mutate(v)} busy={saveM.isPending} />}
    </div>
  );
}

function MovieDialog({ initial, onClose, onSave, busy }: any) {
  const [f, setF] = useState<any>({ is_published: true, ...initial });
  const upd = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const fields: [string, string, string?][] = [
    ["title", "Title *"], ["description", "Description", "textarea"],
    ["poster_url", "Poster URL"], ["header_url", "Header banner URL"],
    ["telegram_file_id", "Telegram video file_id"], ["trailer_url", "Trailer URL"],
    ["country", "Country"], ["year", "Year", "number"], ["genre", "Genre"],
    ["imdb_rating", "IMDb", "number"], ["language", "Language"],
    ["quality", "Quality"], ["duration_minutes", "Duration (min)", "number"],
  ];
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{initial?.id ? "Edit movie" : "New movie"}</h2>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(([k, label, t]) => (
            <div key={k} className={t === "textarea" ? "col-span-2" : ""}>
              <label className="text-xs text-muted-foreground">{label}</label>
              {t === "textarea" ? (
                <textarea value={f[k] ?? ""} onChange={(e) => upd(k, e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
              ) : (
                <input type={t ?? "text"} value={f[k] ?? ""} onChange={(e) => upd(k, e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
              )}
            </div>
          ))}
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.is_published} onChange={(e) => upd("is_published", e.target.checked)} />
            Published
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button disabled={busy} onClick={() => onSave(f)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">Save</button>
        </div>
      </div>
    </div>
  );
}
