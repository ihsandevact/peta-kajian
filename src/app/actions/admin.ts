'use server';

import { createClient } from '@/utils/supabase/server';
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

