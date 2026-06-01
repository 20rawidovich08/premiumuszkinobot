import { createFileRoute, Link } from "@tanstack/react-router";
import { Film, Bot, Code2, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CineBot — Telegram kino bot platformasi" },
      { name: "description", content: "Telegram kino boti, admin panel, kod tizimi va kanalga avtomatik post qilish uchun platforma." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-lg font-bold">
          <Film className="h-6 w-6 text-primary" /> CineBot
        </div>
        <Link to="/login" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Admin panel</Link>
      </header>
      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <h1 className="max-w-3xl text-5xl font-bold leading-tight md:text-6xl">
          Telegram <span className="text-gradient-primary">kino bot</span> platformasi
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Kinolarni bir marta qo‘shing, kod yarating va kanalga avtomatik joylang. Foydalanuvchi <b>▶️ Tomosha qilish</b> tugmasini bosadi va filmni bot orqali darhol oladi.
        </p>
        <div className="mt-10 flex gap-3">
          <Link to="/login" className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground">Adminni ochish</Link>
          <a href="https://core.telegram.org/bots/api" target="_blank" rel="noreferrer" className="rounded-md border border-border px-6 py-3 font-medium hover:bg-muted">Telegram hujjatlari</a>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-4">
          {[
            { icon: Film, title: "Kinolar", desc: "Poster, maʼlumotlar va video file_id" },
            { icon: Code2, title: "Kodlar", desc: "Bir martalik, limitli yoki cheksiz" },
            { icon: Bot, title: "Bot", desc: "Webhook, deep-link va menyu" },
            { icon: BarChart3, title: "Statistika", desc: "Userlar, ko‘rishlar va top kinolar" },
          ].map((f) => (
            <div key={f.title} className="glass-card rounded-xl p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
