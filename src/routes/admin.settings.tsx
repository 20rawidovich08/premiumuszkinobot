import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getSettings, saveSetting, installWebhook, checkWebhook, listTelegramLogs } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const get = useServerFn(getSettings);
  const save = useServerFn(saveSetting);
  const install = useServerFn(installWebhook);
  const check = useServerFn(checkWebhook);
  const getLogs = useServerFn(listTelegramLogs);
  const { data, refetch } = useQuery({ queryKey: ["settings"], queryFn: () => get() });
  const logsQuery = useQuery({ queryKey: ["telegram_logs"], queryFn: () => getLogs({ data: { limit: 80 } }), refetchInterval: 10000 });
  const [adminContact, setAdminContact] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [info, setInfo] = useState<any>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    if (data) {
      setAdminContact(data.settings.admin_contact ?? "");
      if (!webhookUrl && typeof window !== "undefined") {
        setWebhookUrl(`${window.location.origin}/api/public/telegram/webhook`);
      }
    }
  }, [data]);

  useEffect(() => {
    const channel = supabase
      .channel("telegram-logs-admin")
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "telegram_logs" }, () => {
        logsQuery.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const mSave = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => { toast.success("Saqlandi"); refetch(); },
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Bot sozlamalari va jonli diagnostika</p>
          <h1 className="text-3xl font-bold">Sozlamalar</h1>
        </div>
        <button onClick={() => logsQuery.refetch()} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
          <RefreshCw className="h-4 w-4" /> Loglarni yangilash
        </button>
      </div>

      <section className="glass-card rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Muhit holati</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Bot username:</span> @{data?.env.botUsername || "—"}</div>
          <div><span className="text-muted-foreground">Kanal ID:</span> {data?.env.channelId || "—"}</div>
          <div><span className="text-muted-foreground">Bot token:</span> {data?.env.hasToken ? "✅ sozlangan" : "❌ yo‘q"}</div>
          <div><span className="text-muted-foreground">Webhook maxfiy tokeni:</span> {data?.env.hasWebhookSecret ? "✅ sozlangan" : "❌ yo‘q"}</div>
        </div>
      </section>

      <section className="glass-card rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Admin kontakti (botda ko‘rinadi)</h2>
        <input value={adminContact} onChange={(e) => setAdminContact(e.target.value)} placeholder="@username" className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
        <button onClick={() => mSave.mutate({ key: "admin_contact", value: adminContact })} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Saqlash</button>
      </section>

      <section className="glass-card rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Telegram Webhook</h2>
        <p className="text-sm text-muted-foreground">Telegram xabarlarni shu manzilga yuboradi. Agar bot javob bermasa, holat va loglarni shu yerdan tekshiring.</p>
        <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono" />
        <div className="flex gap-2">
          <button onClick={() => install({ data: { url: webhookUrl } }).then(() => toast.success("Webhook o‘rnatildi")).catch((e: any) => toast.error(e.message))} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Webhookni o‘rnatish</button>
          <button onClick={() => check().then(setInfo)} className="rounded-md border border-border px-4 py-2 text-sm">Holatni tekshirish</button>
        </div>
        {info && <pre className="mt-3 text-xs bg-muted/40 p-3 rounded overflow-auto">{JSON.stringify(info, null, 2)}</pre>}
      </section>

      <section className="glass-card rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 p-5">
          <div>
            <h2 className="font-semibold">Telegram loglari — real-time</h2>
            <p className="text-sm text-muted-foreground">Update ID, callback, so‘rov/javob va xatoliklar avtomatik chiqadi.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Activity className="h-4 w-4 text-success" /> Jonli</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr><th className="px-4 py-3">Vaqt</th><th>Holat</th><th>Turi</th><th>Update ID</th><th>Chat</th><th>Metod</th><th>Xatolik</th><th></th></tr>
            </thead>
            <tbody>
              {(logsQuery.data ?? []).map((log: any) => (
                <tr key={log.id} className="border-t border-border/40 align-top">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("uz-UZ")}</td>
                  <td>{log.status === "ok" ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> OK</span> : log.status === "ignored" ? <span className="text-warning">O‘tkazildi</span> : <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" /> Xato</span>}</td>
                  <td>{log.kind}</td>
                  <td className="font-mono">{log.update_id ?? "—"}</td>
                  <td className="font-mono">{log.chat_id ?? "—"}</td>
                  <td>{log.telegram_method ?? "—"}</td>
                  <td className="max-w-xs truncate text-destructive">{log.error_message ?? "—"}</td>
                  <td className="pr-4 text-right"><button onClick={() => setSelectedLog(log)} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">Ko‘rish</button></td>
                </tr>
              ))}
              {!logsQuery.data?.length && <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">Hali log yo‘q. Botga /start yuboring.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="glass-card max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-xl p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold">Log tafsilotlari</h3>
              <button onClick={() => setSelectedLog(null)} className="rounded-md border border-border px-3 py-1 text-sm">Yopish</button>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">So‘rov</h4>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 text-xs">{JSON.stringify(selectedLog.request_payload, null, 2)}</pre>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Javob</h4>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 text-xs">{JSON.stringify(selectedLog.response_payload, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
