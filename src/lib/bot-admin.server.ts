// In-bot admin panel — server-only
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendMessage, editMessageText, answerCallbackQuery, sendVideo, sendPhoto } from "./telegram.server";

const sb = () => supabaseAdmin;

function esc(v: unknown) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

let _adminIdsCache: { ids: Set<number>; at: number } | null = null;
export async function getAdminIds(): Promise<Set<number>> {
  if (_adminIdsCache && Date.now() - _adminIdsCache.at < 30_000) return _adminIdsCache.ids;
  const { data } = await sb().from("bot_settings").select("value").eq("key", "admin_telegram_ids").maybeSingle();
  const ids = new Set<number>(
    String(data?.value ?? "")
      .split(/[,\s]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n)),
  );
  _adminIdsCache = { ids, at: Date.now() };
  return ids;
}

export async function isAdmin(telegramId: number): Promise<boolean> {
  return (await getAdminIds()).has(telegramId);
}

type Draft = { step: string; data?: any };
async function getDraft(botUserId: string): Promise<Draft | null> {
  const { data } = await sb().from("bot_settings").select("value").eq("key", `draft:${botUserId}`).maybeSingle();
  if (!data?.value) return null;
  try { return JSON.parse(data.value); } catch { return null; }
}
async function setDraft(botUserId: string, draft: Draft | null) {
  if (!draft) {
    await sb().from("bot_settings").delete().eq("key", `draft:${botUserId}`);
  } else {
    await sb().from("bot_settings").upsert({
      key: `draft:${botUserId}`,
      value: JSON.stringify(draft),
      updated_at: new Date().toISOString(),
    });
  }
}

function adminMenuKb() {
  return {
    inline_keyboard: [
      [{ text: "🎬 Kino qo'shish", callback_data: "adm:add_movie" }, { text: "📺 Serial qo'shish", callback_data: "adm:add_series" }],
      [{ text: "🎞 Kinolar", callback_data: "adm:list_movies:0" }, { text: "📚 Seriallar", callback_data: "adm:list_series:0" }],
      [{ text: "📢 Majburiy obuna", callback_data: "adm:channels" }, { text: "📊 Statistika", callback_data: "adm:stats" }],
      [{ text: "📣 Ommaviy xabar", callback_data: "adm:broadcast" }],
      [{ text: "❌ Yopish", callback_data: "adm:close" }],
    ],
  };
}

export async function showAdminMenu(chatId: number, messageId?: number) {
  const text = "🛠 <b>Admin panel</b>\n\nKerakli amalni tanlang:";
  if (messageId) {
    try { return await editMessageText(chatId, messageId, text, { reply_markup: adminMenuKb() }); } catch {}
  }
  return sendMessage(chatId, text, { reply_markup: adminMenuKb() });
}

function backKb() {
  return { inline_keyboard: [[{ text: "« Admin menyu", callback_data: "adm:menu" }]] };
}

// ============== MESSAGE HANDLER ==============
export async function handleAdminMessage(chatId: number, botUser: any, msg: any): Promise<boolean> {
  const text: string = msg.text ?? "";

  if (text === "/admin" || text === "🛠 Admin") {
    await setDraft(botUser.id, null);
    await showAdminMenu(chatId);
    return true;
  }

  const draft = await getDraft(botUser.id);
  if (!draft) return false;

  // ===== Add movie =====
  if (draft.step === "add_movie:video") {
    const video = msg.video || msg.document;
    if (!video?.file_id) { await sendMessage(chatId, "📹 Iltimos, kino <b>videosini</b> yuboring."); return true; }
    const thumb = msg.video?.thumbnail?.file_id || msg.video?.thumb?.file_id || null;
    await setDraft(botUser.id, { step: "add_movie:title", data: { file_id: video.file_id, thumb_file_id: thumb } });
    await sendMessage(chatId, "✅ Video qabul qilindi.\n\n✍️ Endi <b>kino nomini</b> yuboring:");
    return true;
  }
  if (draft.step === "add_movie:title") {
    if (!text.trim()) { await sendMessage(chatId, "Iltimos, nomini matn ko'rinishida yuboring."); return true; }
    await setDraft(botUser.id, { step: "add_movie:language", data: { ...draft.data, title: text.trim() } });
    await sendMessage(chatId, "🌐 <b>Tilini</b> yuboring (masalan: <code>Oʻzbek tilida</code>):");
    return true;
  }
  if (draft.step === "add_movie:language") {
    const language = text.trim() === "-" ? null : text.trim();
    await setDraft(botUser.id, { step: "add_movie:quality", data: { ...draft.data, language } });
    await sendMessage(chatId, "📺 <b>Sifatini</b> yuboring (masalan: <code>1080p</code>):");
    return true;
  }
  if (draft.step === "add_movie:quality") {
    const quality = text.trim() === "-" ? null : text.trim();
    await setDraft(botUser.id, { step: "add_movie:year", data: { ...draft.data, quality } });
    await sendMessage(chatId, "📅 <b>Yilini</b> yuboring (masalan: <code>2026</code>):");
    return true;
  }
  if (draft.step === "add_movie:year") {
    const year = parseInt(text.trim(), 10) || null;
    await setDraft(botUser.id, { step: "add_movie:genre", data: { ...draft.data, year } });
    await sendMessage(chatId, "🎭 <b>Janrini</b> yuboring (yoki <b>-</b>):");
    return true;
  }
  if (draft.step === "add_movie:genre") {
    const genre = text.trim() === "-" ? null : text.trim();
    await setDraft(botUser.id, { step: "add_movie:country", data: { ...draft.data, genre } });
    await sendMessage(chatId, "🌍 <b>Davlatini</b> yuboring (yoki <b>-</b>):");
    return true;
  }
  if (draft.step === "add_movie:country") {
    const country = text.trim() === "-" ? null : text.trim();
    await setDraft(botUser.id, { step: "add_movie:poster", data: { ...draft.data, country } });
    await sendMessage(chatId, "🖼 Endi <b>kanal posti uchun rasm (poster)</b> yuboring.\n\nAgar videoning o'zidagi rasm yetarli bo'lsa <b>-</b> yuboring.");
    return true;
  }
  if (draft.step === "add_movie:poster") {
    let poster = draft.data.thumb_file_id ?? null;
    if (msg.photo && Array.isArray(msg.photo) && msg.photo.length) {
      poster = msg.photo[msg.photo.length - 1].file_id;
    } else if (text.trim() === "-") {
      if (!poster) {
        await sendMessage(chatId, "⚠️ Bu videoda tayyor rasm topilmadi. Kanal posti uchun alohida <b>rasm</b> yuboring.");
        return true;
      }
    } else {
      await sendMessage(chatId, "🖼 Iltimos, <b>rasm</b> yuboring yoki <b>-</b> yuboring.");
      return true;
    }
    await setDraft(botUser.id, { step: "add_movie:code", data: { ...draft.data, poster_file_id: poster } });
    await sendMessage(chatId, "🔢 <b>Kino kodini</b> yuboring (faqat raqamlar, masalan: <code>123</code>):");
    return true;
  }
  if (draft.step === "add_movie:code") {
    const code = text.trim();
    if (!/^\d{1,12}$/.test(code)) { await sendMessage(chatId, "❌ Kod faqat raqamlardan iborat bo'lishi kerak (1–12 ta raqam)."); return true; }
    const { data: dup } = await sb().from("movie_codes").select("id").eq("code", code).maybeSingle();
    if (dup) { await sendMessage(chatId, "❌ Bu kod allaqachon band. Boshqa raqam yuboring:"); return true; }

    const d = draft.data;
    const { data: ins, error } = await sb().from("movies").insert({
      title: d.title, year: d.year, genre: d.genre, country: d.country,
      language: d.language, quality: d.quality,
      telegram_file_id: d.file_id, poster_url: d.poster_file_id, is_published: true,
    }).select("id").single();
    if (error) { await sendMessage(chatId, "❌ Xatolik: " + esc(error.message)); await setDraft(botUser.id, null); return true; }
    await sb().from("movie_codes").insert({ code, movie_id: ins.id, mode: "unlimited" });
    await setDraft(botUser.id, null);
    await sendMessage(chatId, `✅ <b>Kino qo'shildi!</b>\n\n🎬 ${esc(d.title)}\n🔑 Kod: <code>${code}</code>`, {
      reply_markup: { inline_keyboard: [
        [{ text: "📤 Kanalga avto-post", callback_data: `adm:post_movie:${ins.id}` }],
        [{ text: "« Admin menyu", callback_data: "adm:menu" }],
      ]},
    });
    // try auto-post
    try {
      const { autoPostMovieToChannel } = await import("./bot.server");
      await autoPostMovieToChannel(ins.id);
      await sendMessage(chatId, "📡 Kanalga avtomatik post qilindi.");
    } catch (e) {
      await sendMessage(chatId, "⚠️ Kanalga post qilishda xatolik: " + esc(e instanceof Error ? e.message : String(e)));
    }
    return true;
  }

  // ===== Add series =====
  if (draft.step === "add_series:title") {
    if (!text.trim()) { await sendMessage(chatId, "Serial nomini yuboring."); return true; }
    await setDraft(botUser.id, { step: "add_series:meta", data: { title: text.trim() } });
    await sendMessage(chatId, "📝 Yili, janri, davlatini yuboring:\n<code>2024 | Drama | Koreya</code>\n\nYoki <b>-</b>.");
    return true;
  }
  if (draft.step === "add_series:meta") {
    let year: number | null = null, genre: string | null = null, country: string | null = null;
    if (text.trim() !== "-") {
      const parts = text.split("|").map((s) => s.trim());
      year = parseInt(parts[0] ?? "", 10) || null;
      genre = parts[1] || null;
      country = parts[2] || null;
    }
    await setDraft(botUser.id, { step: "add_series:poster", data: { ...draft.data, year, genre, country } });
    await sendMessage(chatId, "🖼 Serial uchun <b>poster (rasm)</b> yuboring.\n\nYoki o'tkazib yuborish uchun <b>-</b> yuboring.");
    return true;
  }
  if (draft.step === "add_series:poster") {
    let poster: string | null = null;
    if (msg.photo && Array.isArray(msg.photo) && msg.photo.length) {
      poster = msg.photo[msg.photo.length - 1].file_id;
    } else if (text.trim() !== "-") {
      await sendMessage(chatId, "Rasm yuboring yoki <b>-</b> yuboring.");
      return true;
    }
    const d = draft.data;
    const { data: ins, error } = await sb().from("series").insert({
      title: d.title, year: d.year, genre: d.genre, country: d.country, poster_url: poster, is_published: true,
    }).select("id").single();
    if (error) { await sendMessage(chatId, "❌ Xatolik: " + esc(error.message)); await setDraft(botUser.id, null); return true; }
    await setDraft(botUser.id, null);
    await sendMessage(chatId, `✅ <b>Serial qo'shildi!</b>\n\n📺 ${esc(d.title)}\n\nEndi mavsum qo'shing:`, {
      reply_markup: { inline_keyboard: [
        [{ text: "➕ Mavsum qo'shish", callback_data: `adm:add_season:${ins.id}` }],
        [{ text: "📤 Kanalga avto-post", callback_data: `adm:post_series:${ins.id}` }],
        [{ text: "« Admin menyu", callback_data: "adm:menu" }],
      ]},
    });
    return true;
  }

  // ===== Add season =====
  if (draft.step === "add_season:number") {
    const n = parseInt(text.trim(), 10);
    if (!Number.isFinite(n) || n < 1) { await sendMessage(chatId, "Mavsum raqamini son ko'rinishda yuboring."); return true; }
    const seriesId = draft.data.series_id;
    const { data: ins, error } = await sb().from("seasons").insert({ series_id: seriesId, season_number: n }).select("id").single();
    if (error) { await sendMessage(chatId, "❌ Xatolik: " + esc(error.message)); await setDraft(botUser.id, null); return true; }
    await setDraft(botUser.id, null);
    await sendMessage(chatId, `✅ <b>${n}-mavsum</b> yaratildi.`, {
      reply_markup: { inline_keyboard: [
        [{ text: "➕ Qism qo'shish", callback_data: `adm:add_ep:${ins.id}` }],
        [{ text: "« Serialga qaytish", callback_data: `adm:series:${seriesId}` }],
      ]},
    });
    return true;
  }

  // ===== Add episode =====
  if (draft.step === "add_ep:video") {
    const video = msg.video || msg.document;
    if (!video?.file_id) { await sendMessage(chatId, "📹 Qism videosini yuboring."); return true; }
    await setDraft(botUser.id, { step: "add_ep:meta", data: { ...draft.data, file_id: video.file_id } });
    await sendMessage(chatId, "📝 Qism raqami va nomi:\n<code>1 | Pilot</code>\n\nYoki faqat raqam: <code>1</code>");
    return true;
  }
  if (draft.step === "add_ep:meta") {
    const parts = text.split("|").map((s) => s.trim());
    const epNum = parseInt(parts[0] ?? "", 10);
    if (!Number.isFinite(epNum) || epNum < 1) { await sendMessage(chatId, "Qism raqamini to'g'ri yuboring."); return true; }
    const epTitle = parts[1] || null;
    const seasonId = draft.data.season_id;
    const { error } = await sb().from("episodes").insert({
      season_id: seasonId, episode_number: epNum, title: epTitle, telegram_file_id: draft.data.file_id,
    });
    if (error) { await sendMessage(chatId, "❌ Xatolik: " + esc(error.message)); await setDraft(botUser.id, null); return true; }
    await setDraft(botUser.id, null);
    await sendMessage(chatId, `✅ <b>${epNum}-qism</b> qo'shildi.`, {
      reply_markup: { inline_keyboard: [
        [{ text: "➕ Yana qism", callback_data: `adm:add_ep:${seasonId}` }],
        [{ text: "« Admin menyu", callback_data: "adm:menu" }],
      ]},
    });
    return true;
  }

  // ===== Edits =====
  if (draft.step === "edit_movie:title") {
    const id = draft.data.movie_id;
    await sb().from("movies").update({ title: text.trim() }).eq("id", id);
    await setDraft(botUser.id, null);
    await sendMessage(chatId, "✅ Nom yangilandi.", { reply_markup: { inline_keyboard: [[{ text: "« Kinoga qaytish", callback_data: `adm:movie:${id}` }]] }});
    return true;
  }
  if (draft.step === "edit_movie:video") {
    const video = msg.video || msg.document;
    if (!video?.file_id) { await sendMessage(chatId, "📹 Yangi videoni yuboring."); return true; }
    const id = draft.data.movie_id;
    const thumb = msg.video?.thumbnail?.file_id || msg.video?.thumb?.file_id || null;
    const update: any = { telegram_file_id: video.file_id };
    if (thumb) update.poster_url = thumb;
    await sb().from("movies").update(update).eq("id", id);
    await setDraft(botUser.id, null);
    await sendMessage(chatId, "✅ Video yangilandi.", { reply_markup: { inline_keyboard: [[{ text: "« Kinoga qaytish", callback_data: `adm:movie:${id}` }]] }});
    return true;
  }
  if (draft.step === "edit_movie:code") {
    const id = draft.data.movie_id;
    const newCode = text.trim();
    if (!/^\d{1,12}$/.test(newCode)) { await sendMessage(chatId, "❌ Kod faqat raqamlardan iborat bo'lishi kerak."); return true; }
    const { data: dup } = await sb().from("movie_codes").select("id, movie_id").eq("code", newCode).maybeSingle();
    if (dup && dup.movie_id !== id) { await sendMessage(chatId, "❌ Bu kod boshqa kinoda band."); return true; }
    // update first existing code or insert
    const { data: existing } = await sb().from("movie_codes").select("id").eq("movie_id", id).limit(1).maybeSingle();
    if (existing) await sb().from("movie_codes").update({ code: newCode, is_active: true }).eq("id", existing.id);
    else await sb().from("movie_codes").insert({ code: newCode, movie_id: id, mode: "unlimited" });
    await setDraft(botUser.id, null);
    await sendMessage(chatId, `✅ Kod yangilandi: <code>${esc(newCode)}</code>`, { reply_markup: { inline_keyboard: [[{ text: "« Kinoga qaytish", callback_data: `adm:movie:${id}` }]] }});
    return true;
  }

  // ===== Required channels =====
  if (draft.step === "channels:add") {
    // Format: chat_id | title | url   yoki   @username | title | url
    const parts = text.split("|").map((s) => s.trim());
    if (parts.length < 3) { await sendMessage(chatId, "❌ Format: <code>@kanal | Nomi | https://t.me/kanal</code>"); return true; }
    let chat_id: string | number = parts[0];
    if (/^-?\d+$/.test(parts[0])) chat_id = parseInt(parts[0], 10);
    const list = await getChannelsRaw();
    list.push({ chat_id, title: parts[1], url: parts[2] });
    await sb().from("bot_settings").upsert({ key: "required_channels", value: JSON.stringify(list), updated_at: new Date().toISOString() });
    await setDraft(botUser.id, null);
    await sendMessage(chatId, "✅ Kanal qo'shildi. Bot bu kanalda admin bo'lishi kerakligini unutmang!");
    await showChannelsMenu(chatId);
    return true;
  }

  // ===== Broadcast =====
  if (draft.step === "broadcast") {
    await setDraft(botUser.id, null);
    const { data: users } = await sb().from("bot_users").select("telegram_id").eq("is_blocked", false);
    await sendMessage(chatId, `📣 ${users?.length ?? 0} foydalanuvchiga yuborilmoqda…`);
    let ok = 0, fail = 0;
    for (const u of users ?? []) {
      try { await sendMessage(u.telegram_id as number, text); ok++; } catch { fail++; }
    }
    await sendMessage(chatId, `✅ Yakunlandi.\n✓ Yuborildi: <b>${ok}</b>\n✗ Xato: <b>${fail}</b>`, { reply_markup: backKb() });
    return true;
  }

  return false;
}

async function getChannelsRaw(): Promise<Array<{ chat_id: string | number; title: string; url: string }>> {
  const { data } = await sb().from("bot_settings").select("value").eq("key", "required_channels").maybeSingle();
  if (!data?.value) return [];
  try { return JSON.parse(data.value); } catch { return []; }
}

async function showChannelsMenu(chatId: number, messageId?: number) {
  const list = await getChannelsRaw();
  const rows: any[][] = list.map((c, i) => [{ text: `🗑 ${c.title}`, callback_data: `adm:ch_del:${i}` }]);
  rows.push([{ text: "➕ Kanal qo'shish", callback_data: "adm:ch_add" }]);
  rows.push([{ text: "« Admin menyu", callback_data: "adm:menu" }]);
  const text = [
    "📢 <b>Majburiy obuna kanallar</b>",
    "",
    list.length ? list.map((c, i) => `${i + 1}. ${esc(c.title)} — <code>${esc(String(c.chat_id))}</code>`).join("\n") : "<i>Hozircha kanal qo'shilmagan.</i>",
    "",
    "<b>Muhim:</b> Bot har bir kanalda <b>admin</b> bo'lishi shart!",
  ].join("\n");
  const kb = { inline_keyboard: rows };
  if (messageId) try { return await editMessageText(chatId, messageId, text, { reply_markup: kb }); } catch {}
  return sendMessage(chatId, text, { reply_markup: kb });
}

// ============== CALLBACK ==============
export async function handleAdminCallback(chatId: number, messageId: number | undefined, botUser: any, data: string, callbackId: string): Promise<boolean> {
  if (!data.startsWith("adm:")) return false;
  await answerCallbackQuery(callbackId).catch(() => {});
  const parts = data.split(":");
  const action = parts[1];

  if (action === "menu") { await showAdminMenu(chatId, messageId); return true; }
  if (action === "close") {
    if (messageId) try { await editMessageText(chatId, messageId, "✅ Admin panel yopildi."); } catch {}
    return true;
  }

  if (action === "add_movie") {
    await setDraft(botUser.id, { step: "add_movie:video" });
    await sendMessage(chatId, "📹 <b>Kino videosini</b> shu chatga yuboring.");
    return true;
  }
  if (action === "add_series") {
    await setDraft(botUser.id, { step: "add_series:title" });
    await sendMessage(chatId, "✍️ <b>Serial nomini</b> yuboring:");
    return true;
  }
  if (action === "add_season") {
    const seriesId = parts[2];
    await setDraft(botUser.id, { step: "add_season:number", data: { series_id: seriesId } });
    await sendMessage(chatId, "🔢 Mavsum raqamini yuboring (masalan: <code>1</code>):");
    return true;
  }
  if (action === "add_ep") {
    const seasonId = parts[2];
    await setDraft(botUser.id, { step: "add_ep:video", data: { season_id: seasonId } });
    await sendMessage(chatId, "📹 Qism videosini yuboring:");
    return true;
  }
  if (action === "broadcast") {
    await setDraft(botUser.id, { step: "broadcast" });
    await sendMessage(chatId, "✍️ Yubormoqchi bo'lgan xabar matnini yuboring:");
    return true;
  }

  if (action === "channels") { await showChannelsMenu(chatId, messageId); return true; }
  if (action === "ch_add") {
    await setDraft(botUser.id, { step: "channels:add" });
    await sendMessage(chatId, "✍️ Kanalni quyidagi formatda yuboring:\n\n<code>@kanal | Kanal nomi | https://t.me/kanal</code>\n\nYoki son ID bilan:\n<code>-1001234567890 | Nomi | https://t.me/+invite</code>\n\n<b>Eslatma:</b> Bot kanalda admin bo'lishi shart!");
    return true;
  }
  if (action === "ch_del") {
    const idx = parseInt(parts[2] ?? "", 10);
    const list = await getChannelsRaw();
    if (Number.isFinite(idx) && list[idx]) {
      list.splice(idx, 1);
      await sb().from("bot_settings").upsert({ key: "required_channels", value: JSON.stringify(list), updated_at: new Date().toISOString() });
    }
    return showChannelsMenu(chatId, messageId).then(() => true);
  }

  if (action === "post_movie") {
    const id = parts[2];
    try {
      const { autoPostMovieToChannel } = await import("./bot.server");
      await autoPostMovieToChannel(id);
      await sendMessage(chatId, "✅ Kanalga post qilindi.");
    } catch (e) {
      await sendMessage(chatId, "❌ Xatolik: " + esc(e instanceof Error ? e.message : String(e)));
    }
    return true;
  }
  if (action === "post_series") {
    const id = parts[2];
    try {
      const { autoPostSeriesToChannel } = await import("./bot.server");
      await autoPostSeriesToChannel(id);
      await sendMessage(chatId, "✅ Serial kanalga post qilindi.");
    } catch (e) {
      await sendMessage(chatId, "❌ Xatolik: " + esc(e instanceof Error ? e.message : String(e)));
    }
    return true;
  }

  if (action === "stats") {
    const [u, m, s, e, v] = await Promise.all([
      sb().from("bot_users").select("*", { count: "exact", head: true }),
      sb().from("movies").select("*", { count: "exact", head: true }),
      sb().from("series").select("*", { count: "exact", head: true }),
      sb().from("episodes").select("*", { count: "exact", head: true }),
      sb().from("movie_views").select("*", { count: "exact", head: true }),
    ]);
    const txt = [
      "📊 <b>Statistika</b>", "",
      `👥 Foydalanuvchilar: <b>${u.count ?? 0}</b>`,
      `🎬 Kinolar: <b>${m.count ?? 0}</b>`,
      `📺 Seriallar: <b>${s.count ?? 0}</b>`,
      `🎞 Qismlar: <b>${e.count ?? 0}</b>`,
      `👁 Ko'rishlar: <b>${v.count ?? 0}</b>`,
    ].join("\n");
    if (messageId) try { await editMessageText(chatId, messageId, txt, { reply_markup: backKb() }); return true; } catch {}
    await sendMessage(chatId, txt, { reply_markup: backKb() });
    return true;
  }

  // List movies
  if (action === "list_movies") {
    const page = parseInt(parts[2] ?? "0", 10) || 0;
    const PS = 8;
    const { data, count } = await sb().from("movies").select("id,title,year", { count: "exact" })
      .order("created_at", { ascending: false }).range(page * PS, page * PS + PS - 1);
    const rows = (data ?? []).map((m: any) => [{ text: `${m.title}${m.year ? ` (${m.year})` : ""}`.slice(0, 60), callback_data: `adm:movie:${m.id}` }]);
    const total = count ?? 0;
    const pages = Math.max(1, Math.ceil(total / PS));
    const nav: any[] = [];
    if (page > 0) nav.push({ text: "«", callback_data: `adm:list_movies:${page - 1}` });
    nav.push({ text: `${page + 1}/${pages}`, callback_data: "adm:noop" });
    if (page + 1 < pages) nav.push({ text: "»", callback_data: `adm:list_movies:${page + 1}` });
    if (nav.length) rows.push(nav);
    rows.push([{ text: "« Admin menyu", callback_data: "adm:menu" }]);
    const text = `🎞 <b>Kinolar</b> (${total})`;
    if (messageId) try { await editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: rows } }); return true; } catch {}
    await sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } });
    return true;
  }

  if (action === "movie") {
    const id = parts[2];
    const { data: m } = await sb().from("movies").select("*").eq("id", id).maybeSingle();
    if (!m) { await sendMessage(chatId, "Topilmadi."); return true; }
    const { data: codes } = await sb().from("movie_codes").select("code,is_active,uses_count").eq("movie_id", id).order("created_at");
    const codesText = (codes ?? []).length
      ? (codes ?? []).map((c) => `<code>${esc(c.code)}</code>${c.is_active ? "" : " (faol emas)"} • ${c.uses_count} marta`).join("\n")
      : "<i>Kod yo'q</i>";
    const txt = [
      `🎬 <b>${esc(m.title)}</b>`,
      `Yil: ${esc(m.year ?? "—")} • Janr: ${esc(m.genre ?? "—")} • Davlat: ${esc(m.country ?? "—")}`,
      `Ko'rishlar: ${m.views_count} • Holat: ${m.is_published ? "Faol" : "Yashirin"}`,
      `Video: ${m.telegram_file_id ? "✅" : "❌"} • Poster: ${m.poster_url ? "✅" : "❌"}`,
      "",
      "🔑 <b>Kodlar:</b>",
      codesText,
    ].join("\n");
    const kb = { inline_keyboard: [
      [{ text: "✏️ Nomi", callback_data: `adm:edit_title:${id}` }, { text: "🔢 Kod", callback_data: `adm:edit_code:${id}` }],
      [{ text: "🎥 Video almashtirish", callback_data: `adm:edit_video:${id}` }],
      [{ text: "📤 Kanalga post", callback_data: `adm:post_movie:${id}` }],
      [{ text: m.is_published ? "🙈 Yashirish" : "👁 Ochish", callback_data: `adm:toggle:${id}` }],
      [{ text: "🗑 O'chirish", callback_data: `adm:del:${id}` }],
      [{ text: "« Ro'yxat", callback_data: "adm:list_movies:0" }],
    ]};
    if (messageId) try { await editMessageText(chatId, messageId, txt, { reply_markup: kb }); return true; } catch {}
    await sendMessage(chatId, txt, { reply_markup: kb });
    return true;
  }
  if (action === "edit_title") {
    const id = parts[2];
    await setDraft(botUser.id, { step: "edit_movie:title", data: { movie_id: id } });
    await sendMessage(chatId, "✍️ Yangi nomni yuboring:");
    return true;
  }
  if (action === "edit_video") {
    const id = parts[2];
    await setDraft(botUser.id, { step: "edit_movie:video", data: { movie_id: id } });
    await sendMessage(chatId, "📹 Yangi videoni yuboring:");
    return true;
  }
  if (action === "edit_code") {
    const id = parts[2];
    await setDraft(botUser.id, { step: "edit_movie:code", data: { movie_id: id } });
    await sendMessage(chatId, "🔢 Yangi kodni yuboring (faqat raqamlar):");
    return true;
  }
  if (action === "toggle") {
    const id = parts[2];
    const { data: m } = await sb().from("movies").select("is_published").eq("id", id).single();
    await sb().from("movies").update({ is_published: !m?.is_published }).eq("id", id);
    return handleAdminCallback(chatId, messageId, botUser, `adm:movie:${id}`, callbackId);
  }
  if (action === "del") {
    const id = parts[2];
    await sb().from("movies").delete().eq("id", id);
    await sendMessage(chatId, "🗑 O'chirildi.", { reply_markup: backKb() });
    return true;
  }

  // List series
  if (action === "list_series") {
    const page = parseInt(parts[2] ?? "0", 10) || 0;
    const PS = 8;
    const { data, count } = await sb().from("series").select("id,title,year", { count: "exact" })
      .order("created_at", { ascending: false }).range(page * PS, page * PS + PS - 1);
    const rows = (data ?? []).map((s: any) => [{ text: `📺 ${s.title}${s.year ? ` (${s.year})` : ""}`.slice(0, 60), callback_data: `adm:series:${s.id}` }]);
    const total = count ?? 0;
    const pages = Math.max(1, Math.ceil(total / PS));
    const nav: any[] = [];
    if (page > 0) nav.push({ text: "«", callback_data: `adm:list_series:${page - 1}` });
    nav.push({ text: `${page + 1}/${pages}`, callback_data: "adm:noop" });
    if (page + 1 < pages) nav.push({ text: "»", callback_data: `adm:list_series:${page + 1}` });
    if (nav.length) rows.push(nav);
    rows.push([{ text: "« Admin menyu", callback_data: "adm:menu" }]);
    const text = `📚 <b>Seriallar</b> (${total})`;
    if (messageId) try { await editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: rows } }); return true; } catch {}
    await sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } });
    return true;
  }
  if (action === "series") {
    const id = parts[2];
    const { data: s } = await sb().from("series").select("*").eq("id", id).maybeSingle();
    if (!s) { await sendMessage(chatId, "Topilmadi."); return true; }
    const { data: seasons } = await sb().from("seasons").select("id,season_number").eq("series_id", id).order("season_number");
    const rows: any[][] = [];
    (seasons ?? []).forEach((se: any) => rows.push([{ text: `Mavsum ${se.season_number}`, callback_data: `adm:season:${se.id}` }]));
    rows.push([{ text: "➕ Mavsum", callback_data: `adm:add_season:${id}` }, { text: "📤 Kanalga", callback_data: `adm:post_series:${id}` }]);
    rows.push([{ text: "🗑 Serialni o'chirish", callback_data: `adm:del_series:${id}` }]);
    rows.push([{ text: "« Seriallar", callback_data: "adm:list_series:0" }]);
    const text = `📺 <b>${esc(s.title)}</b>\nYil: ${esc(s.year ?? "—")} • Janr: ${esc(s.genre ?? "—")}\nMavsumlar: ${seasons?.length ?? 0}`;
    if (messageId) try { await editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: rows } }); return true; } catch {}
    await sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } });
    return true;
  }
  if (action === "season") {
    const id = parts[2];
    const { data: se } = await sb().from("seasons").select("*, series:series(id,title)").eq("id", id).maybeSingle();
    if (!se) return true;
    const { data: eps } = await sb().from("episodes").select("id,episode_number,title").eq("season_id", id).order("episode_number");
    const rows: any[][] = [];
    (eps ?? []).forEach((e: any) => rows.push([{ text: `${e.episode_number}-qism ${e.title ?? ""}`.trim().slice(0, 50), callback_data: `adm:ep:${e.id}` }]));
    rows.push([{ text: "➕ Qism", callback_data: `adm:add_ep:${id}` }]);
    rows.push([{ text: "🗑 Mavsumni o'chirish", callback_data: `adm:del_season:${id}` }]);
    rows.push([{ text: "« Serial", callback_data: `adm:series:${(se as any).series.id}` }]);
    const text = `📺 <b>${esc((se as any).series.title)}</b> — Mavsum ${se.season_number}\nQismlar: ${eps?.length ?? 0}`;
    if (messageId) try { await editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: rows } }); return true; } catch {}
    await sendMessage(chatId, text, { reply_markup: { inline_keyboard: rows } });
    return true;
  }
  if (action === "ep") {
    const id = parts[2];
    const { data: e } = await sb().from("episodes").select("*, season:seasons(id, season_number, series:series(title))").eq("id", id).maybeSingle();
    if (!e) return true;
    if (e.telegram_file_id) {
      try { await sendVideo(chatId, e.telegram_file_id, `${e.episode_number}-qism ${e.title ?? ""}`); } catch {}
    }
    const kb = { inline_keyboard: [
      [{ text: "🗑 O'chirish", callback_data: `adm:del_ep:${id}` }],
      [{ text: "« Mavsumga qaytish", callback_data: `adm:season:${(e as any).season.id}` }],
    ]};
    await sendMessage(chatId, `🎞 ${e.episode_number}-qism — ${esc(e.title ?? "—")}`, { reply_markup: kb });
    return true;
  }
  if (action === "del_ep") {
    const id = parts[2];
    const { data: e } = await sb().from("episodes").select("season_id").eq("id", id).single();
    await sb().from("episodes").delete().eq("id", id);
    return handleAdminCallback(chatId, messageId, botUser, `adm:season:${e?.season_id}`, callbackId);
  }
  if (action === "del_season") {
    const id = parts[2];
    const { data: se } = await sb().from("seasons").select("series_id").eq("id", id).single();
    await sb().from("seasons").delete().eq("id", id);
    return handleAdminCallback(chatId, messageId, botUser, `adm:series:${se?.series_id}`, callbackId);
  }
  if (action === "del_series") {
    const id = parts[2];
    await sb().from("series").delete().eq("id", id);
    await sendMessage(chatId, "🗑 Serial o'chirildi.", { reply_markup: backKb() });
    return true;
  }

  if (action === "noop") return true;
  return false;
}
