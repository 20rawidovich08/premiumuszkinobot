import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listRequests, updateRequest } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Inbox } from "lucide-react";

export const Route = createFileRoute("/admin/requests")({ component: RequestsPage });

const STATUSES = ["pending", "accepted", "completed", "rejected"] as const;
const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  pending: "Kutilmoqda", accepted: "Qabul qilindi", completed: "Bajarildi", rejected: "Rad etildi",
};
const STATUS_TONE: Record<(typeof STATUSES)[number], string> = {
  pending: "bg-amber/20 text-amber border-amber/30",
  accepted: "bg-info/20 text-info border-info/30",
  completed: "bg-success/20 text-success border-success/30",
  rejected: "bg-destructive/20 text-destructive border-destructive/30",
};

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
    <div className="p-6 lg:p-10 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <p className="text-sm text-muted-foreground">Foydalanuvchilardan kelgan so'rovlar</p>
        <h1 className="text-3xl md:text-4xl font-display font-bold">Buyurtmalar</h1>
      </div>

      {!data?.length ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Buyurtmalar yo'q.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((r: any) => (
            <article key={r.id} className="glass-card rounded-2xl p-5 hover-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {r.bot_user?.first_name ?? r.bot_user?.telegram_id ?? "—"}
                    {r.bot_user?.username && <span> · @{r.bot_user.username}</span>}
                  </div>
                  <h3 className="text-lg font-display font-semibold mt-1 truncate">{r.movie_name}</h3>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("uz-UZ")}</div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider rounded-md px-2 py-0.5 border ${STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? ""}`}>
                  {STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => m.mutate({ id: r.id, status: s, admin_notes: r.admin_notes })}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${r.status === s ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-accent/40"}`}>
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
