// Bot business logic — server-only
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendMessage,
  sendPhoto,
  sendVideo,
  answerCallbackQuery,
  editMessageText,
  mainMenuKeyboard,
  deepLink,
} from "./telegram.server";
import { writeTelegramLog } from "./telegram-log.server";

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

// userState: waiting for movie request name, code entry, etc.
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
  console.log(`Upserting user: ${u.id} (@${u.username || "no_username"})`);
  try {
    const { data: existing, error: selectError } = await sb()
      .from("bot_users")
      .select("*")
      .eq("telegram_id", u.id)
      .maybeSingle();
    
    if (selectError) {
      console.error("Error selecting user from bot_users:", selectError);
      throw selectError;
    }

    if (existing) {
      console.log(`User ${u.id} exists, updating...`);
      const { error: updateError } = await sb()
        .from("bot_users")
        .update({
          username: u.username,
          first_name: u.first_name,
          last_name: u.last_name,
          language_code: u.language_code,
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      
      if (updateError) {
        console.error("Error updating user in bot_users:", updateError);
        throw updateError;
      }
      return existing;
    }

    console.log(`User ${u.id} is new, inserting...`);
    const { data: created, error: insertError } = await sb()
      .from("bot_users")
      .insert({
        telegram_id: u.id,
        username: u.username,
        first_name: u.first_name,
        last_name: u.last_name,
        language_code: u.language_code,
      })
      .select("*")
      .single();
    
    if (insertError) {
      console.error("Error inserting user into bot_users:", insertError);
      throw insertError;
    }
    return created!;
  } catch (err) {
    console.error("Catch-all error in upsertUser:", err);
    throw err;
  }
}

// ... fmtMovieCaption and escapeHtml ...

async function deliverMovieByCode(chatId: number, botUser: any, rawCode: string) {
  try {
    const code = rawCode.trim();
    console.log(`Delivering movie for code: "${code}" to chatId: ${chatId}`);
// ... rest of deliverMovieByCode ...

    const { data: codeRow, error: codeError } = await sb()
      .from("movie_codes")
      .select("*, movie:movies(*)")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (codeError) throw codeError;

    if (!codeRow || !codeRow.movie) {
      await sendMessage(chatId, "❌ Kechirasiz, bunday kod topilmadi yoki bu kod endi faol emas. Iltimos, kodni qayta tekshirib ko'ring.");
      return;
    }

    if (codeRow.mode === "single" && codeRow.uses_count >= 1) {
      await sendMessage(chatId, "❌ Bu bir martalik kod allaqachon ishlatilgan.");
      return;
    }

    if (codeRow.mode === "limited" && codeRow.max_uses && codeRow.uses_count >= codeRow.max_uses) {
      await sendMessage(chatId, "❌ Bu kodning foydalanish limiti tugagan.");
      return;
    }

    const movie = codeRow.movie as any;
    const caption = fmtMovieCaption(movie);

    if (movie.poster_url) {
      try {
        await sendPhoto(chatId, movie.poster_url, caption);
      } catch (e) {
        console.error("Failed to send photo, sending text instead:", e);
        await sendMessage(chatId, caption);
      }
    } else {
      await sendMessage(chatId, caption);
    }

    if (movie.telegram_file_id) {
      try {
        await sendVideo(chatId, movie.telegram_file_id, `🎬 <b>${escapeHtml(movie.title)}</b>`);
      } catch (e) {
        console.error("Failed to send video:", e);
        await sendMessage(chatId, "⚠️ Videoni yuborishda xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.");
      }
    } else {
      await sendMessage(chatId, "⚠️ Bu kino uchun video fayl hali yuklanmagan.");
    }

    // record usage + view
    await sb()
      .from("movie_codes")
      .update({
        uses_count: codeRow.uses_count + 1,
        is_active:
          codeRow.mode === "single"
            ? false
            : codeRow.mode === "limited" && codeRow.max_uses && codeRow.uses_count + 1 >= codeRow.max_uses
              ? false
              : true,
      })
      .eq("id", codeRow.id);

    await sb().from("movie_views").insert({
      movie_id: movie.id,
      bot_user_id: botUser.id,
      code_id: codeRow.id,
    });

    await sb()
      .from("movies")
      .update({ views_count: (movie.views_count ?? 0) + 1 })
      .eq("id", movie.id);

    await sb()
      .from("bot_users")
      .update({ movies_watched: (botUser.movies_watched ?? 0) + 1 })
      .eq("id", botUser.id);
      
  } catch (error) {
    console.error("Error in deliverMovieByCode:", error);
    await sendMessage(chatId, "❌ Texnik xatolik yuz berdi. Iltimos, birozdan so'ng qayta urinib ko'ring.");
  }
}

async function showProfile(chatId: number, botUser: any) {
  const since = new Date(botUser.created_at).toLocaleDateString();
  await sendMessage(
    chatId,
    [
      "👤 <b>Profilim</b>",
      "",
      `🆔 Telegram ID: <code>${botUser.telegram_id}</code>`,
      `👤 Ism: ${escapeHtml(botUser.first_name ?? "—")}`,
      `📅 Ro'yxatdan o'tgan: ${since}`,
      `🎬 Ko'rilgan kinolar: <b>${botUser.movies_watched ?? 0}</b>`,
      `✅ Holat: ${botUser.is_blocked ? "Bloklangan" : "Faol"}`,
    ].join("\n"),
  );
}

const PAGE_SIZE = 8;

type CatalogSort = "new" | "top";

async function fetchCatalog(sort: CatalogSort, genre: string | null, page: number) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  let q = sb().from("movies").select("id,title,year,views_count,genre", { count: "exact" }).eq("is_published", true);
  if (genre) q = q.ilike("genre", `%${genre}%`);
  q = sort === "top"
    ? q.order("views_count", { ascending: false })
    : q.order("created_at", { ascending: false });
  const { data, count } = await q.range(from, to);
  return { data: data ?? [], total: count ?? 0 };
}

function catalogKeyboard(items: any[], sort: CatalogSort, genre: string | null, page: number, total: number) {
  const rows: any[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    const row = items.slice(i, i + 2).map((m) => ({
      text: `${m.title}${m.year ? ` (${m.year})` : ""}`.slice(0, 60),
      callback_data: `mv:${m.id}`,
    }));
    rows.push(row);
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const nav: any[] = [];
  const g = genre ?? "-";
  if (page > 0) nav.push({ text: "« Oldingi", callback_data: `cat:${sort}:${g}:${page - 1}` });
  nav.push({ text: `${page + 1}/${totalPages}`, callback_data: "noop" });
  if (page + 1 < totalPages) nav.push({ text: "Keyingi »", callback_data: `cat:${sort}:${g}:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([
    { text: sort === "new" ? "✅ 🆕 Yangi" : "🆕 Yangi", callback_data: `cat:new:${g}:0` },
    { text: sort === "top" ? "✅ 🏆 Top" : "🏆 Top", callback_data: `cat:top:${g}:0` },
  ]);
  rows.push([{ text: "🎭 Janrlar", callback_data: "genres" }]);
  return { inline_keyboard: rows };
}

function catalogTitle(sort: CatalogSort, genre: string | null, total: number) {
  const head = sort === "top" ? "🏆 <b>Eng ko'p ko'rilgan kinolar</b>" : "🆕 <b>Yangi kinolar</b>";
  const g = genre ? `\n🎭 Janr: <b>${escapeHtml(genre)}</b>` : "";
  return `${head}${g}\n📚 Jami: ${total}\n\nKino tanlang 👇`;
}

async function showCatalog(chatId: number, sort: CatalogSort, genre: string | null, page: number) {
  const { data, total } = await fetchCatalog(sort, genre, page);
  if (!total) return sendMessage(chatId, "Hozircha kinolar yo'q.");
  await sendMessage(chatId, catalogTitle(sort, genre, total), { reply_markup: catalogKeyboard(data, sort, genre, page, total) });
}

async function editCatalog(chatId: number, messageId: number, sort: CatalogSort, genre: string | null, page: number) {
  const { data, total } = await fetchCatalog(sort, genre, page);
  await editMessageText(chatId, messageId, catalogTitle(sort, genre, total), { reply_markup: catalogKeyboard(data, sort, genre, page, total) });
}

async function showGenres(chatId: number, messageId?: number) {
  const { data } = await sb().from("movies").select("genre").eq("is_published", true).not("genre", "is", null);
  const set = new Set<string>();
  (data ?? []).forEach((r: any) => {
    String(r.genre ?? "").split(/[,/]/).forEach((g) => {
      const t = g.trim();
      if (t) set.add(t);
    });
  });
  const genres = [...set].sort().slice(0, 24);
  const rows: any[][] = [];
  for (let i = 0; i < genres.length; i += 3) {
    rows.push(genres.slice(i, i + 3).map((g) => ({ text: g, callback_data: `cat:new:${g}:0` })));
  }
  rows.push([{ text: "🔄 Barchasi", callback_data: "cat:new:-:0" }]);
  const text = genres.length ? "🎭 <b>Janrni tanlang</b>" : "🎭 Hozircha janrlar mavjud emas.";
  const kb = { inline_keyboard: rows };
  if (messageId) await editMessageText(chatId, messageId, text, { reply_markup: kb });
  else await sendMessage(chatId, text, { reply_markup: kb });
}

async function deliverMovieById(chatId: number, botUser: any, movieId: string) {
  const { data: movie } = await sb().from("movies").select("*").eq("id", movieId).eq("is_published", true).maybeSingle();
  if (!movie) return sendMessage(chatId, "❌ Kino topilmadi.");
  const caption = fmtMovieCaption(movie);
  if (movie.poster_url) {
    try { await sendPhoto(chatId, movie.poster_url, caption); } catch { await sendMessage(chatId, caption); }
  } else {
    await sendMessage(chatId, caption);
  }
  if (movie.telegram_file_id) {
    try { await sendVideo(chatId, movie.telegram_file_id, `🎬 <b>${escapeHtml(movie.title)}</b>`); }
    catch (e) { console.error("sendVideo failed", e); await sendMessage(chatId, "⚠️ Videoni yuborishda xatolik."); }
  } else {
    await sendMessage(chatId, "⚠️ Bu kino uchun video fayl hali yuklanmagan.");
  }
  await sb().from("movie_views").insert({ movie_id: movie.id, bot_user_id: botUser.id });
  await sb().from("movies").update({ views_count: (movie.views_count ?? 0) + 1 }).eq("id", movie.id);
  await sb().from("bot_users").update({ movies_watched: (botUser.movies_watched ?? 0) + 1 }).eq("id", botUser.id);
}

export async function handleUpdate(update: any) {
  const callback = update.callback_query;
  if (callback) {
    await writeTelegramLog({
      kind: "callback",
      status: "ok",
      update_id: update.update_id,
      chat_id: callback.message?.chat?.id ?? null,
      telegram_user_id: callback.from?.id ?? null,
      callback_data: callback.data ?? null,
      request_payload: update,
    });
    await answerCallbackQuery(callback.id, "Qabul qilindi");
    if (callback.data?.startsWith("code:")) {
      const chatId = callback.message?.chat?.id;
      if (chatId && callback.from) {
        const botUser = await upsertUser(callback.from as TgUser);
        await deliverMovieByCode(chatId, botUser, callback.data.slice(5));
      }
    }
    return;
  }

  const msg = update.message ?? update.edited_message;
  if (!msg?.from) {
    await writeTelegramLog({ kind: "webhook", status: "ignored", update_id: update.update_id, request_payload: update, error_message: "Xabar foydalanuvchidan kelmagan yoki qo‘llab-quvvatlanmaydigan update" });
    return;
  }
  const from = msg.from as TgUser;
  if ((from as any).is_bot) return;
  const chatId = msg.chat.id as number;
  const botUser = await upsertUser(from);

  const text: string = msg.text ?? "";

  // /start [param]
  if (text.startsWith("/start")) {
    const param = text.replace(/^\/start(?:=|\s+)?/i, "").trim();
    if (param) {
      await deliverMovieByCode(chatId, botUser, param);
      return;
    }
    await sendMessage(
      chatId,
      [
        `🎬 <b>Assalomu alaykum, ${escapeHtml(from.first_name ?? "")}!</b>`,
        "",
        "Bu yerda eng so'nggi kinolarni topishingiz mumkin.",
        "Quyidagi menyudan tanlang yoki kino kodini yuboring 👇",
      ].join("\n"),
      { reply_markup: mainMenuKeyboard() },
    );
    return;
  }

  if (text === "/menu") {
    await sendMessage(chatId, "Menyu:", { reply_markup: mainMenuKeyboard() });
    return;
  }

  // Menu buttons
  if (text === "🎬 Kino olish" || text === "🔎 Kod kiritish") {
    await setState(botUser.id, "await_code");
    await sendMessage(chatId, "🔢 Kino kodini yuboring:");
    return;
  }
  if (text === "🆕 Yangi kinolar") return showCatalog(chatId, "new", null, 0);
  if (text === "🏆 Top kinolar") return showCatalog(chatId, "top", null, 0);
  if (text === "🎭 Janrlar") return showGenres(chatId);
  if (text === "👤 Profilim") return showProfile(chatId, botUser);
  if (text === "📞 Admin bilan bog'lanish") {
    const { data } = await sb().from("bot_settings").select("value").eq("key", "admin_contact").maybeSingle();
    return sendMessage(chatId, `📞 Admin: ${data?.value ?? "@admin"}`);
  }
  if (text === "🎬 Kino buyurtma qilish") {
    await setState(botUser.id, "await_request");
    await sendMessage(chatId, "✍️ Qaysi kinoni qidirayapsiz? Nomini yuboring:");
    return;
  }

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
    await sendMessage(chatId, "✅ Buyurtma qabul qilindi. Admin tez orada javob beradi.");
    return;
  }

  // Fallback: treat plain text as a code attempt
  if (text && /^[\w\-]{2,32}$/.test(text)) {
    await deliverMovieByCode(chatId, botUser, text);
    return;
  }
  await sendMessage(chatId, "Menyudan tanlang yoki kino kodini yuboring.", { reply_markup: mainMenuKeyboard() });
}

export async function autoPostMovieToChannel(movieId: string) {
  const chId = process.env.TELEGRAM_CHANNEL_ID;
  if (!chId) throw new Error("TELEGRAM_CHANNEL_ID not configured");
  const { data: movie } = await sb().from("movies").select("*").eq("id", movieId).single();
  if (!movie) throw new Error("Movie not found");
  // Pick the first active code, or create a permanent random one
  let { data: code } = await sb()
    .from("movie_codes")
    .select("*")
    .eq("movie_id", movieId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!code) {
    const auto = `M${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data: c2 } = await sb()
      .from("movie_codes")
      .insert({ code: auto, movie_id: movieId, mode: "unlimited" })
      .select("*")
      .single();
    code = c2;
  }
  const caption = fmtMovieCaption(movie) + "\n\n👇 Tomosha qilish uchun tugmani bosing";
  const keyboard = {
    inline_keyboard: [[{ text: "▶️ TOMOSHA QILISH", url: deepLink(code!.code) }]],
  };
  let res: any;
  if (movie.poster_url) {
    res = await sendPhoto(chId, movie.poster_url, caption, { reply_markup: keyboard });
  } else {
    res = await sendMessage(chId, caption, { reply_markup: keyboard });
  }
  await sb().from("channel_posts").insert({
    movie_id: movieId,
    channel_id: chId,
    message_id: res.message_id,
  });
  return res;
}
