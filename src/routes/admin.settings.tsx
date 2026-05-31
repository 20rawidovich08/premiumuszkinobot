import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getSettings, saveSetting, installWebhook, checkWebhook } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const get = useServerFn(getSettings);
  const save = useServerFn(saveSetting);
  const install = useServerFn(installWebhook);
  const check = useServerFn(checkWebhook);
  const { data, refetch } = useQuery({ queryKey: ["settings"], queryFn: () => get() });
  const [adminContact, setAdminContact] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    if (data) {
      setAdminContact(data.settings.admin_contact ?? "");
      if (!webhookUrl && typeof window !== "undefined") {
        setWebhookUrl(`${window.location.origin}/api/public/telegram/webhook`);
      }
    }
  }, [data]);

  const mSave = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => { toast.success("Saqlandi"); refetch(); },
  });

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">Settings</h1>

      <section className="glass-card rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Environment</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Bot username:</span> @{data?.env.botUsername}</div>
          <div><span className="text-muted-foreground">Channel ID:</span> {data?.env.channelId || "—"}</div>
          <div><span className="text-muted-foreground">Bot token:</span> {data?.env.hasToken ? "✅ configured" : "❌ missing"}</div>
          <div><span className="text-muted-foreground">Webhook secret:</span> {data?.env.hasWebhookSecret ? "✅" : "❌"}</div>
        </div>
      </section>

      <section className="glass-card rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Admin contact (shown in bot)</h2>
        <input value={adminContact} onChange={(e) => setAdminContact(e.target.value)} placeholder="@username" className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
        <button onClick={() => mSave.mutate({ key: "admin_contact", value: adminContact })} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Save</button>
      </section>

      <section className="glass-card rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Telegram Webhook</h2>
        <p className="text-sm text-muted-foreground">Set this URL as your bot's webhook. Telegram will POST updates here.</p>
        <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono" />
        <div className="flex gap-2">
          <button onClick={() => install({ data: { url: webhookUrl } }).then(() => toast.success("Webhook installed")).catch((e: any) => toast.error(e.message))} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Install webhook</button>
          <button onClick={() => check().then(setInfo)} className="rounded-md border border-border px-4 py-2 text-sm">Check status</button>
        </div>
        {info && <pre className="mt-3 text-xs bg-muted/40 p-3 rounded overflow-auto">{JSON.stringify(info, null, 2)}</pre>}
      </section>
    </div>
  );
}
