import { createFileRoute } from "@tanstack/react-router";
import { handleUpdate } from "@/lib/bot.server";
import { writeTelegramLog } from "@/lib/telegram-log.server";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        
        if (secret && got !== secret) {
          console.error("Unauthorized webhook request: secret mismatch");
          await writeTelegramLog({ kind: "webhook", level: "error", status: "error", error_message: "Webhook maxfiy tokeni mos kelmadi", duration_ms: Date.now() - startedAt });
          return new Response("Unauthorized", { status: 401 });
        }
        
        if (!secret) {
          console.warn("TELEGRAM_WEBHOOK_SECRET is not set. Webhook is vulnerable to spoofing.");
        }

        let update: any;
        try {
          update = await request.json();
        } catch (e) {
          console.error("Webhook JSON parse error:", e);
          await writeTelegramLog({ kind: "webhook", level: "error", status: "error", error_message: e instanceof Error ? e.message : String(e), duration_ms: Date.now() - startedAt });
          return new Response("Bad request", { status: 400 });
        }

        try {
          console.log("Processing update:", update.update_id);
          await handleUpdate(update);
          await writeTelegramLog({
            kind: update.callback_query ? "callback" : "webhook",
            level: "info",
            status: "ok",
            update_id: update.update_id,
            chat_id: update.message?.chat?.id ?? update.edited_message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? update.channel_post?.chat?.id ?? null,
            telegram_user_id: update.message?.from?.id ?? update.edited_message?.from?.id ?? update.callback_query?.from?.id ?? null,
            callback_data: update.callback_query?.data ?? null,
            request_payload: update,
            response_payload: { ok: true },
            duration_ms: Date.now() - startedAt,
          });
        } catch (e) {
          console.error("Bot handleUpdate error:", e);
          await writeTelegramLog({
            kind: update?.callback_query ? "callback" : "webhook",
            level: "error",
            status: "error",
            update_id: update?.update_id,
            chat_id: update?.message?.chat?.id ?? update?.edited_message?.chat?.id ?? update?.callback_query?.message?.chat?.id ?? update?.channel_post?.chat?.id ?? null,
            telegram_user_id: update?.message?.from?.id ?? update?.edited_message?.from?.id ?? update?.callback_query?.from?.id ?? null,
            callback_data: update?.callback_query?.data ?? null,
            request_payload: update,
            response_payload: { ok: true, handled: false },
            error_message: e instanceof Error ? e.message : String(e),
            duration_ms: Date.now() - startedAt,
          });
        }
        // Always 200 so Telegram does not retry storm
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, hint: "POST only" }),
    },
  },
});
