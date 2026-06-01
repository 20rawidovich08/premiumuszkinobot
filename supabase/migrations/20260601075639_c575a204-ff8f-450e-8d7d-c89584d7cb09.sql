CREATE TABLE public.telegram_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  level text NOT NULL DEFAULT 'info',
  kind text NOT NULL DEFAULT 'webhook',
  status text NOT NULL DEFAULT 'ok',
  update_id bigint,
  chat_id bigint,
  telegram_user_id bigint,
  telegram_method text,
  callback_data text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  duration_ms integer
);

GRANT SELECT ON public.telegram_logs TO authenticated;
GRANT ALL ON public.telegram_logs TO service_role;

ALTER TABLE public.telegram_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view telegram logs"
ON public.telegram_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_telegram_logs_created_at ON public.telegram_logs (created_at DESC);
CREATE INDEX idx_telegram_logs_update_id ON public.telegram_logs (update_id);
CREATE INDEX idx_telegram_logs_kind_status ON public.telegram_logs (kind, status);

ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_logs;