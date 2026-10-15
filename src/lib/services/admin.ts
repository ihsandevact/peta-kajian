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

export type AppUserRole = 'admin' | 'kontributor' | 'user';
export type ContributorRequestStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface UserRoleInfo {
  role: AppUserRole;
  isTrusted: boolean;
  requestStatus: ContributorRequestStatus;
  communityName?: string | null;
  whatsappNumber?: string | null;
  requestNote?: string | null;
  requestedAt?: string | null;
}

/**
 * Mendapatkan role dan status kepercayaan (isTrusted) user
 */
export async function getUserRoleAndStatus(user: { id: string; email?: string } | string): Promise<UserRoleInfo> {
  const userId = typeof user === 'string' ? user : user.id;
  const userEmail = typeof user === 'string' ? undefined : user.email;
  const isAdminByEmail = userEmail ? ADMIN_EMAILS.includes(userEmail.toLowerCase().trim()) : false;

  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role, is_trusted, request_status, community_name, whatsapp_number, request_note, requested_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      return {
        role: isAdminByEmail ? 'admin' : (data.role as AppUserRole) || 'user',
        isTrusted: isAdminByEmail ? true : !!data.is_trusted,
        requestStatus: (data.request_status as ContributorRequestStatus) || 'none',
        communityName: data.community_name || null,
        whatsappNumber: data.whatsapp_number || null,
        requestNote: data.request_note || null,
        requestedAt: data.requested_at || null,
      };
    }
  } catch {
    // Fallback jika belum termigrasi
  }

  return {
    role: isAdminByEmail ? 'admin' : 'user',
    isTrusted: isAdminByEmail,
    requestStatus: 'none',
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
  totalAttendees: number;
}> {
  try {
    const { data } = await supabase
      .from('study_sessions')
      .select('status, attendees_count');

    if (!data) {
      return { pending: 0, confirmed: 0, rejected: 0, total: 0, totalAttendees: 0 };
    }

    let pending = 0;
    let confirmed = 0;
    let rejected = 0;
    let totalAttendees = 0;

    data.forEach((row) => {
      if (row.status === 'pending') pending++;
      else if (row.status === 'confirmed') confirmed++;
      else if (row.status === 'rejected') rejected++;
      totalAttendees += (row.attendees_count || 0);
    });

    return {
      pending,
      confirmed,
      rejected,
      total: data.length,
      totalAttendees,
    };
  } catch {
    return { pending: 0, confirmed: 0, rejected: 0, total: 0, totalAttendees: 0 };
  }
}
