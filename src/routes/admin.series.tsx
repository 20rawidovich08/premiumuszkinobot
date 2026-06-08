import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listSeries } from "@/lib/admin.functions";
import { Tv, Star } from "lucide-react";

export const Route = createFileRoute("/admin/series")({ component: SeriesPage });

function SeriesPage() {
  const fn = useServerFn(listSeries);
  const { data } = useQuery({ queryKey: ["series"], queryFn: () => fn() });

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <p className="text-sm text-muted-foreground">Seriallar katalogi</p>
        <h1 className="text-3xl md:text-4xl font-display font-bold">Seriallar</h1>
      </div>

      {!data?.length ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <Tv className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Hali serial qo'shilmagan.</p>
          <p className="text-xs text-muted-foreground mt-2">Seriallar bot orqali qo'shiladi.</p>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.map((s: any) => (
            <article key={s.id} className="glass-card rounded-2xl overflow-hidden hover-lift flex flex-col">
              <div className="relative aspect-[2/3] bg-muted overflow-hidden">
                {s.poster_url ? (
                  <img src={s.poster_url} alt={s.title} className="w-full h-full object-cover" />
                ) : <div className="w-full h-full grid place-items-center text-muted-foreground"><Tv className="h-10 w-10" /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                {s.imdb_rating != null && (
                  <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-background/70 backdrop-blur px-1.5 py-0.5 text-[11px] font-medium">
                    <Star className="h-3 w-3 text-amber" /> {s.imdb_rating}
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="text-sm font-semibold leading-tight line-clamp-2">{s.title}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{s.year} {s.genre && `• ${s.genre}`}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
