import { createFileRoute, Link } from "@tanstack/react-router";
import { Film, Bot, Code2, BarChart3, Sparkles, ArrowRight, Tv, Radio } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CineBot — Telegram kino bot platformasi" },
      { name: "description", content: "Telegram kino boti, admin panel, kod tizimi va kanalga avtomatik post qilish uchun platforma." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Film,      title: "Kinolar",     desc: "Poster, ma'lumotlar va video file_id", tone: "stat-magenta", iconClass: "text-magenta" },
  { icon: Tv,        title: "Seriallar",   desc: "Mavsum va qismlar bilan to'liq tizim", tone: "stat-violet",  iconClass: "text-violet" },
  { icon: Code2,     title: "Kodlar",      desc: "Bir martalik, limitli yoki cheksiz",   tone: "stat-cyan",    iconClass: "text-cyan" },
  { icon: Bot,       title: "Bot",         desc: "Webhook, deep-link va inline menyu",   tone: "stat-amber",   iconClass: "text-amber" },
  { icon: Radio,     title: "Avto-post",   desc: "Kanalga rasm + tugma bilan post",      tone: "stat-emerald", iconClass: "text-emerald" },
  { icon: BarChart3, title: "Statistika",  desc: "Userlar, ko'rishlar va top kinolar",   tone: "stat-rose",    iconClass: "text-destructive" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center h-9 w-9 rounded-xl btn-gradient">
            <Film className="h-5 w-5" />
          </div>
          <span className="font-display font-bold text-xl">
            Cine<span className="text-gradient-primary">Bot</span>
          </span>
        </div>
        <Link to="/login" className="btn-gradient rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2">
          Admin panel <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-12 pb-24">
        <div className="inline-flex items-center gap-2 rounded-full glass-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-magenta" />
          Yangi: serial tizimi va rangli admin paneli
        </div>
        <h1 className="mt-6 max-w-4xl font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
          Telegram <span className="text-gradient-primary">kino bot</span><br />
          platformasi
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Kinolarni bir marta qo'shing, kod yarating va kanalga avtomatik joylang.
          Foydalanuvchi <b className="text-foreground">▶️ Tomosha qilish</b> tugmasini bosadi va filmni bot orqali darhol oladi.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/login" className="btn-gradient rounded-lg px-6 py-3 font-medium inline-flex items-center gap-2">
            Adminni ochish <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="https://t.me/" target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-card/40 backdrop-blur px-6 py-3 font-medium hover:bg-accent/50 transition">
            Botni sinash
          </a>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className={`${f.tone} rounded-2xl p-6 border backdrop-blur-md transition hover:scale-[1.02]`}>
              <div className={`grid place-items-center h-11 w-11 rounded-xl bg-background/40 ${f.iconClass}`}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display font-semibold text-lg">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
