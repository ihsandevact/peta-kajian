import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin / Service Client untuk background worker, cron job, dan server task.
 * Menggunakan SUPABASE_SERVICE_ROLE_KEY jika tersedia (bypass RLS), 
 * atau fallback ke anon key.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
