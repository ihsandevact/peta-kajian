-- Migrasi: Penambahan kolom upcoming_streams pada tabel youtube_channels
-- Untuk menyimpan daftar siaran terjadwal mendatang (Upcoming Streams)

ALTER TABLE public.youtube_channels 
ADD COLUMN IF NOT EXISTS upcoming_streams jsonb DEFAULT '[]'::jsonb;

-- Komentar dokumentasi kolom
COMMENT ON COLUMN public.youtube_channels.upcoming_streams IS 'Daftar siaran YouTube mendatang (Upcoming) yang terjadwal dalam 24-48 jam ke depan';
