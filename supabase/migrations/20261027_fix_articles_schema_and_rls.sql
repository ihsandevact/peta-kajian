-- Migrasi: Perbaikan Skema Tabel Articles & Kebijakan RLS untuk Worker Cron
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor

-- 1. Tambah kolom metadata portal pada tabel public.articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_slug text;

-- 2. Indeks untuk performa filtering berdasarkan slug portal sumber
CREATE INDEX IF NOT EXISTS idx_articles_source_slug ON public.articles(source_slug);

-- 3. Kebijakan RLS: Izinkan worker cron dan background sync (anon, authenticated, service_role)
-- untuk melakukan INSERT dan UPDATE (upsert) ke tabel articles
DROP POLICY IF EXISTS "Allow cron sync insert and update articles" ON public.articles;
CREATE POLICY "Allow cron sync insert and update articles" 
  ON public.articles 
  FOR ALL 
  TO anon, authenticated, service_role 
  USING (true)
  WITH CHECK (true);

-- 4. Kebijakan RLS: Pastikan publik tetap dapat membaca artikel yang sudah dipublikasikan
DROP POLICY IF EXISTS "Public can view published articles" ON public.articles;
CREATE POLICY "Public can view published articles" 
  ON public.articles 
  FOR SELECT 
  TO anon, authenticated, service_role
  USING (is_published = true);
