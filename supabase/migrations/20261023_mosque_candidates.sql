-- Migrasi: Katalog Kandidat Masjid (staging) dari Overture Maps
-- File: supabase/migrations/20261023_mosque_candidates.sql
-- Jalankan di Supabase Dashboard -> SQL Editor.
--
-- Data diisi oleh skrip offline `npm run import:mosques` (service role, bypass RLS).
-- Admin mencari di tabel ini lalu mempromosikan masjid terpilih ke tabel `venues`.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.mosque_candidates (
  id                text PRIMARY KEY,              -- Overture GERS id (stabil antar rilis)
  name              text NOT NULL,
  address           text,
  city              text,                          -- addresses[].locality
  province          text,                          -- addresses[].region
  postcode          text,
  lat               double precision NOT NULL,
  lng               double precision NOT NULL,
  confidence        real,                          -- skor keyakinan Overture 0..1
  phone             text,
  website           text,
  sources           jsonb,                         -- dataset asal (meta / msft / foursquare / ...)
  source_release    text,                          -- mis. '2026-09-23.1'
  promoted_venue_id text,                          -- id venues setelah dipromosikan
  promoted_at       timestamptz,
  imported_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_name_trgm     ON public.mosque_candidates USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mc_city_trgm     ON public.mosque_candidates USING gin (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mc_province_trgm ON public.mosque_candidates USING gin (province gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mc_latlng        ON public.mosque_candidates (lat, lng);
CREATE INDEX IF NOT EXISTS idx_mc_unpromoted    ON public.mosque_candidates (confidence DESC) WHERE promoted_venue_id IS NULL;

-- RLS: hanya admin yang boleh membaca & mengubah (pakai helper is_admin_user dari 20261015_fix_rls_recursion.sql)
ALTER TABLE public.mosque_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read mosque candidates" ON public.mosque_candidates;
CREATE POLICY "Admins can read mosque candidates"
  ON public.mosque_candidates FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update mosque candidates" ON public.mosque_candidates;
CREATE POLICY "Admins can update mosque candidates"
  ON public.mosque_candidates FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
