import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listChannelPosts } from "@/lib/admin.functions";
import { Megaphone, Eye, Film, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/posts")({ component: PostsPage });

function PostsPage() {
  const fn = useServerFn(listChannelPosts);
  const { data } = useQuery({ queryKey: ["channel_posts"], queryFn: () => fn() });
  const channelId = (data?.[0] as any)?.channel_id;

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <p className="text-sm text-muted-foreground">Telegram kanaliga yuborilgan postlar</p>
        <h1 className="text-3xl md:text-4xl font-display font-bold">Kanal postlari</h1>
      </div>

      {!data?.length ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Hali kanal posti yo'q.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((p: any) => {
            const link = channelLink(p.channel_id, p.message_id);
            return (
              <article key={p.id} className="glass-card rounded-2xl overflow-hidden hover-lift flex flex-col">
                <Link to="/admin/movies/$id" params={{ id: p.movie?.id }} className="relative aspect-video bg-muted">
                  {p.movie?.poster_url ? (
                    <img src={p.movie.poster_url} alt={p.movie.title} className="w-full h-full object-cover" />
                  ) : <div className="w-full h-full grid place-items-center text-muted-foreground"><Film className="h-10 w-10" /></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                  <span className="absolute top-2 left-2 text-[10px] uppercase tracking-widest rounded-md px-2 py-0.5 bg-emerald/20 text-emerald border border-emerald/30">📢 E'lon qilingan</span>
                </Link>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <h3 className="font-display font-semibold leading-tight line-clamp-2">{p.movie?.title ?? "—"}</h3>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                    {p.movie?.year && <span>{p.movie.year}</span>}
                    {p.movie?.genre && <span>• {p.movie.genre}</span>}
                  </div>
                  <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {p.movie?.views_count ?? 0}</span>
                    <span>{new Date(p.created_at).toLocaleDateString("uz-UZ")}</span>
                  </div>
                  {link && (
                    <a href={link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent/40 transition">
                      <ExternalLink className="h-3.5 w-3.5" /> Telegramda ochish
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function channelLink(channelId: string, messageId: number | string) {
  if (!channelId) return null;
  if (channelId.startsWith("@")) return `https://t.me/${channelId.slice(1)}/${messageId}`;
  if (channelId.startsWith("-100")) return `https://t.me/c/${channelId.slice(4)}/${messageId}`;
  return null;
}
