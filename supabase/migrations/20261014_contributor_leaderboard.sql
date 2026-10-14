-- Migrasi Pelacakan Kontributor & Leaderboard
-- Jalankan di Supabase Dashboard -> SQL Editor bila ingin mencatat id user di DB

ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS contributor_name text;

-- Index untuk performa leaderboard
CREATE INDEX IF NOT EXISTS idx_study_sessions_contributor ON study_sessions(contributor_name);
