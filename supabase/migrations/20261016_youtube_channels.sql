-- Migrasi: Tabel Channel YouTube Live Dakwah & Tracking Otomatis
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.youtube_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name text NOT NULL,                    -- Contoh: 'Rodja TV', 'Yufid TV'
  channel_handle text NOT NULL UNIQUE,           -- Contoh: '@rodjatv' atau 'rodjatv'
  channel_id text,                               -- Channel ID YouTube (opsional)
  avatar_url text,                               -- Logo channel (opsional)
  default_speaker_name text DEFAULT 'Asatidzah', -- Pemateri cadangan jika judul video tidak memuat nama
  default_city text DEFAULT 'Nasional',          -- Wilayah siaran (opsional)
  is_active boolean NOT NULL DEFAULT true,       -- Toggle pantau/nonaktifkan
  is_currently_live boolean NOT NULL DEFAULT false, -- Status live saat ini
  current_video_id text,                         -- ID video siaran yang sedang live
  current_video_title text,                      -- Judul siaran live terkini
  current_session_id uuid REFERENCES public.study_sessions(id) ON DELETE SET NULL,
  last_checked_at timestamptz,
  last_live_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indeks performa query
CREATE INDEX IF NOT EXISTS idx_youtube_channels_active 
  ON public.youtube_channels(is_active);
CREATE INDEX IF NOT EXISTS idx_youtube_channels_currently_live 
  ON public.youtube_channels(is_currently_live);

-- Aktifkan Row Level Security
ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;

-- 1. Kebijakan SELECT Publik: Pengguna publik dapat membaca channel yang aktif
DROP POLICY IF EXISTS "Allow public read active youtube channels" ON public.youtube_channels;
CREATE POLICY "Allow public read active youtube channels" 
  ON public.youtube_channels 
  FOR SELECT 
  USING (is_active = true);

-- 2. Kebijakan ALL Admin: Admin memiliki kontrol penuh atas seluruh channel youtube
DROP POLICY IF EXISTS "Admins can manage all youtube channels" ON public.youtube_channels;
CREATE POLICY "Admins can manage all youtube channels" 
  ON public.youtube_channels 
  FOR ALL 
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- Seed Channel Dakwah Sunnah Rekomendasi Awal
INSERT INTO public.youtube_channels (channel_name, channel_handle, default_speaker_name, default_city, is_active)
VALUES 
  ('Radio & TV Rodja', '@rodjatv', 'Asatidzah Radio Rodja', 'Cileungsi / Nasional', true),
  ('Yufid TV', '@yufidtv', 'Asatidzah Yufid', 'Yogyakarta / Nasional', true),
  ('Ashiil TV', '@AshiilTV', 'Asatidzah Ashiil TV', 'Bekasi / Nasional', true),
  ('Surau TV Padang', '@SurauTVPadang', 'Asatidzah Surau TV', 'Padang / Nasional', true),
  ('Tarbiyah Sunnah Media', '@tarbiyahsunnah', 'Asatidzah Tarbiyah Sunnah', 'Bandung / Nasional', true),
  ('Radio Muslim Jogja', '@radiomuslimjogja', 'Asatidzah Radio Muslim', 'Yogyakarta / Nasional', true),
  ('Firanda Andirja Official', '@firandaandirjaofficial', 'Ust. Dr. Firanda Andirja, M.A.', 'Jakarta / Nasional', true),
  ('Syafiq Riza Basalamah Official', '@SyafiqRizaBasalamahOfficial', 'Ust. Dr. Syafiq Riza Basalamah, M.A.', 'Jember / Nasional', true),
  ('Khalid Basalamah Official', '@khalidbasalamahofficial', 'Ust. Dr. Khalid Basalamah, M.A.', 'Jakarta / Nasional', true)
ON CONFLICT (channel_handle) DO NOTHING;
