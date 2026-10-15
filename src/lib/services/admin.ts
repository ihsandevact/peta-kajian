import { supabase } from '../supabase';
import type { StudySession } from './kajian';

export const ADMIN_EMAILS = [
  'dev.ihsan.act@gmail.com',
];

/**
 * Pengecekan apakah user memiliki hak akses admin:
 * 1. Email ada di whitelist ADMIN_EMAILS
 * 2. ATAU role di tabel user_roles bernilai 'admin'
 */
export async function checkIsAdmin(user: { id?: string; email?: string } | null): Promise<boolean> {
  if (!user) return false;

  // 1. Cek whitelist email
  if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim())) {
    return true;
  }

  // 2. Cek database user_roles
  if (user.id) {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data?.role === 'admin') {
        return true;
      }
    } catch {
      // Abaikan jika tabel belum termigrasi
    }
  }

  return false;
}

/**
 * Mendapatkan role dan status kepercayaan (isTrusted) user
 */
export async function getUserRoleAndStatus(user: { id: string; email?: string }): Promise<{
  role: 'admin' | 'kontributor';
  isTrusted: boolean;
}> {
  const isAdminByEmail = user.email ? ADMIN_EMAILS.includes(user.email.toLowerCase().trim()) : false;

  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role, is_trusted')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      return {
        role: isAdminByEmail ? 'admin' : (data.role as 'admin' | 'kontributor') || 'kontributor',
        isTrusted: isAdminByEmail ? true : !!data.is_trusted,
      };
    }
  } catch {
    // Fallback
  }

  return {
    role: isAdminByEmail ? 'admin' : 'kontributor',
    isTrusted: isAdminByEmail,
  };
}

/**
 * Mengambil daftar sesi berdasarkan status moderasi
 */
export async function fetchSessionsByStatus(status: 'pending' | 'confirmed' | 'rejected' | 'all'): Promise<StudySession[]> {
  try {
    let query = supabase
      .from('study_sessions')
      .select(`
        *,
        venues (*)
      `);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin sessions:', error);
      return [];
    }

    return (data || []) as StudySession[];
  } catch (err) {
    console.error('Fetch Admin Sessions Exception:', err);
    return [];
  }
}

/**
 * Statistik ringkas untuk dashboard moderasi
 */
export async function fetchAdminStats(): Promise<{
  pending: number;
  confirmed: number;
  rejected: number;
  total: number;
}> {
  try {
    const { data } = await supabase
      .from('study_sessions')
      .select('status');

    if (!data) {
      return { pending: 0, confirmed: 0, rejected: 0, total: 0 };
    }

    let pending = 0;
    let confirmed = 0;
    let rejected = 0;

    data.forEach((row) => {
      if (row.status === 'pending') pending++;
      else if (row.status === 'confirmed') confirmed++;
      else if (row.status === 'rejected') rejected++;
    });

    return {
      pending,
      confirmed,
      rejected,
      total: data.length,
    };
  } catch {
    return { pending: 0, confirmed: 0, rejected: 0, total: 0 };
  }
}
