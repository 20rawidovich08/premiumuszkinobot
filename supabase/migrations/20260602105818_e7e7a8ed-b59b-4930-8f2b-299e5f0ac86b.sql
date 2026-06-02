
CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  poster_url text,
  country text,
  year integer,
  genre text,
  imdb_rating numeric,
  language text,
  is_published boolean NOT NULL DEFAULT true,
  views_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT ALL ON public.series TO service_role;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage series" ON public.series FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  season_number integer NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(series_id, season_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage seasons" ON public.seasons FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  episode_number integer NOT NULL,
  title text,
  telegram_file_id text,
  duration_minutes integer,
  views_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, episode_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episodes TO authenticated;
GRANT ALL ON public.episodes TO service_role;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage episodes" ON public.episodes FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

INSERT INTO public.bot_settings (key, value) VALUES ('admin_telegram_ids', '6469777686')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
