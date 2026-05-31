import { createFileRoute } from "@tanstack/react-router";
import { handleUpdate } from "@/lib/bot.server";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (!secret || got !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        let update: any;
        try {
          update = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        try {
          await handleUpdate(update);
        } catch (e) {
          console.error("Bot error:", e);
        }
        // Always 200 so Telegram does not retry storm
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, hint: "POST only" }),
    },
  },
});
