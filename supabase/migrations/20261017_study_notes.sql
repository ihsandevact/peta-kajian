-- Migrasi Catatan 'Mode Belajar' Penuntut Ilmu (user_study_notes)
-- Jalankan di Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS user_study_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  session_id uuid REFERENCES study_sessions(id) ON DELETE SET NULL,
  title text NOT NULL,
  speaker_name text,
  channel_name text,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_user_video_note UNIQUE (user_id, video_id)
);

-- RLS (Row Level Security)
ALTER TABLE user_study_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_study_notes' AND policyname = 'Users can manage their own study notes'
  ) THEN
    CREATE POLICY "Users can manage their own study notes"
      ON user_study_notes FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_study_notes_user ON user_study_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_study_notes_video ON user_study_notes(video_id);
CREATE INDEX IF NOT EXISTS idx_user_study_notes_updated ON user_study_notes(updated_at DESC);

COMMENT ON TABLE user_study_notes IS 'Catatan faidah kajian penuntut ilmu saat menyimak siaran langsung maupun rekaman';
