'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { ADMIN_EMAILS } from '@/lib/services/admin';

function cleanNullableString(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed.toLowerCase() === '$undefined'
  ) {
    return null;
  }
  return trimmed;
}

async function verifyAdminAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Anda harus login terlebih dahulu.');
  }

  const isAdminByEmail = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
  if (isAdminByEmail) return { supabase, user };

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleData?.role !== 'admin') {
    throw new Error('Akses ditolak. Tindakan ini hanya boleh dilakukan oleh Administrator.');
  }

  return { supabase, user };
}

/**
 * Menyetujui kajian (Status -> confirmed) agar langsung tampil di peta publik
 */
export async function approveSession(sessionId: string) {
  return togglePublishSession(sessionId, true);
}

/**
 * Toggle publikasi kajian:
 * - publish: true  -> status 'confirmed' (tampil di peta publik)
 * - publish: false -> status 'pending' (ditarik / unpublish dari peta publik)
 */
export async function togglePublishSession(sessionId: string, publish: boolean) {
  try {
    const { supabase, user } = await verifyAdminAuth();
    const newStatus = publish ? 'confirmed' : 'pending';

    let { error } = await supabase
      .from('study_sessions')
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        ...(publish ? { rejection_reason: null } : {}),
      })
      .eq('id', sessionId);

    // Fallback jika kolom reviewed_by/reviewed_at/rejection_reason belum ada di tabel DB
    if (error) {
      console.warn('Update with review metadata failed, trying status-only fallback:', error.message);
      const fallback = await supabase
        .from('study_sessions')
        .update({
          status: newStatus,
        })
        .eq('id', sessionId);

      if (fallback.error) {
        console.error('Fallback toggle publish failed:', fallback.error);
        return { success: false, error: `Gagal mengubah status publikasi: ${fallback.error.message || error.message}` };
      }
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/kontributor/profile');
    return { success: true, status: newStatus };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Toggle status testing kajian:
 * - isTest: true  -> data pengujian khusus admin (tidak tampil di publik)
 * - isTest: false -> data publik normal
 */
export async function toggleTestSession(sessionId: string, isTest: boolean) {
  try {
    const { supabase } = await verifyAdminAuth();

    const { error } = await supabase
      .from('study_sessions')
      .update({
        is_test: isTest,
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Toggle test session failed:', error);
      return { success: false, error: `Gagal mengubah status testing: ${error.message}` };
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/kontributor/profile');
    return { success: true, isTest };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Menolak kajian (Status -> rejected) dengan alasan yang jelas
 */
export async function rejectSession(sessionId: string, reason: string) {
  try {
    const { supabase, user } = await verifyAdminAuth();

    if (!reason || !reason.trim()) {
      return { success: false, error: 'Alasan penolakan wajib diisi untuk mengedukasi relawan.' };
    }

    let { error } = await supabase
      .from('study_sessions')
      .update({
        status: 'rejected',
        rejection_reason: reason.trim(),
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // Fallback jika kolom rejection_reason/reviewed_by belum ada di tabel DB
    if (error) {
      console.warn('Reject with review metadata failed, trying status-only fallback:', error.message);
      const fallback = await supabase
        .from('study_sessions')
        .update({
          status: 'rejected',
        })
        .eq('id', sessionId);

      if (fallback.error) {
        console.error('Fallback reject failed:', fallback.error);
        return { success: false, error: `Gagal menolak kajian: ${fallback.error.message || error.message}` };
      }
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/kontributor/profile');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Quick Edit & Approve oleh Admin: Mengedit data sekaligus menyetujui langsung
 */
export async function quickEditAndApproveSession(formData: FormData) {
  try {
    const { supabase, user } = await verifyAdminAuth();
    const sessionId = formData.get('session_id') as string;

    if (!sessionId) {
      return { success: false, error: 'ID kajian tidak valid.' };
    }

    const title = (formData.get('title') as string || '').trim();
    const speaker_name = (formData.get('speaker_name') as string || '').trim();
    const book_title = cleanNullableString(formData.get('book_title'));
    const start_datetime_raw = formData.get('start_datetime') as string;
    const start_datetime = start_datetime_raw ? start_datetime_raw : null;
    const venue_name = (formData.get('venue_name') as string || '').trim();
    const poster_url = cleanNullableString(formData.get('poster_url'));
    const audience_type = formData.get('audience') as string;
    const is_recurring = formData.get('is_recurring') === 'on' || formData.get('is_recurring') === 'true';
    const recurring_pattern = is_recurring ? (formData.get('recurring_pattern') as string || null) : null;

    let recurring_rule: any = null;
    const recurring_rule_raw = formData.get('recurring_rule') as string;
    if (is_recurring && recurring_rule_raw) {
      try {
        recurring_rule = JSON.parse(recurring_rule_raw);
      } catch {
        recurring_rule = null;
      }
    }

    const modeRaw = formData.get('mode') as string;
    const mode = modeRaw === 'online' || modeRaw === 'hybrid' ? modeRaw : 'offline';
    const is_online = mode !== 'offline';
    const stream_url = is_online ? cleanNullableString(formData.get('stream_url')) : null;

    // Update study session & set confirmed
    let { error: updateError } = await supabase
      .from('study_sessions')
      .update({
        title,
        speaker_name,
        book_title,
        audience_type,
        start_datetime,
        is_recurring,
        recurring_pattern,
        recurring_rule,
        poster_url,
        is_online,
        stream_url,
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.warn('Quick edit with review metadata failed, trying status-only fallback:', updateError.message);
      const fallback = await supabase
        .from('study_sessions')
        .update({
          title,
          speaker_name,
          book_title,
          audience_type,
          start_datetime,
          is_recurring,
          recurring_pattern,
          recurring_rule,
          poster_url,
          is_online,
          stream_url,
          status: 'confirmed',
        })
        .eq('id', sessionId);

      if (fallback.error) {
        console.error('Fallback quick edit error:', fallback.error);
        return { success: false, error: `Gagal memperbarui kajian: ${fallback.error.message || updateError.message}` };
      }
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/kontributor/profile');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Toggle Status Kepercayaan Pengguna (Trusted / Auto-Publish)
 */
export async function toggleUserTrusted(targetUserId: string, isTrusted: boolean) {
  try {
    const { supabase } = await verifyAdminAuth();

    const { error } = await supabase
      .from('user_roles')
      .upsert({
        user_id: targetUserId,
        is_trusted: isTrusted,
      });

    if (error) {
      console.error('Toggle trusted error:', error);
      return { success: false, error: 'Gagal mengubah status kepercayaan pengguna.' };
    }

    revalidatePath('/admin');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Toggle Role Pengguna ('admin' | 'kontributor' | 'user')
 */
export async function toggleUserRole(targetUserId: string, newRole: 'admin' | 'kontributor' | 'user') {
  try {
    const { supabase, user } = await verifyAdminAuth();

    const updatePayload: Record<string, any> = {
      user_id: targetUserId,
      role: newRole,
    };

    if (newRole === 'kontributor') {
      updatePayload.request_status = 'approved';
      updatePayload.reviewed_at = new Date().toISOString();
      updatePayload.reviewed_by = user.id;
    }

    const { error } = await supabase
      .from('user_roles')
      .upsert(updatePayload);

    if (error) {
      console.error('Toggle role error:', error);
      return { success: false, error: 'Gagal mengubah role pengguna.' };
    }

    revalidatePath('/admin');
    revalidatePath('/admin/users');
    revalidatePath('/kontributor/profile');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Menyetujui permohonan pengguna menjadi Kontributor Dakwah
 */
export async function approveContributorRequest(targetUserId: string) {
  return toggleUserRole(targetUserId, 'kontributor');
}

/**
 * Menolak permohonan kontributor dakwah
 */
export async function rejectContributorRequest(targetUserId: string, reason?: string) {
  try {
    const { supabase, user } = await verifyAdminAuth();

    const { error } = await supabase
      .from('user_roles')
      .update({
        request_status: 'rejected',
        request_note: reason || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Reject contributor error:', error);
      return { success: false, error: 'Gagal menolak permohonan kontributor.' };
    }

    revalidatePath('/admin');
    revalidatePath('/admin/users');
    revalidatePath('/kontributor/profile');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}



/**
 * Menyinkronkan seluruh akun auth.users ke user_roles dan mengambil daftar pengguna lengkap untuk admin
 */

/**
 * Menyinkronkan seluruh akun auth.users ke user_roles dan mengambil daftar pengguna lengkap untuk admin
 */
export async function syncAndFetchAdminUsers() {
  try {
    const { supabase } = await verifyAdminAuth();
    const adminClient = createAdminClient();

    // 1. Jika service role key tersedia, sinkronkan pengguna auth.users ke user_roles
    try {
      const { data: authUsersData, error: authUsersError } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (!authUsersError && authUsersData?.users) {
        // Ambil user_roles yang sudah ada
        const { data: existingRoles } = await adminClient
          .from('user_roles')
          .select('user_id, email, role');

        const existingMap = new Map((existingRoles || []).map((r: any) => [r.user_id, r]));

        const missingUsers = authUsersData.users.filter((u: any) => !existingMap.has(u.id));

        if (missingUsers.length > 0) {
          const rowsToInsert = missingUsers.map((u: any) => ({
            user_id: u.id,
            email: u.email || null,
            role: 'user',
            is_trusted: false,
            request_status: 'none',
          }));

          // Insert batch baris baru
          await adminClient.from('user_roles').insert(rowsToInsert);
        }

        // Perbarui email yang null di user_roles jika di auth.users tersedia
        for (const u of authUsersData.users) {
          const roleRecord: any = existingMap.get(u.id);
          if (roleRecord && !roleRecord.email && u.email) {
            await adminClient
              .from('user_roles')
              .update({ email: u.email })
              .eq('user_id', u.id);
          }
        }
      }
    } catch (authSyncErr) {
      console.warn('Sync auth users to user_roles warning (service role might not be set):', authSyncErr);
    }

    // 2. Ambil data sesi kajian (untuk menghitung kontribusi)
    const { data: sessionRows } = await supabase
      .from('study_sessions')
      .select('created_by, contributor_name');

    // 3. Ambil data role lengkap
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('*');

    // 4. Ambil data RSVP kehadiran per user_id dari session_attendees
    const rsvpCountByUserId: Record<string, number> = {};
    try {
      const { data: attendeeRows } = await supabase
        .from('session_attendees')
        .select('user_id')
        .not('user_id', 'is', null);

      (attendeeRows || []).forEach((a: any) => {
        if (a.user_id) {
          rsvpCountByUserId[a.user_id] = (rsvpCountByUserId[a.user_id] || 0) + 1;
        }
      });
    } catch {}

    // Hitung sesi per user_id & nama
    const sessionCountByUserId: Record<string, number> = {};
    const sessionNameByUserId: Record<string, string> = {};

    (sessionRows || []).forEach((s: any) => {
      if (s.created_by) {
        sessionCountByUserId[s.created_by] = (sessionCountByUserId[s.created_by] || 0) + 1;
        if (s.contributor_name && !sessionNameByUserId[s.created_by]) {
          sessionNameByUserId[s.created_by] = s.contributor_name;
        }
      }
    });

    const userMap: Record<string, any> = {};

    // Masukkan semua user dari user_roles
    (roleRows || []).forEach((r: any) => {
      const uid = r.user_id;
      const count = sessionCountByUserId[uid] || 0;
      const rsvpCount = rsvpCountByUserId[uid] || 0;
      const fallbackName =
        r.community_name ||
        sessionNameByUserId[uid] ||
        (r.email ? r.email.split('@')[0] : 'Pengguna ' + uid.slice(0, 6));

      userMap[uid] = {
        userId: uid,
        name: fallbackName,
        count,
        rsvpCount,
        role: r.role || 'user',
        isTrusted: r.is_trusted || false,
        email: r.email || null,
        requestStatus: r.request_status || 'none',
        communityName: r.community_name || null,
        whatsappNumber: r.whatsapp_number || null,
        requestNote: r.request_note || null,
        requestedAt: r.requested_at || null,
        reviewedAt: r.reviewed_at || null,
      };
    });

    // Tambahkan kontributor sesi lama yang belum ada di user_roles
    const legacyMap: Record<string, number> = {};
    (sessionRows || []).forEach((s: any) => {
      if (s.created_by && !userMap[s.created_by]) {
        const uid = s.created_by;
        userMap[uid] = {
          userId: uid,
          name: s.contributor_name || 'Relawan Dakwah',
          count: 1,
          rsvpCount: rsvpCountByUserId[uid] || 0,
          role: 'kontributor',
          isTrusted: false,
          requestStatus: 'none',
        };
      } else if (!s.created_by && s.contributor_name) {
        legacyMap[s.contributor_name] = (legacyMap[s.contributor_name] || 0) + 1;
      }
    });

    Object.entries(legacyMap).forEach(([name, count]) => {
      userMap[`legacy_${name}`] = {
        name,
        count,
        rsvpCount: 0,
        role: 'kontributor',
        isTrusted: false,
        requestStatus: 'none',
      };
    });

    const userList = Object.values(userMap);
    return { success: true, users: userList };
  } catch (err: any) {
    console.error('syncAndFetchAdminUsers error:', err);
    return { success: false, error: err.message || 'Gagal menyinkronkan data pengguna.' };
  }
}
