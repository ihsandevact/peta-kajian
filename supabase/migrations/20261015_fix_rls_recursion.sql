-- Perbaikan Bug: Infinite Recursion pada RLS tabel user_roles
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor

-- 1. Hapus kebijakan lama yang memicu rekursi
DROP POLICY IF EXISTS "Admins can manage all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own role row" ON public.user_roles;
DROP POLICY IF EXISTS "Users can request contributor role" ON public.user_roles;
DROP POLICY IF EXISTS "Allow public read on user_roles" ON public.user_roles;

-- 2. Buat fungsi helper SECURITY DEFINER (bypass RLS rekursif secara aman)
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

-- 3. Kebijakan SELECT (Dapat dibaca oleh semua pengguna)
CREATE POLICY "Allow public read on user_roles" 
  ON public.user_roles 
  FOR SELECT 
  USING (true);

-- 4. Kebijakan INSERT (Pengguna authenticated dapat mendaftarkan barisnya sendiri)
CREATE POLICY "Users can insert their own role row" 
  ON public.user_roles 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Kebijakan UPDATE (Pengguna authenticated dapat memperbarui profil/pengajuan sendiri)
CREATE POLICY "Users can request contributor role" 
  ON public.user_roles 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Kebijakan ALL untuk Admin (Memakai fungsi SECURITY DEFINER bebas rekursi)
CREATE POLICY "Admins can manage all user_roles" 
  ON public.user_roles 
  FOR ALL 
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
