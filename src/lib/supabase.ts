import { createClient } from '@supabase/supabase-js'

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
