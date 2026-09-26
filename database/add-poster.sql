-- Tambahkan kolom poster_url ke tabel study_sessions
ALTER TABLE public.study_sessions
ADD COLUMN IF NOT EXISTS poster_url TEXT;

-- Opsi: Berikan komentar pada kolom untuk dokumentasi
COMMENT ON COLUMN public.study_sessions.poster_url IS 'URL gambar poster kajian jika tersedia';
