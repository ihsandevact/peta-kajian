-- Migrasi: Tabel Riwayat Eksekusi Log Sistem Cron (system_cron_logs)
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.system_cron_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,                    -- 'youtube-tracker' | 'push-reminders' | 'telegram-scraper'
  status text NOT NULL,                      -- 'success' | 'error'
  duration_ms integer DEFAULT 0,             -- Durasi pengerjaan dalam milidetik
  summary jsonb DEFAULT '{}'::jsonb,         -- Ringkasan metrik (items_processed, notifications_sent, dll)
  error_message text,                        -- Pesan error jika status 'error'
  executed_at timestamptz NOT NULL DEFAULT now()
);

-- Indeks performa query untuk pengambilan data log terbaru & filtering per job
CREATE INDEX IF NOT EXISTS idx_system_cron_logs_job_executed 
  ON public.system_cron_logs(job_name, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_cron_logs_executed 
  ON public.system_cron_logs(executed_at DESC);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE public.system_cron_logs ENABLE ROW LEVEL SECURITY;

-- 1. Kebijakan INSERT: Worker cron background (anon / service_role / authenticated) dapat mencatat log
DROP POLICY IF EXISTS "Service role can manage system cron logs" ON public.system_cron_logs;
DROP POLICY IF EXISTS "Allow insert system cron logs" ON public.system_cron_logs;
CREATE POLICY "Allow insert system cron logs" 
  ON public.system_cron_logs 
  FOR INSERT 
  TO anon, authenticated, service_role 
  WITH CHECK (true);

-- 2. Kebijakan SELECT: Admin terautentikasi dan service role dapat membaca log sistem
DROP POLICY IF EXISTS "Admins can view system cron logs" ON public.system_cron_logs;
CREATE POLICY "Admins can view system cron logs" 
  ON public.system_cron_logs 
  FOR SELECT 
  TO authenticated, service_role 
  USING (
    (auth.role() = 'service_role') OR (public.is_admin_user(auth.uid()))
  );

