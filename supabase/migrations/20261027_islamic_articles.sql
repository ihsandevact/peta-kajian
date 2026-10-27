-- Migrasi: Tabel Sumber Sindikasi Portal Dakwah Sunnah & Artikel Islam
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor

-- 1. Tabel Portal Sumber Dakwah Sunnah
CREATE TABLE IF NOT EXISTS public.article_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                                   -- Contoh: 'Muslim.or.id', 'Rumaysho.com'
  slug text NOT NULL UNIQUE,                            -- Contoh: 'muslim-or-id', 'rumaysho'
  website_url text NOT NULL,                            -- Contoh: 'https://muslim.or.id'
  rss_feed_url text NOT NULL UNIQUE,                    -- Contoh: 'https://muslim.or.id/feed'
  logo_url text,                                        -- Logo portal (opsional)
  organization text,                                    -- Lembaga / Yayasan pengampu
  default_author text DEFAULT 'Asatidzah Ahlus Sunnah', -- Nama penulis default jika tidak tertera di feed
  is_active boolean NOT NULL DEFAULT true,              -- Toggle aktifkan/nonaktifkan sindikasi
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabel Artikel Islam Hasil Sindikasi RSS
CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.article_sources(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text,                                         -- Cuplikan / ringkasan naskah artikel
  content_html text NOT NULL,                           -- Isi artikel yang telah dibersihkan & disanitasi
  canonical_url text NOT NULL UNIQUE,                   -- URL naskah asli di portal asal (Amanah Ilmiah)
  author_name text DEFAULT 'Asatidzah Ahlus Sunnah',    -- Nama ustadz / penulis artikel
  category text DEFAULT 'Umum',                         -- Aqidah, Fiqih, Ibadah, Akhlak, Muamalah, dll.
  tags text[] DEFAULT '{}',
  image_url text,                                       -- Thumbnail gambar artikel jika tersedia
  published_at timestamptz NOT NULL DEFAULT now(),
  read_time_minutes integer DEFAULT 3,                  -- Estimasi waktu membaca dalam menit
  is_featured boolean NOT NULL DEFAULT false,           -- Pin artikel pilihan
  is_published boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indeks performa query
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON public.articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON public.articles(source_id);
CREATE INDEX IF NOT EXISTS idx_article_sources_active ON public.article_sources(is_active);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE public.article_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS:
-- 1. Publik dapat membaca portal sumber yang aktif
DROP POLICY IF EXISTS "Public can view active article sources" ON public.article_sources;
CREATE POLICY "Public can view active article sources" 
  ON public.article_sources 
  FOR SELECT 
  USING (is_active = true);

-- 2. Publik dapat membaca artikel yang berstatus published
DROP POLICY IF EXISTS "Public can view published articles" ON public.articles;
CREATE POLICY "Public can view published articles" 
  ON public.articles 
  FOR SELECT 
  USING (is_published = true);

-- 3. Admin & Service Role memiliki hak kelola penuh atas portal sumber
DROP POLICY IF EXISTS "Admins can manage article sources" ON public.article_sources;
CREATE POLICY "Admins can manage article sources" 
  ON public.article_sources 
  FOR ALL 
  TO authenticated, service_role
  USING (
    (auth.role() = 'service_role') OR (public.is_admin_user(auth.uid()))
  )
  WITH CHECK (
    (auth.role() = 'service_role') OR (public.is_admin_user(auth.uid()))
  );

-- 4. Admin & Service Role memiliki hak kelola penuh atas artikel
DROP POLICY IF EXISTS "Admins can manage articles" ON public.articles;
CREATE POLICY "Admins can manage articles" 
  ON public.articles 
  FOR ALL 
  TO authenticated, service_role
  USING (
    (auth.role() = 'service_role') OR (public.is_admin_user(auth.uid()))
  )
  WITH CHECK (
    (auth.role() = 'service_role') OR (public.is_admin_user(auth.uid()))
  );

-- Seed 4 Portal Dakwah Ahlus Sunnah Terpercaya Awal
INSERT INTO public.article_sources (name, slug, website_url, rss_feed_url, organization, default_author, is_active)
VALUES
  (
    'Muslim.or.id',
    'muslim-or-id',
    'https://muslim.or.id',
    'https://muslim.or.id/feed',
    'Yayasan Pendidikan Islam Al-Atsari (YPIA) Yogyakarta',
    'Asatidzah Muslim.or.id',
    true
  ),
  (
    'Rumaysho.com',
    'rumaysho',
    'https://rumaysho.com',
    'https://rumaysho.com/feed',
    'Pesantren Darush Sholihin Gunungkidul',
    'Ust. Muhammad Abduh Tuasikal, M.Sc.',
    true
  ),
  (
    'KonsultasiSyariah.com',
    'konsultasi-syariah',
    'https://konsultasisyariah.com',
    'https://konsultasisyariah.com/feed',
    'Yufid Network & Asatidzah Pembina',
    'Dewan Pembina Konsultasi Syariah',
    true
  ),
  (
    'Almanhaj.or.id',
    'almanhaj',
    'https://almanhaj.or.id',
    'https://almanhaj.or.id/feed',
    'Yayasan Lajnah Istiqomah Surakarta',
    'Asatidzah Almanhaj',
    true
  )
ON CONFLICT (rss_feed_url) DO UPDATE
SET
  name = EXCLUDED.name,
  website_url = EXCLUDED.website_url,
  organization = EXCLUDED.organization,
  updated_at = now();
