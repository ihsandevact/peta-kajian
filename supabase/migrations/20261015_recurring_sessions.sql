-- Migrasi Dukungan Sistem Kajian Rutin Terstruktur (Recurring Events)
-- Jalankan di Supabase Dashboard -> SQL Editor

-- 1. Tambahkan kolom recurring_rule bertipe JSONB jika belum ada
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS recurring_rule jsonb;

-- 2. Beri komentar penjelasan pada kolom
COMMENT ON COLUMN study_sessions.recurring_rule IS 'Struktur aturan perulangan jadwal: { dayOfWeek: number, time: string, timeCategory: string, weeks: number[] }';

-- 3. RLS: Izinkan pengguna yang membuat kajian (created_by) untuk meng-update kajian miliknya
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'study_sessions' AND policyname = 'Users can update their own sessions'
  ) THEN
    CREATE POLICY "Users can update their own sessions" 
    ON study_sessions 
    FOR UPDATE 
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;

-- 4. RLS: Izinkan pengguna yang membuat kajian (created_by) untuk men-delete kajian miliknya
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'study_sessions' AND policyname = 'Users can delete their own sessions'
  ) THEN
    CREATE POLICY "Users can delete their own sessions" 
    ON study_sessions 
    FOR DELETE 
    USING (auth.uid() = created_by);
  END IF;
END $$;
