// Server-only Telegram Bot API helpers
import { writeTelegramLog } from "./telegram-log.server";

const TG_API = "https://api.telegram.org/bot";

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return t;
}

export function botUsername() {
  return process.env.TELEGRAM_BOT_USERNAME ?? "";
}

export function channelId() {
  return process.env.TELEGRAM_CHANNEL_ID ?? "";
}

function redactPayload(body: Record<string, unknown>) {
  const copy = { ...body };
  if (copy.secret_token) copy.secret_token = "[yashirildi]";
  return copy;
}

export async function tg<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  const startedAt = Date.now();
  const res = await fetch(`${TG_API}${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json() as any;
  await writeTelegramLog({
    kind: "telegram_api",
    level: json.ok ? "info" : "error",
    status: json.ok ? "ok" : "error",
    telegram_method: method,
    chat_id: (body.chat_id as number | string | undefined) ?? null,
    request_payload: redactPayload(body),
    response_payload: json,
    error_message: json.ok ? null : JSON.stringify(json),
    duration_ms: Date.now() - startedAt,
  });
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${JSON.stringify(json)}`);
  return json.result as T;
}

export async function sendMessage(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

export async function sendPhoto(chatId: number | string, photo: string, caption?: string, extra: Record<string, unknown> = {}) {
  return tg("sendPhoto", { chat_id: chatId, photo, caption, parse_mode: "HTML", ...extra });
}

export async function sendVideo(chatId: number | string, video: string, caption?: string, extra: Record<string, unknown> = {}) {
  return tg("sendVideo", { chat_id: chatId, video, caption, parse_mode: "HTML", ...extra });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return tg("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export async function setWebhookUrl(url: string, secret: string) {
  return tg("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query", "channel_post"],
  });
}

export async function getWebhookInfo() {
  return tg("getWebhookInfo", {});
}

export function deepLink(code: string) {
  const u = botUsername().replace(/^@/, "");
  return `https://t.me/${u}?start=${encodeURIComponent(code)}`;
}

export function mainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: "🎬 Kino olish" }, { text: "🔎 Kod kiritish" }],
      [{ text: "🆕 Yangi kinolar" }, { text: "🏆 Top kinolar" }],
      [{ text: "🎬 Kino buyurtma qilish" }],
      [{ text: "👤 Profilim" }, { text: "📞 Admin bilan bog'lanish" }],
    ],
    resize_keyboard: true,
  };
}
