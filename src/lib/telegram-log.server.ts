import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TelegramLogInput = {
  level?: "info" | "warn" | "error";
  kind?: "webhook" | "telegram_api" | "callback" | "bot";
  status?: "ok" | "error" | "ignored";
  update_id?: number | null;
  chat_id?: number | string | null;
  telegram_user_id?: number | null;
  telegram_method?: string | null;
  callback_data?: string | null;
  request_payload?: unknown;
  response_payload?: unknown;
  error_message?: string | null;
  duration_ms?: number | null;
};

function asBigIntSafe(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function writeTelegramLog(input: TelegramLogInput) {
  try {
    await (supabaseAdmin as any).from("telegram_logs").insert({
      level: input.level ?? "info",
      kind: input.kind ?? "bot",
      status: input.status ?? "ok",
      update_id: input.update_id ?? null,
      chat_id: asBigIntSafe(input.chat_id),
      telegram_user_id: input.telegram_user_id ?? null,
      telegram_method: input.telegram_method ?? null,
      callback_data: input.callback_data ?? null,
      request_payload: input.request_payload ?? null,
      response_payload: input.response_payload ?? null,
      error_message: input.error_message ?? null,
      duration_ms: input.duration_ms ?? null,
    });
  } catch (error) {
    console.error("Telegram log yozilmadi:", error);
  }
}