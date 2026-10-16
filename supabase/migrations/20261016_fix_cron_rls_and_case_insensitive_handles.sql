-- Migrasi: Pembersihan Duplikasi Channel YouTube & Kebijakan Update Cron
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor

-- 1. Bersihkan channel duplikat (Radio Muslim Jogja yang memiliki dua handle case berbeda)
DELETE FROM public.youtube_channels 
WHERE id = 'a73c0e7f-078f-4b8f-9045-0092008b6165';

-- 2. Normalisasi semua handle channel yang ada menjadi huruf kecil (lowercase)
UPDATE public.youtube_channels 
SET channel_handle = LOWER(TRIM(channel_handle));

-- 3. Buat unique index case-insensitive agar tidak bisa terjadi duplikasi huruf besar/kecil lagi
CREATE UNIQUE INDEX IF NOT EXISTS idx_youtube_channels_lower_handle 
  ON public.youtube_channels(LOWER(channel_handle));

-- 4. Bersihkan study_sessions buatan bot live sync yang sudah selesai
DELETE FROM public.study_sessions 
WHERE contributor_name ILIKE '%Bot Sync%';

-- 5. Kebijakan RLS agar background cron tracker dapat memperbarui status live channel
DROP POLICY IF EXISTS "Allow anon update live status on youtube_channels" ON public.youtube_channels;
CREATE POLICY "Allow anon update live status on youtube_channels" 
  ON public.youtube_channels 
  FOR UPDATE 
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Kebijakan RLS agar bot scraper dapat mendaftarkan channel baru & mengupdate telegram_channels
DROP POLICY IF EXISTS "Allow anon update telegram channels scrape stats" ON public.telegram_channels;
CREATE POLICY "Allow anon update telegram channels scrape stats" 
  ON public.telegram_channels 
  FOR UPDATE 
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert auto registered youtube channels" ON public.youtube_channels;
CREATE POLICY "Allow anon insert auto registered youtube channels" 
  ON public.youtube_channels 
  FOR INSERT 
  TO anon, authenticated
  WITH CHECK (true);
