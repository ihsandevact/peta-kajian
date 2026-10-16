-- Migrasi: Penambahan Kolom Status Scraper & Tabel Web Push Subscriptions
-- Jalankan di Supabase SQL Editor

-- 1. Tambah kolom pencatatan waktu & statistik scraping otomatis pada telegram_channels
ALTER TABLE public.telegram_channels 
  ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_scrape_status text,
  ADD COLUMN IF NOT EXISTS last_scrape_count integer DEFAULT 0;

-- 2. Buat tabel penyimpanan langganan Web Push Notification browser
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indeks performa
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- Aktifkan RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy agar browser jamaah (terdaftar maupun anonim) dapat mendaftar push subscription
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Allow public manage push subscriptions'
  ) THEN
    CREATE POLICY "Allow public manage push subscriptions" 
      ON public.push_subscriptions 
      FOR ALL 
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 3. Buat tabel penyimpanan pengingat sesi kajian spesifik (session_reminders)
CREATE TABLE IF NOT EXISTS public.session_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text,
  session_id uuid REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_reminders_session_id ON public.session_reminders(session_id);
CREATE INDEX IF NOT EXISTS idx_session_reminders_user_id ON public.session_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_session_reminders_endpoint ON public.session_reminders(endpoint);

ALTER TABLE public.session_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'session_reminders' AND policyname = 'Allow public manage session reminders'
  ) THEN
    CREATE POLICY "Allow public manage session reminders" 
      ON public.session_reminders 
      FOR ALL 
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

