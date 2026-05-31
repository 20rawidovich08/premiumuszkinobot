import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listRequests, updateRequest } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/requests")({ component: RequestsPage });

const STATUSES = ["pending", "accepted", "completed", "rejected"] as const;

function RequestsPage() {
  const list = useServerFn(listRequests);
  const upd = useServerFn(updateRequest);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["requests"], queryFn: () => list() });
  const m = useMutation({
    mutationFn: (v: any) => upd({ data: v }),
    onSuccess: () => { toast.success("Yangilandi"); qc.invalidateQueries({ queryKey: ["requests"] }); },
  });
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Movie Requests</h1>
      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left"><tr><th className="px-4 py-3">User</th><th>Movie</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {(data ?? []).map((r: any) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-4 py-3">{r.bot_user?.first_name ?? r.bot_user?.telegram_id ?? "—"}</td>
                <td>{r.movie_name}</td>
                <td>
                  <select value={r.status} onChange={(e) => m.mutate({ id: r.id, status: e.target.value, admin_notes: r.admin_notes })} className="rounded-md border border-border bg-input px-2 py-1 text-xs">
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
