-- Migrasi 3-Tier User Roles ('user', 'kontributor', 'admin') & Permohonan Relawan Dakwah
-- Jalankan di Supabase Dashboard -> SQL Editor

-- 1. Perbarui check constraint pada kolom role di tabel user_roles
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('admin', 'kontributor', 'user'));

-- Ubah default role menjadi 'user' untuk pendaftar baru
ALTER TABLE public.user_roles 
ALTER COLUMN role SET DEFAULT 'user';

-- 2. Tambahkan kolom pendukung permohonan kontributor pada user_roles
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS request_status text NOT NULL DEFAULT 'none' 
CHECK (request_status IN ('none', 'pending', 'approved', 'rejected'));

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS community_name text;

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS whatsapp_number text;

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS request_note text;

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS requested_at timestamptz;

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS email text;

-- 3. Pastikan email dev.ihsan.act@gmail.com tetap Admin
INSERT INTO public.user_roles (user_id, role, is_trusted)
SELECT id, 'admin', true 
FROM auth.users 
WHERE lower(email) = 'dev.ihsan.act@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', is_trusted = true;

-- 4. Pertahankan semua user yang telah memiliki riwayat posting kajian sebagai 'kontributor'
INSERT INTO public.user_roles (user_id, role, is_trusted)
SELECT DISTINCT created_by, 'kontributor', false
FROM public.study_sessions
WHERE created_by IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 5. Perbarui kebijakan RLS untuk user_roles (Bebas infinite recursion)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_user(target_uid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = target_uid AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = target_uid AND lower(email) = 'dev.ihsan.act@gmail.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admins can manage all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own role row" ON public.user_roles;
DROP POLICY IF EXISTS "Users can request contributor role" ON public.user_roles;
DROP POLICY IF EXISTS "Allow public read on user_roles" ON public.user_roles;

CREATE POLICY "Allow public read on user_roles" 
  ON public.user_roles 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own role row" 
  ON public.user_roles 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can request contributor role" 
  ON public.user_roles 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all user_roles" 
  ON public.user_roles 
  FOR ALL 
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- 6. Trigger otomatis untuk membuat baris 'user' saat user baru mendaftar di auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, email, role, is_trusted, request_status)
  VALUES (new.id, new.email, 'user', false, 'none')
  ON CONFLICT (user_id) DO UPDATE SET email = COALESCE(user_roles.email, EXCLUDED.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 7. Sinkronkan email yang ada dari auth.users ke user_roles
UPDATE public.user_roles ur
SET email = au.email
FROM auth.users au
WHERE ur.user_id = au.id AND ur.email IS NULL;
