import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { autoPostMovieToChannel } from "@/lib/bot.server";
import { setWebhookUrl, getWebhookInfo } from "@/lib/telegram.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.some((r) => ["super_admin", "admin", "moderator"].includes(r as string))) {
    throw new Error("Forbidden");
  }
  return roles;
}

// ============ DASHBOARD ============
export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [users, movies, codes, views, requests, posts] = await Promise.all([
      supabaseAdmin.from("bot_users").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("movies").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("movie_codes").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("movie_views").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("movie_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("channel_posts").select("*", { count: "exact", head: true }),
    ]);
    const { data: topMovies } = await supabaseAdmin
      .from("movies")
      .select("id,title,views_count,poster_url,year")
      .order("views_count", { ascending: false })
      .limit(5);
    const { data: latestUsers } = await supabaseAdmin
      .from("bot_users")
      .select("id,telegram_id,first_name,username,created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    return {
      counts: {
        users: users.count ?? 0,
        movies: movies.count ?? 0,
        codes: codes.count ?? 0,
        views: views.count ?? 0,
        pendingRequests: requests.count ?? 0,
        channelPosts: posts.count ?? 0,
      },
      topMovies: topMovies ?? [],
      latestUsers: latestUsers ?? [],
    };
  });

// ============ MOVIES ============
export const listMovies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("movies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

const movieInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  poster_url: z.string().url().optional().nullable().or(z.literal("")),
  header_url: z.string().url().optional().nullable().or(z.literal("")),
  telegram_file_id: z.string().optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  genre: z.string().max(120).optional().nullable(),
  imdb_rating: z.coerce.number().min(0).max(10).optional().nullable(),
  language: z.string().max(40).optional().nullable(),
  quality: z.string().max(40).optional().nullable(),
  duration_minutes: z.coerce.number().int().min(0).max(1000).optional().nullable(),
  trailer_url: z.string().url().optional().nullable().or(z.literal("")),
  is_published: z.boolean().optional(),
});

export const upsertMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => movieInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const payload = { ...data } as any;
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    if (data.id) {
      const { error } = await supabaseAdmin.from("movies").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    } else {
      delete payload.id;
      const { data: ins, error } = await supabaseAdmin.from("movies").insert(payload).select("id").single();
      if (error) throw error;
      return { id: ins.id };
    }
  });

export const deleteMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("movies").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getMovie = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: movie } = await supabaseAdmin.from("movies").select("*").eq("id", data.id).single();
    const { data: codes } = await supabaseAdmin
      .from("movie_codes")
      .select("*")
      .eq("movie_id", data.id)
      .order("created_at", { ascending: false });
    return { movie, codes: codes ?? [] };
  });

// ============ CODES ============
const codeInput = z.object({
  movie_id: z.string().uuid(),
  mode: z.enum(["unlimited", "single", "limited"]),
  max_uses: z.coerce.number().int().min(1).max(100000).optional().nullable(),
  count: z.coerce.number().int().min(1).max(500).default(1),
  custom_code: z.string().regex(/^[A-Za-z0-9_-]{2,32}$/).optional().nullable(),
});

function randCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export const createCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => codeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.custom_code) {
      const { error } = await supabaseAdmin.from("movie_codes").insert({
        code: data.custom_code,
        movie_id: data.movie_id,
        mode: data.mode,
        max_uses: data.mode === "limited" ? (data.max_uses ?? null) : null,
      });
      if (error) throw error;
      return { created: 1 };
    }
    const rows = Array.from({ length: data.count }, () => ({
      code: randCode(),
      movie_id: data.movie_id,
      mode: data.mode,
      max_uses: data.mode === "limited" ? (data.max_uses ?? null) : null,
    }));
    const { error } = await supabaseAdmin.from("movie_codes").insert(rows);
    if (error) throw error;
    return { created: rows.length };
  });

export const toggleCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), is_active: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("movie_codes").update({ is_active: data.is_active }).eq("id", data.id);
    return { ok: true };
  });

export const deleteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("movie_codes").delete().eq("id", data.id);
    return { ok: true };
  });

// ============ CHANNEL ============
export const postMovieToChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ movie_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const res = await autoPostMovieToChannel(data.movie_id);
    return { ok: true, message_id: res?.message_id };
  });

// ============ USERS ============
export const listBotUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("bot_users")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    return data ?? [];
  });

// ============ REQUESTS ============
export const listRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("movie_requests")
      .select("*, bot_user:bot_users(telegram_id,username,first_name)")
      .order("created_at", { ascending: false })
      .limit(500);
    return data ?? [];
  });

export const updateRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    status: z.enum(["pending", "accepted", "completed", "rejected"]),
    admin_notes: z.string().max(2000).optional().nullable(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("movie_requests").update({
      status: data.status,
      admin_notes: data.admin_notes ?? null,
    }).eq("id", data.id);
    return { ok: true };
  });

// ============ SETTINGS ============
export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("bot_settings").select("*");
    const map: Record<string, string> = {};
    (data ?? []).forEach((r) => {
      if (!r.key.startsWith("state:")) map[r.key] = r.value ?? "";
    });
    return {
      settings: map,
      env: {
        botUsername: process.env.TELEGRAM_BOT_USERNAME ?? "",
        channelId: process.env.TELEGRAM_CHANNEL_ID ?? "",
        hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
        hasWebhookSecret: !!process.env.TELEGRAM_WEBHOOK_SECRET,
      },
    };
  });

export const saveSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ key: z.string().min(1).max(80), value: z.string().max(2000) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("bot_settings").upsert({
      key: data.key,
      value: data.value,
      updated_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const installWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ url: z.string().url() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
    const res = await setWebhookUrl(data.url, secret);
    return { ok: true, res };
  });

export const checkWebhook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return await getWebhookInfo();
  });

export const listTelegramLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ limit: z.coerce.number().int().min(1).max(200).default(80) }).optional())
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("telegram_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 80);
    if (error) throw error;
    return rows ?? [];
  });

// ============ ME ============
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      userId: context.userId,
      roles: (roles ?? []).map((r) => r.role as string),
      profile,
    };
  });

// ============ ACTIVITY FEED ============
export const getActivityFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [views, movies, posts, codes, requests] = await Promise.all([
      supabaseAdmin.from("movie_views").select("id,created_at,movie_id,bot_user_id").order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("movies").select("id,title,created_at").order("created_at", { ascending: false }).limit(5),
      supabaseAdmin.from("channel_posts").select("id,movie_id,created_at").order("created_at", { ascending: false }).limit(5),
      supabaseAdmin.from("movie_codes").select("id,code,movie_id,created_at").order("created_at", { ascending: false }).limit(5),
      supabaseAdmin.from("movie_requests").select("id,movie_name,created_at").order("created_at", { ascending: false }).limit(5),
    ]);
    const ids = new Set<string>();
    (views.data ?? []).forEach((v) => v.movie_id && ids.add(v.movie_id));
    (posts.data ?? []).forEach((p) => p.movie_id && ids.add(p.movie_id));
    (codes.data ?? []).forEach((c) => c.movie_id && ids.add(c.movie_id));
    const movieMap = new Map<string, string>();
    if (ids.size) {
      const { data: ms } = await supabaseAdmin.from("movies").select("id,title").in("id", Array.from(ids));
      (ms ?? []).forEach((m) => movieMap.set(m.id, m.title));
    }
    const events: { kind: string; emoji: string; text: string; at: string }[] = [];
    (views.data ?? []).forEach((v) => events.push({ kind: "view", emoji: "🟢", text: `Foydalanuvchi kod ishlatdi: ${movieMap.get(v.movie_id) ?? "kino"}`, at: v.created_at }));
    (movies.data ?? []).forEach((m) => events.push({ kind: "movie", emoji: "🎬", text: `Yangi kino qo'shildi: ${m.title}`, at: m.created_at }));
    (posts.data ?? []).forEach((p) => events.push({ kind: "post", emoji: "📢", text: `Kanalga post yuborildi: ${movieMap.get(p.movie_id) ?? "kino"}`, at: p.created_at }));
    (codes.data ?? []).forEach((c) => events.push({ kind: "code", emoji: "🔑", text: `Yangi kod yaratildi: ${c.code} (${movieMap.get(c.movie_id) ?? "kino"})`, at: c.created_at }));
    (requests.data ?? []).forEach((r) => events.push({ kind: "request", emoji: "📥", text: `Yangi buyurtma: ${r.movie_name}`, at: r.created_at }));
    events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return events.slice(0, 25);
  });

export const getBotStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    let bot = false;
    try { const info: any = await getWebhookInfo(); bot = !!info?.ok; } catch {}
    const channel = !!process.env.TELEGRAM_CHANNEL_ID;
    const { count: activeCodes } = await supabaseAdmin
      .from("movie_codes").select("*", { count: "exact", head: true }).eq("is_active", true);
    return { bot, channel, activeCodes: activeCodes ?? 0 };
  });

// ============ CODES (global) ============
export const listAllCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("movie_codes")
      .select("*, movie:movies(id,title,poster_url)")
      .order("created_at", { ascending: false })
      .limit(500);
    return data ?? [];
  });

// ============ CHANNEL POSTS ============
export const listChannelPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("channel_posts")
      .select("*, movie:movies(id,title,poster_url,year,genre,views_count)")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

// ============ SERIES ============
export const listSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("series").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

// ============ STATS ============
export const getStatsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const [views, users, topMovies] = await Promise.all([
      supabaseAdmin.from("movie_views").select("created_at").gte("created_at", since).limit(5000),
      supabaseAdmin.from("bot_users").select("created_at").gte("created_at", since).limit(5000),
      supabaseAdmin.from("movies").select("id,title,year,views_count,poster_url").order("views_count", { ascending: false }).limit(10),
    ]);
    const bucket = (rows: { created_at: string }[] | null) => {
      const m = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        m.set(d.toISOString().slice(0, 10), 0);
      }
      (rows ?? []).forEach((r) => {
        const k = r.created_at.slice(0, 10);
        if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
      });
      return Array.from(m.entries()).map(([day, value]) => ({ day, value }));
    };
    return {
      viewsSeries: bucket(views.data),
      usersSeries: bucket(users.data),
      topMovies: topMovies.data ?? [],
    };
  });
