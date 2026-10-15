-- Migrasi: Daftar Channel Telegram Dinamis & Moderasi Admin
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.telegram_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_username text NOT NULL UNIQUE,     -- Username tanpa @ (misal: 'infokajianbdg')
  channel_title text NOT NULL,                -- Nama Channel / Komunitas
  city text,                                  -- Cakupan Kota/Wilayah (opsional)
  description text,                           -- Deskripsi/catatan (opsional)
  status text NOT NULL DEFAULT 'pending',     -- 'pending' | 'approved' | 'rejected'
  is_active boolean NOT NULL DEFAULT true,    -- Toggle aktif/nonaktif untuk scraping
  rejection_reason text,                      -- Catatan penolakan jika ditolak
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_name text,                     -- Nama pengusul
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indeks performa query
CREATE INDEX IF NOT EXISTS idx_telegram_channels_status_active 
  ON public.telegram_channels(status, is_active);
CREATE INDEX IF NOT EXISTS idx_telegram_channels_submitted_by 
  ON public.telegram_channels(submitted_by);

-- Aktifkan Row Level Security
ALTER TABLE public.telegram_channels ENABLE ROW LEVEL SECURITY;

-- 1. Kebijakan SELECT Publik: Pengguna publik & scraper dapat membaca channel yang approved dan aktif
DROP POLICY IF EXISTS "Allow public read on approved active channels" ON public.telegram_channels;
CREATE POLICY "Allow public read on approved active channels" 
  ON public.telegram_channels 
  FOR SELECT 
  USING (status = 'approved' AND is_active = true);

-- 2. Kebijakan SELECT Pemilik: Pengguna authenticated dapat melihat channel yang mereka ajukan sendiri
DROP POLICY IF EXISTS "Users can read own submitted channels" ON public.telegram_channels;
CREATE POLICY "Users can read own submitted channels" 
  ON public.telegram_channels 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = submitted_by);

-- 3. Kebijakan INSERT Pengguna: Pengguna authenticated dapat mengusulkan channel baru (status otomatis 'pending')
DROP POLICY IF EXISTS "Authenticated users can submit channel proposals" ON public.telegram_channels;
CREATE POLICY "Authenticated users can submit channel proposals" 
  ON public.telegram_channels 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

-- 4. Kebijakan ALL Admin: Admin memiliki kontrol penuh atas semua baris
DROP POLICY IF EXISTS "Admins can manage all telegram channels" ON public.telegram_channels;
CREATE POLICY "Admins can manage all telegram channels" 
  ON public.telegram_channels 
  FOR ALL 
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- Trigger otomatis perbarui kolom updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_telegram_channels_updated_at ON public.telegram_channels;
CREATE TRIGGER trg_telegram_channels_updated_at
  BEFORE UPDATE ON public.telegram_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Seed data awal: Masukkan 10 channel default dengan status approved & is_active = true
INSERT INTO public.telegram_channels (channel_username, channel_title, city, status, is_active)
VALUES
  ('kajianjabodetabek', 'Info Kajian Jabodetabek', 'Jabodetabek', 'approved', true),
  ('infokajian_id', 'Info Kajian Indonesia', 'Nasional', 'approved', true),
  ('grupislamsunnah', 'Grup Islam Sunnah', 'Nasional', 'approved', true),
  ('rumayshocom', 'Rumaysho.Com', 'Gunungkidul / Nasional', 'approved', true),
  ('dzulqarnainms', 'Ustadz Dzulqarnain M. Sunusi', 'Makassar / Nasional', 'approved', true),
  ('khalidbasalamahofficial', 'Ustadz Khalid Basalamah Official', 'Jakarta / Nasional', 'approved', true),
  ('adihidayatofficial', 'Ustadz Adi Hidayat Official', 'Bekasi / Nasional', 'approved', true),
  ('hannan_attaki', 'Ustadz Hanan Attaki', 'Bandung / Nasional', 'approved', true),
  ('felixsiauw', 'Ustadz Felix Siauw', 'Jakarta / Nasional', 'approved', true),
  ('ustadzabdulsomad_official', 'Ustadz Abdul Somad Official', 'Riau / Nasional', 'approved', true)
ON CONFLICT (channel_username) DO NOTHING;
