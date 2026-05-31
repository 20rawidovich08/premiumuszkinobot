import { createFileRoute } from "@tanstack/react-router";
import { handleUpdate } from "@/lib/bot.server";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        
        if (secret && got !== secret) {
          console.error("Unauthorized webhook request: secret mismatch");
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
          return new Response("Bad request", { status: 400 });
        }

        try {
          console.log("Processing update:", update.update_id);
          await handleUpdate(update);
        } catch (e) {
          console.error("Bot handleUpdate error:", e);
        }
        // Always 200 so Telegram does not retry storm
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, hint: "POST only" }),
    },
  },
});
