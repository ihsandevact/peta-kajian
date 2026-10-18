-- Migrasi: Penambahan kolom is_test pada tabel study_sessions
-- Untuk mendukung data kajian pengujian khusus internal admin

ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_study_sessions_is_test 
ON public.study_sessions(is_test);

COMMENT ON COLUMN public.study_sessions.is_test IS 'Flag penanda apakah sesi kajian ini adalah data pengujian khusus admin';
