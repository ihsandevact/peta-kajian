-- Migrasi Dukungan Bookmark dan RSVP Kehadiran Jamaah (Hybrid Model)
-- Jalankan di Supabase Dashboard -> SQL Editor

-- 1. Tambahkan kolom attendees_count pada tabel study_sessions jika belum ada
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS attendees_count int DEFAULT 0;
COMMENT ON COLUMN study_sessions.attendees_count IS 'Jumlah total jamaah yang berencana hadir (RSVP) ke kajian ini';

-- 2. Buat tabel user_bookmarks (Penyimpanan Bookmark Jamaah Terdaftar)
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_user_session_bookmark UNIQUE (user_id, session_id)
);

-- RLS untuk user_bookmarks
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_bookmarks' AND policyname = 'Users can manage their own bookmarks'
  ) THEN
    CREATE POLICY "Users can manage their own bookmarks"
      ON user_bookmarks FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON user_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_session ON user_bookmarks(session_id);

-- 3. Buat tabel session_attendees (Pencatatan Kehadiran Jamaah Terdaftar maupun Anonim)
CREATE TABLE IF NOT EXISTS session_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text, -- Identifier acak browser untuk mencegah double-count anonim
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_attendee_identity CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

-- Constraint unik untuk mencegah duplikasi: satu user atau satu device hanya bisa 1 kali hadir per sesi
CREATE UNIQUE INDEX IF NOT EXISTS uq_session_user_idx ON session_attendees (session_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_session_device_idx ON session_attendees (session_id, device_id) WHERE device_id IS NOT NULL AND user_id IS NULL;

-- RLS untuk session_attendees
ALTER TABLE session_attendees ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'session_attendees' AND policyname = 'Public read session attendees'
  ) THEN
    CREATE POLICY "Public read session attendees"
      ON session_attendees FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'session_attendees' AND policyname = 'Users and anon can insert attendance'
  ) THEN
    CREATE POLICY "Users and anon can insert attendance"
      ON session_attendees FOR INSERT
      WITH CHECK (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
        (auth.uid() IS NULL AND device_id IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'session_attendees' AND policyname = 'Users and anon can delete their own attendance'
  ) THEN
    CREATE POLICY "Users and anon can delete their own attendance"
      ON session_attendees FOR DELETE
      USING (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
        (auth.uid() IS NULL AND device_id IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'session_attendees' AND policyname = 'Users can claim device attendance upon login'
  ) THEN
    CREATE POLICY "Users can claim device attendance upon login"
      ON session_attendees FOR UPDATE
      USING (
        auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid())
      )
      WITH CHECK (
        auth.uid() IS NOT NULL AND user_id = auth.uid()
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_attendees_session ON session_attendees(session_id);
CREATE INDEX IF NOT EXISTS idx_session_attendees_user ON session_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_session_attendees_device ON session_attendees(device_id);

-- 4. Database Trigger untuk update otomatis kolom attendees_count di study_sessions
CREATE OR REPLACE FUNCTION fn_update_attendees_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE study_sessions
    SET attendees_count = COALESCE(attendees_count, 0) + 1
    WHERE id = NEW.session_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE study_sessions
    SET attendees_count = GREATEST(0, COALESCE(attendees_count, 0) - 1)
    WHERE id = OLD.session_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_attendees_count ON session_attendees;
CREATE TRIGGER trg_attendees_count
AFTER INSERT OR DELETE ON session_attendees
FOR EACH ROW EXECUTE FUNCTION fn_update_attendees_count();
