-- Migrasi: Penambahan kolom ended_streams pada tabel youtube_channels
-- Untuk menyimpan rekaman video siaran live yang telah selesai (Ended Streams)

ALTER TABLE public.youtube_channels 
ADD COLUMN IF NOT EXISTS ended_streams jsonb DEFAULT '[]'::jsonb;

-- Komentar dokumentasi kolom
COMMENT ON COLUMN public.youtube_channels.ended_streams IS 'Daftar video siaran live yang telah berakhir/selesai (rekaman live) dari channel ini';
