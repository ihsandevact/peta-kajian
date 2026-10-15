-- Migrasi Role-Based Access Control (Admin & Kontributor), Moderasi Kajian, dan Status Constraint
-- Jalankan di Supabase Dashboard -> SQL Editor

-- 1. Perbarui check constraint status di study_sessions agar mengizinkan 'pending' dan 'rejected'
ALTER TABLE public.study_sessions 
DROP CONSTRAINT IF EXISTS study_sessions_status_check;

ALTER TABLE public.study_sessions 
ADD CONSTRAINT study_sessions_status_check 
CHECK (status IN ('confirmed', 'pending', 'rejected', 'canceled', 'postponed'));

-- 2. Buat tabel user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'kontributor')) DEFAULT 'kontributor',
  is_trusted boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Tambahkan kolom pendukung moderasi pada study_sessions
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- 4. Tetapkan email dev.ihsan.act@gmail.com sebagai Admin Utama
INSERT INTO public.user_roles (user_id, role, is_trusted)
SELECT id, 'admin', true 
FROM auth.users 
WHERE email = 'dev.ihsan.act@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', is_trusted = true;

-- 5. RLS Policy untuk user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Allow public read on user_roles'
  ) THEN
    CREATE POLICY "Allow public read on user_roles" ON public.user_roles FOR SELECT USING (true);
  END IF;
END $$;

-- 6. Bersihkan data lama yang menyimpan string literal 'null' pada kolom opsional
UPDATE public.study_sessions 
SET poster_url = NULL 
WHERE poster_url = 'null' OR poster_url = '' OR lower(poster_url) = 'undefined';

UPDATE public.study_sessions 
SET book_title = NULL 
WHERE book_title = 'null' OR book_title = '' OR lower(book_title) = 'undefined';

UPDATE public.study_sessions 
SET stream_url = NULL 
WHERE stream_url = 'null' OR stream_url = '' OR lower(stream_url) = 'undefined';

UPDATE public.study_sessions 
SET contributor_name = NULL 
WHERE contributor_name = 'null' OR contributor_name = '' OR lower(contributor_name) = 'undefined';

-- 7. Kebijakan RLS untuk update study_sessions (Izin update bagi Admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'study_sessions' AND policyname = 'Allow admins to update study_sessions'
  ) THEN
    CREATE POLICY "Allow admins to update study_sessions" ON public.study_sessions
    FOR UPDATE
    TO authenticated
    USING (
      auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
      OR auth.uid() = created_by
      OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'dev.ihsan.act@gmail.com'
    )
    WITH CHECK (true);
  END IF;
END $$;
