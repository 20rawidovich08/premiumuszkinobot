// Bot business logic — server-only
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendMessage,
  sendPhoto,
  sendVideo,
  answerCallbackQuery,
  editMessageText,
  deleteMessage,
  getChatMember,
  mainMenuInline,
  removeKb,
  deepLink,
} from "./telegram.server";
import { writeTelegramLog } from "./telegram-log.server";
import { handleAdminMessage, handleAdminCallback, isAdmin, showAdminMenu } from "./bot-admin.server";

type TgUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

const sb = () => supabaseAdmin;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtMovieCaption(movie: any) {
  const meta = [movie.year, movie.genre, movie.country, movie.quality].filter(Boolean).join(" • ");
  return [
    `🎬 <b>${escapeHtml(movie.title)}</b>`,
    meta ? `📌 ${escapeHtml(meta)}` : "",
    movie.imdb_rating ? `⭐ IMDb: <b>${escapeHtml(movie.imdb_rating)}</b>` : "",
    movie.duration_minutes ? `⏱ Davomiyligi: ${escapeHtml(movie.duration_minutes)} daqiqa` : "",
    movie.language ? `🌐 Til: ${escapeHtml(movie.language)}` : "",
    movie.description ? `\n${escapeHtml(movie.description)}` : "",
  ].filter(Boolean).join("\n");
}

async function getState(botUserId: string): Promise<string | null> {
  const { data } = await sb().from("bot_settings").select("value").eq("key", `state:${botUserId}`).maybeSingle();
  return data?.value ?? null;
}
async function setState(botUserId: string, state: string | null) {
  if (state === null) {
    await sb().from("bot_settings").delete().eq("key", `state:${botUserId}`);
  } else {
    await sb().from("bot_settings").upsert({ key: `state:${botUserId}`, value: state, updated_at: new Date().toISOString() });
  }
}

async function upsertUser(u: TgUser) {
  const { data: existing } = await sb().from("bot_users").select("*").eq("telegram_id", u.id).maybeSingle();
  if (existing) {
    await sb().from("bot_users").update({
      username: u.username, first_name: u.first_name, last_name: u.last_name,
      language_code: u.language_code, last_activity_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return existing;
  }
  const { data: created } = await sb().from("bot_users").insert({
    telegram_id: u.id, username: u.username, first_name: u.first_name,
    last_name: u.last_name, language_code: u.language_code,
  }).select("*").single();
  return created!;
}

// ============== MAJBURIY OBUNA ==============
type RequiredChannel = { chat_id: string | number; title: string; url: string };

export async function getRequiredChannels(): Promise<RequiredChannel[]> {
  const { data } = await sb().from("bot_settings").select("value").eq("key", "required_channels").maybeSingle();
  if (!data?.value) return [];
  try { return JSON.parse(data.value) as RequiredChannel[]; } catch { return []; }
}

async function checkUnsubscribed(telegramId: number): Promise<RequiredChannel[]> {
  const channels = await getRequiredChannels();
  if (!channels.length) return [];
  const missing: RequiredChannel[] = [];
  for (const ch of channels) {
    const res = await getChatMember(ch.chat_id, telegramId);
    const status = res?.status ?? "left";
    if (!["member", "administrator", "creator"].includes(status)) missing.push(ch);
  }
  return missing;
}

function subscriptionKb(missing: RequiredChannel[]) {
  const rows: any[][] = missing.map((c) => [{ text: `📢 ${c.title}`, url: c.url }]);
  rows.push([{ text: "✅ Azo bo'ldim", callback_data: "sub:check" }]);
  return { inline_keyboard: rows };
}

async function sendSubscriptionPrompt(chatId: number, missing: RequiredChannel[]) {
  const text = [
    "🔒 <b>Botdan foydalanish uchun kanallarga obuna bo'ling</b>",
    "",
    "Quyidagi kanallarga obuna bo'lib, <b>«✅ Azo bo'ldim»</b> tugmasini bosing.",
  ].join("\n");
  await sendMessage(chatId, text, { reply_markup: subscriptionKb(missing) });
}

async function sendMainMenu(chatId: number, firstName?: string) {
  await sendMessage(
    chatId,
    [
      `🎬 <b>Assalomu alaykum${firstName ? ", " + escapeHtml(firstName) : ""}!</b>`,
      "",
      "Bu yerda eng so'nggi kinolarni topishingiz mumkin.",
      "Quyidagi menyudan tanlang yoki kino kodini yuboring 👇",
    ].join("\n"),
    { reply_markup: mainMenuInline() },
  );
}

// ============== KOD ORQALI KINO YETKAZIB BERISH ==============
async function deliverMovieByCode(chatId: number, botUser: any, rawCode: string) {
  try {
    const code = rawCode.trim();
    const { data: codeRow } = await sb().from("movie_codes")
      .select("*, movie:movies(*)").eq("code", code).eq("is_active", true).maybeSingle();

    if (!codeRow || !codeRow.movie) {
      await sendMessage(chatId, "❌ Bunday kod topilmadi yoki faol emas.");
      return;
    }
    if (codeRow.mode === "single" && codeRow.uses_count >= 1) {
      await sendMessage(chatId, "❌ Bu bir martalik kod allaqachon ishlatilgan."); return;
    }
    if (codeRow.mode === "limited" && codeRow.max_uses && codeRow.uses_count >= codeRow.max_uses) {
      await sendMessage(chatId, "❌ Bu kodning limiti tugagan."); return;
    }

    const movie = codeRow.movie as any;
    await sendMoviePost(chatId, movie);

    await sb().from("movie_codes").update({
      uses_count: codeRow.uses_count + 1,
      is_active: codeRow.mode === "single" ? false
        : codeRow.mode === "limited" && codeRow.max_uses && codeRow.uses_count + 1 >= codeRow.max_uses ? false
        : true,
    }).eq("id", codeRow.id);
    await sb().from("movie_views").insert({ movie_id: movie.id, bot_user_id: botUser.id, code_id: codeRow.id });
    await sb().from("movies").update({ views_count: (movie.views_count ?? 0) + 1 }).eq("id", movie.id);
    await sb().from("bot_users").update({ movies_watched: (botUser.movies_watched ?? 0) + 1 }).eq("id", botUser.id);
  } catch (e) {
    console.error("deliverMovieByCode err", e);
    await sendMessage(chatId, "❌ Texnik xatolik. Keyinroq urinib ko'ring.");
  }
}

async function sendMoviePost(chatId: number, movie: any) {
  const caption = fmtMovieCaption(movie);
  if (movie.poster_url) {
    try { await sendPhoto(chatId, movie.poster_url, caption); }
    catch { await sendMessage(chatId, caption); }
  } else {
    await sendMessage(chatId, caption);
  }
  if (movie.telegram_file_id) {
    try { await sendVideo(chatId, movie.telegram_file_id, `🎬 <b>${escapeHtml(movie.title)}</b>`); }
    catch { await sendMessage(chatId, "⚠️ Videoni yuborishda xatolik."); }
  } else {
    await sendMessage(chatId, "⚠️ Bu kino uchun video hali yuklanmagan.");
  }
}

async function showProfile(chatId: number, botUser: any) {
  const since = new Date(botUser.created_at).toLocaleDateString();
  await sendMessage(chatId, [
    "👤 <b>Profilim</b>", "",
    `🆔 Telegram ID: <code>${botUser.telegram_id}</code>`,
    `👤 Ism: ${escapeHtml(botUser.first_name ?? "—")}`,
    `📅 Ro'yxatdan o'tgan: ${since}`,
    `🎬 Ko'rilgan kinolar: <b>${botUser.movies_watched ?? 0}</b>`,
    `✅ Holat: ${botUser.is_blocked ? "Bloklangan" : "Faol"}`,
  ].join("\n"), { reply_markup: { inline_keyboard: [[{ text: "« Bosh menyu", callback_data: "m:menu" }]] }});
}

// ============== KATALOG ==============
const PAGE_SIZE = 8;
type CatalogSort = "new" | "top";

async function fetchCatalog(sort: CatalogSort, genre: string | null, page: number) {
  const from = page * PAGE_SIZE, to = from + PAGE_SIZE - 1;
  let q = sb().from("movies").select("id,title,year,views_count,genre", { count: "exact" }).eq("is_published", true);
  if (genre) q = q.ilike("genre", `%${genre}%`);
  q = sort === "top" ? q.order("views_count", { ascending: false }) : q.order("created_at", { ascending: false });
  const { data, count } = await q.range(from, to);
  return { data: data ?? [], total: count ?? 0 };
}

function catalogKeyboard(items: any[], sort: CatalogSort, genre: string | null, page: number, total: number) {
  const rows: any[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2).map((m) => ({
      text: `${m.title}${m.year ? ` (${m.year})` : ""}`.slice(0, 60),
      callback_data: `mv:${m.id}`,
    })));
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const g = genre ?? "-";
  const nav: any[] = [];
  if (page > 0) nav.push({ text: "« Oldingi", callback_data: `cat:${sort}:${g}:${page - 1}` });
  nav.push({ text: `${page + 1}/${totalPages}`, callback_data: "noop" });
  if (page + 1 < totalPages) nav.push({ text: "Keyingi »", callback_data: `cat:${sort}:${g}:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([
    { text: sort === "new" ? "✅ 🆕" : "🆕 Yangi", callback_data: `cat:new:${g}:0` },
    { text: sort === "top" ? "✅ 🏆" : "🏆 Top", callback_data: `cat:top:${g}:0` },
    { text: "🎭", callback_data: "genres" },
  ]);
  rows.push([{ text: "« Bosh menyu", callback_data: "m:menu" }]);
  return { inline_keyboard: rows };
}

function catalogTitle(sort: CatalogSort, genre: string | null, total: number) {
  const head = sort === "top" ? "🏆 <b>Eng ko'p ko'rilgan</b>" : "🆕 <b>Yangi kinolar</b>";
  const g = genre ? `\n🎭 Janr: <b>${escapeHtml(genre)}</b>` : "";
  return `${head}${g}\n📚 Jami: ${total}\n\nKino tanlang 👇`;
}

async function showCatalog(chatId: number, sort: CatalogSort, genre: string | null, page: number, messageId?: number) {
  const { data, total } = await fetchCatalog(sort, genre, page);
  const text = total ? catalogTitle(sort, genre, total) : "Hozircha kinolar yo'q.";
  const kb = total ? catalogKeyboard(data, sort, genre, page, total) : { inline_keyboard: [[{ text: "« Bosh menyu", callback_data: "m:menu" }]] };
  if (messageId) try { return await editMessageText(chatId, messageId, text, { reply_markup: kb }); } catch {}
  return sendMessage(chatId, text, { reply_markup: kb });
}

async function showGenres(chatId: number, messageId?: number) {
  const { data } = await sb().from("movies").select("genre").eq("is_published", true).not("genre", "is", null);
  const set = new Set<string>();
  (data ?? []).forEach((r: any) => String(r.genre ?? "").split(/[,/]/).forEach((g) => { const t = g.trim(); if (t) set.add(t); }));
  const genres = [...set].sort().slice(0, 24);
  const rows: any[][] = [];
  for (let i = 0; i < genres.length; i += 3) {
    rows.push(genres.slice(i, i + 3).map((g) => ({ text: g, callback_data: `cat:new:${g}:0` })));
  }
  rows.push([{ text: "🔄 Barchasi", callback_data: "cat:new:-:0" }]);
  rows.push([{ text: "« Bosh menyu", callback_data: "m:menu" }]);
  const text = genres.length ? "🎭 <b>Janrni tanlang</b>" : "🎭 Hozircha janrlar yo'q.";
  const kb = { inline_keyboard: rows };
  if (messageId) try { return await editMessageText(chatId, messageId, text, { reply_markup: kb }); } catch {}
  await sendMessage(chatId, text, { reply_markup: kb });
}

async function deliverMovieById(chatId: number, botUser: any, movieId: string) {
  const { data: movie } = await sb().from("movies").select("*").eq("id", movieId).eq("is_published", true).maybeSingle();
  if (!movie) return sendMessage(chatId, "❌ Kino topilmadi.");
  await sendMoviePost(chatId, movie);
  await sb().from("movie_views").insert({ movie_id: movie.id, bot_user_id: botUser.id });
  await sb().from("movies").update({ views_count: (movie.views_count ?? 0) + 1 }).eq("id", movie.id);
  await sb().from("bot_users").update({ movies_watched: (botUser.movies_watched ?? 0) + 1 }).eq("id", botUser.id);
}

// ============== UPDATE HANDLER ==============
export async function handleUpdate(update: any) {
  const callback = update.callback_query;
  if (callback) {
    await writeTelegramLog({
      kind: "callback", status: "ok", update_id: update.update_id,
      chat_id: callback.message?.chat?.id ?? null,
      telegram_user_id: callback.from?.id ?? null,
      callback_data: callback.data ?? null, request_payload: update,
    });
    const data = callback.data ?? "";
    const chatId = callback.message?.chat?.id;
    const messageId = callback.message?.message_id;
    if (!chatId || !callback.from) { await answerCallbackQuery(callback.id).catch(() => {}); return; }
    const botUser = await upsertUser(callback.from as TgUser);

    // Sub check before anything else (except admin)
    const adminFlag = await isAdmin(callback.from.id);
    if (!adminFlag && data !== "sub:check") {
      const missing = await checkUnsubscribed(callback.from.id);
      if (missing.length) {
        await answerCallbackQuery(callback.id, "Avval kanallarga obuna bo'ling", true).catch(() => {});
        await sendSubscriptionPrompt(chatId, missing);
        return;
      }
    }

    await answerCallbackQuery(callback.id).catch(() => {});

    if (data === "sub:check") {
      const missing = await checkUnsubscribed(callback.from.id);
      if (missing.length) {
        await answerCallbackQuery(callback.id, "Hali hammasiga obuna bo'lmagansiz!", true).catch(() => {});
        if (messageId) try { await editMessageText(chatId, messageId, "🔒 Iltimos, barcha kanallarga obuna bo'ling.", { reply_markup: subscriptionKb(missing) }); } catch {}
        return;
      }
      if (messageId) await deleteMessage(chatId, messageId);
      await sendMainMenu(chatId, callback.from.first_name);
      return;
    }

    if (adminFlag && data.startsWith("adm:")) {
      if (await handleAdminCallback(chatId, messageId, botUser, data, callback.id)) return;
    }

    if (data.startsWith("m:")) {
      const a = data.slice(2);
      if (a === "menu") {
        if (messageId) await deleteMessage(chatId, messageId);
        return sendMainMenu(chatId, callback.from.first_name);
      }
      if (a === "code") {
        await setState(botUser.id, "await_code");
        return sendMessage(chatId, "🔢 Kino kodini yuboring (faqat raqamlar):");
      }
      if (a === "profile") return showProfile(chatId, botUser);
      if (a === "request") {
        await setState(botUser.id, "await_request");
        return sendMessage(chatId, "✍️ Qaysi kinoni qidirayapsiz? Nomini yuboring:");
      }
      if (a === "contact") {
        const { data: s } = await sb().from("bot_settings").select("value").eq("key", "admin_contact").maybeSingle();
        return sendMessage(chatId, `📞 Admin: ${s?.value ?? "@admin"}`, { reply_markup: { inline_keyboard: [[{ text: "« Bosh menyu", callback_data: "m:menu" }]] }});
      }
    }

    if (data.startsWith("ser:")) return handleSeriesCallback(chatId, messageId, botUser, data);
    if (data === "noop") return;
    if (data === "genres") return showGenres(chatId, messageId);
    if (data.startsWith("code:")) return deliverMovieByCode(chatId, botUser, data.slice(5));
    if (data.startsWith("mv:")) return deliverMovieById(chatId, botUser, data.slice(3));
    if (data.startsWith("cat:")) {
      const [, sort, g, pageStr] = data.split(":");
      const genre = g === "-" ? null : g;
      const page = Math.max(0, parseInt(pageStr ?? "0", 10) || 0);
      return showCatalog(chatId, sort as CatalogSort, genre, page, messageId);
    }
    return;
  }

  const msg = update.message ?? update.edited_message;
  if (!msg?.from) {
    await writeTelegramLog({ kind: "webhook", status: "ignored", update_id: update.update_id, request_payload: update });
    return;
  }
  const from = msg.from as TgUser;
  if ((from as any).is_bot) return;
  const chatId = msg.chat.id as number;
  const botUser = await upsertUser(from);

  // Admin first
  const adminFlag = await isAdmin(from.id);
  if (adminFlag) {
    if (await handleAdminMessage(chatId, botUser, msg)) return;
  }

  const text: string = msg.text ?? "";

  // Forced subscription gate (skip for admins)
  if (!adminFlag) {
    const missing = await checkUnsubscribed(from.id);
    if (missing.length) {
      await sendSubscriptionPrompt(chatId, missing);
      return;
    }
  }

  // /start [param]
  if (text.startsWith("/start")) {
    const param = text.replace(/^\/start(?:=|\s+)?/i, "").trim();
    if (param) {
      if (param.startsWith("ser_")) {
        await showSeriesDetail(chatId, param.slice(4));
        return;
      }
      await deliverMovieByCode(chatId, botUser, param);
      return;
    }
    // hide any old reply keyboard
    await sendMessage(chatId, "🔄", { reply_markup: removeKb }).catch(() => {});
    await sendMainMenu(chatId, from.first_name);
    return;
  }

  if (text === "/menu") { await sendMainMenu(chatId, from.first_name); return; }
  if (text === "/admin" && adminFlag) { await showAdminMenu(chatId); return; }

  // State-driven
  const state = await getState(botUser.id);
  if (state === "await_code") {
    await setState(botUser.id, null);
    await deliverMovieByCode(chatId, botUser, text);
    return;
  }
  if (state === "await_request") {
    await setState(botUser.id, null);
    await sb().from("movie_requests").insert({ bot_user_id: botUser.id, movie_name: text.slice(0, 200) });
    await sendMessage(chatId, "✅ Buyurtma qabul qilindi. Admin tez orada javob beradi.", { reply_markup: { inline_keyboard: [[{ text: "« Bosh menyu", callback_data: "m:menu" }]] }});
    return;
  }

  // Plain numeric code attempt
  if (text && /^\d{2,12}$/.test(text.trim())) {
    await deliverMovieByCode(chatId, botUser, text.trim());
    return;
  }
  await sendMainMenu(chatId, from.first_name);
}

// ============== AVTO POST: KINO ==============
function fmtChannelCaption(movie: any) {
  const title = escapeHtml(movie.title);
  const lang = escapeHtml(movie.language || "Oʻzbek tilida");
  const quality = escapeHtml(movie.quality || "HD");
  const year = escapeHtml(movie.year || "—");
  return [
    `🎥 Nomi: ${title}`,
    "",
    `🇺🇿${lang} ✅`,
    "",
    "╭───────────────────",
    `├‣ ${title}`,
    `├‣ ${lang}`,
    `├‣ Sifati: ${quality}`,
    `├‣ Yili: ${year}`,
    "╰───────────────────",
    "",
    "Tomosha qilish tugmasini bosing🔰",
  ].join("\n");
}

export async function autoPostMovieToChannel(movieId: string) {
  const chId = process.env.TELEGRAM_CHANNEL_ID;
  if (!chId) throw new Error("TELEGRAM_CHANNEL_ID not configured");
  const { data: movie } = await sb().from("movies").select("*").eq("id", movieId).single();
  if (!movie) throw new Error("Movie not found");
  if (!movie.poster_url) throw new Error("Kanal posti uchun poster rasm topilmadi");
  let { data: code } = await sb().from("movie_codes").select("*").eq("movie_id", movieId).eq("is_active", true)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!code) {
    const auto = String(Math.floor(100000 + Math.random() * 900000));
    const { data: c2 } = await sb().from("movie_codes").insert({ code: auto, movie_id: movieId, mode: "unlimited" }).select("*").single();
    code = c2;
  }
  const caption = fmtChannelCaption(movie);
  const keyboard = { inline_keyboard: [[{ text: "▶️ TOMOSHA QILISH", url: deepLink(code!.code) }]] };
  const res: any = await sendPhoto(chId, movie.poster_url, caption, { reply_markup: keyboard });
  await sb().from("channel_posts").insert({ movie_id: movieId, channel_id: chId, message_id: res.message_id });
  return res;
}

// ============== AVTO POST: SERIAL ==============
export async function autoPostSeriesToChannel(seriesId: string) {
  const chId = process.env.TELEGRAM_CHANNEL_ID;
  if (!chId) throw new Error("TELEGRAM_CHANNEL_ID not configured");
  const { data: s } = await sb().from("series").select("*").eq("id", seriesId).single();
  if (!s) throw new Error("Series not found");
  const { count: seasonCount } = await sb().from("seasons").select("*", { count: "exact", head: true }).eq("series_id", seriesId);
  const meta = [s.year, s.genre, s.country].filter(Boolean).join(" • ");
  const caption = [
    `📺 <b>${escapeHtml(s.title)}</b>`,
    meta ? `📌 ${escapeHtml(meta)}` : "",
    s.description ? `\n${escapeHtml(s.description)}` : "",
    `\n🎬 Mavsumlar: <b>${seasonCount ?? 0}</b>`,
    "\n👇 Tomosha qilish uchun bosing",
  ].filter(Boolean).join("\n");
  const u = (process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "");
  const url = `https://t.me/${u}?start=ser_${seriesId}`;
  const keyboard = { inline_keyboard: [[{ text: "📺 SERIALNI KO'RISH", url }]] };
  if (s.poster_url) {
    try { return await sendPhoto(chId, s.poster_url, caption, { reply_markup: keyboard }); }
    catch { return sendMessage(chId, caption, { reply_markup: keyboard }); }
  }
  return sendMessage(chId, caption, { reply_markup: keyboard });
}

// ============== FOYDALANUVCHI: SERIALLAR ==============
const SER_PAGE = 8;

async function showSeriesList(chatId: number, page: number, messageId?: number) {
  const { data, count } = await sb().from("series").select("id,title,year", { count: "exact" })
    .eq("is_published", true).order("created_at", { ascending: false })
    .range(page * SER_PAGE, page * SER_PAGE + SER_PAGE - 1);
  const total = count ?? 0;
  if (!total) {
    const kb = { inline_keyboard: [[{ text: "« Bosh menyu", callback_data: "m:menu" }]] };
    const t = "Hozircha seriallar yo'q.";
    if (messageId) try { return await editMessageText(chatId, messageId, t, { reply_markup: kb }); } catch {}
    return sendMessage(chatId, t, { reply_markup: kb });
  }
  const rows = (data ?? []).map((s: any) => [{ text: `📺 ${s.title}${s.year ? ` (${s.year})` : ""}`.slice(0, 60), callback_data: `ser:s:${s.id}` }]);
  const pages = Math.max(1, Math.ceil(total / SER_PAGE));
  const nav: any[] = [];
  if (page > 0) nav.push({ text: "«", callback_data: `ser:list:${page - 1}` });
  nav.push({ text: `${page + 1}/${pages}`, callback_data: "noop" });
  if (page + 1 < pages) nav.push({ text: "»", callback_data: `ser:list:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: "« Bosh menyu", callback_data: "m:menu" }]);
  const text = `📚 <b>Seriallar</b> (${total})\n\nTanlang 👇`;
  if (messageId) try { return await editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: rows } }); } catch {}
  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } });
}

async function showSeriesDetail(chatId: number, seriesId: string, messageId?: number) {
  const { data: s } = await sb().from("series").select("*").eq("id", seriesId).eq("is_published", true).maybeSingle();
  if (!s) return sendMessage(chatId, "Topilmadi.");
  const { data: seasons } = await sb().from("seasons").select("id,season_number").eq("series_id", seriesId).order("season_number");
  const rows: any[][] = (seasons ?? []).map((se: any) => [{ text: `🎬 Mavsum ${se.season_number}`, callback_data: `ser:se:${se.id}` }]);
  rows.push([{ text: "« Seriallar", callback_data: "ser:list:0" }]);
  const text = [
    `📺 <b>${escapeHtml(s.title)}</b>`,
    [s.year, s.genre, s.country].filter(Boolean).map(escapeHtml).join(" • "),
    s.description ? `\n${escapeHtml(s.description)}` : "",
    `\nMavsumlar: ${seasons?.length ?? 0}`,
  ].filter(Boolean).join("\n");
  if (messageId) try { return await editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: rows } }); } catch {}
  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } });
}

async function showSeasonEpisodes(chatId: number, seasonId: string, messageId?: number) {
  const { data: se } = await sb().from("seasons").select("*, series:series(id,title)").eq("id", seasonId).maybeSingle();
  if (!se) return;
  const { data: eps } = await sb().from("episodes").select("id,episode_number,title").eq("season_id", seasonId).order("episode_number");
  const rows: any[][] = [];
  (eps ?? []).forEach((e: any) => rows.push([{ text: `${e.episode_number}-qism${e.title ? ` • ${e.title}` : ""}`.slice(0, 60), callback_data: `ser:ep:${e.id}` }]));
  rows.push([{ text: "« Serial", callback_data: `ser:s:${(se as any).series.id}` }]);
  const text = `📺 <b>${escapeHtml((se as any).series.title)}</b>\n🎬 Mavsum ${se.season_number}\nQismlar: ${eps?.length ?? 0}\n\nQismni tanlang 👇`;
  if (messageId) try { return await editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: rows } }); } catch {}
  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } });
}

async function deliverEpisode(chatId: number, _botUser: any, episodeId: string) {
  const { data: e } = await sb().from("episodes").select("*, season:seasons(season_number, series:series(title))").eq("id", episodeId).maybeSingle();
  if (!e) return sendMessage(chatId, "❌ Qism topilmadi.");
  const seriesTitle = (e as any).season?.series?.title ?? "";
  const caption = `📺 <b>${escapeHtml(seriesTitle)}</b>\n🎬 S${(e as any).season?.season_number}E${e.episode_number}${e.title ? ` — ${escapeHtml(e.title)}` : ""}`;
  if (e.telegram_file_id) {
    try { await sendVideo(chatId, e.telegram_file_id, caption); } catch { await sendMessage(chatId, "⚠️ Videoni yuborishda xatolik."); }
  } else {
    await sendMessage(chatId, caption + "\n\n⚠️ Video hali yuklanmagan.");
  }
  await sb().from("episodes").update({ views_count: (e.views_count ?? 0) + 1 }).eq("id", e.id);
}

async function handleSeriesCallback(chatId: number, messageId: number | undefined, botUser: any, data: string) {
  const parts = data.split(":");
  const action = parts[1];
  if (action === "list") return showSeriesList(chatId, parseInt(parts[2] ?? "0", 10) || 0, messageId);
  if (action === "s") return showSeriesDetail(chatId, parts[2], messageId);
  if (action === "se") return showSeasonEpisodes(chatId, parts[2], messageId);
  if (action === "ep") return deliverEpisode(chatId, botUser, parts[2]);
}
