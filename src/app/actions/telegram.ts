'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { checkIsAdmin } from '@/lib/services/admin';
import { cleanTelegramUsername } from '@/lib/services/telegram';

function cleanNullableString(val?: string | null): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  if (!trimmed || trimmed === '$undefined' || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
    return null;
  }
  return trimmed;
}

/**
 * Kontributor/User: Mengusulkan Channel Telegram baru untuk dipantau
 */
export async function proposeTelegramChannel(payload: {
  channelUsername: string;
  channelTitle: string;
  city?: string;
  description?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Anda harus login terlebih dahulu untuk mengusulkan channel.' };
  }

  const username = cleanTelegramUsername(payload.channelUsername);
  if (!username) {
    return { success: false, error: 'Username atau link channel Telegram tidak valid.' };
  }

  const title = payload.channelTitle ? payload.channelTitle.trim() : '';
  if (!title) {
    return { success: false, error: 'Nama channel atau komunitas wajib diisi.' };
  }

  try {
    // 1. Cek apakah username sudah pernah didaftarkan
    const { data: existing, error: checkError } = await supabase
      .from('telegram_channels')
      .select('id, channel_username, status')
      .eq('channel_username', username)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'approved') {
        return { success: false, error: `Channel @${username} sudah terdaftar dan aktif dalam database.` };
      }
      if (existing.status === 'pending') {
        return { success: false, error: `Channel @${username} sudah diusulkan sebelumnya dan sedang menunggu peninjauan admin.` };
      }
    }

    const city = cleanNullableString(payload.city);
    const desc = cleanNullableString(payload.description);
    const submitterName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Relawan';

    const { error: insertError } = await supabase
      .from('telegram_channels')
      .insert({
        channel_username: username,
        channel_title: title,
        city: city,
        description: desc,
        status: 'pending',
        is_active: true,
        submitted_by: user.id,
        submitted_by_name: submitterName,
      });

    if (insertError) {
      console.error('Insert telegram channel proposal error:', insertError);
      return { success: false, error: insertError.message || 'Gagal mengirim usulan channel.' };
    }

    revalidatePath('/admin/telegram');
    revalidatePath('/kontributor/profile');
    return { success: true, message: `Usulan channel @${username} berhasil dikirim dan menunggu verifikasi admin.` };
  } catch (err: any) {
    console.error('Exception proposing telegram channel:', err);
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Admin: Menyetujui usulan channel Telegram
 */
export async function approveTelegramChannel(channelId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = await checkIsAdmin(user);
  if (!isAdmin || !user) {
    return { success: false, error: 'Akses ditolak: Hanya admin yang dapat menyetujui channel.' };
  }

  try {
    const { error } = await supabase
      .from('telegram_channels')
      .update({
        status: 'approved',
        is_active: true,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', channelId);

    if (error) {
      console.error('Approve telegram channel error:', error);
      return { success: false, error: error.message || 'Gagal menyetujui channel.' };
    }

    revalidatePath('/admin/telegram');
    revalidatePath('/kontributor/profile');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Admin: Menolak usulan channel Telegram
 */
export async function rejectTelegramChannel(channelId: string, reason?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = await checkIsAdmin(user);
  if (!isAdmin || !user) {
    return { success: false, error: 'Akses ditolak: Hanya admin yang dapat menolak channel.' };
  }

  try {
    const { error } = await supabase
      .from('telegram_channels')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: cleanNullableString(reason),
      })
      .eq('id', channelId);

    if (error) {
      console.error('Reject telegram channel error:', error);
      return { success: false, error: error.message || 'Gagal menolak channel.' };
    }

    revalidatePath('/admin/telegram');
    revalidatePath('/kontributor/profile');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Admin: Mengubah status aktif/non-aktif channel (toggle scraping)
 */
export async function toggleTelegramChannelStatus(channelId: string, isActive: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = await checkIsAdmin(user);
  if (!isAdmin || !user) {
    return { success: false, error: 'Akses ditolak: Hanya admin yang dapat mengubah status aktif.' };
  }

  try {
    const { error } = await supabase
      .from('telegram_channels')
      .update({ is_active: isActive })
      .eq('id', channelId);

    if (error) {
      console.error('Toggle telegram channel active error:', error);
      return { success: false, error: error.message || 'Gagal memperbarui status channel.' };
    }

    revalidatePath('/admin/telegram');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Admin: Menambahkan Channel Resmi langsung (tanpa proses approval)
 */
export async function adminCreateTelegramChannel(payload: {
  channelUsername: string;
  channelTitle: string;
  city?: string;
  description?: string;
  isActive?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = await checkIsAdmin(user);
  if (!isAdmin || !user) {
    return { success: false, error: 'Akses ditolak: Hanya admin yang dapat menambahkan channel langsung.' };
  }

  const username = cleanTelegramUsername(payload.channelUsername);
  if (!username) {
    return { success: false, error: 'Username atau link channel Telegram tidak valid.' };
  }

  const title = payload.channelTitle ? payload.channelTitle.trim() : '';
  if (!title) {
    return { success: false, error: 'Nama channel atau komunitas wajib diisi.' };
  }

  try {
    const city = cleanNullableString(payload.city);
    const desc = cleanNullableString(payload.description);

    const { error } = await supabase
      .from('telegram_channels')
      .upsert(
        {
          channel_username: username,
          channel_title: title,
          city: city,
          description: desc,
          status: 'approved',
          is_active: payload.isActive ?? true,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: 'channel_username' }
      );

    if (error) {
      console.error('Admin create telegram channel error:', error);
      return { success: false, error: error.message || 'Gagal menyimpan channel.' };
    }

    revalidatePath('/admin/telegram');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Admin: Menghapus channel Telegram
 */
export async function deleteTelegramChannel(channelId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = await checkIsAdmin(user);
  if (!isAdmin || !user) {
    return { success: false, error: 'Akses ditolak: Hanya admin yang dapat menghapus channel.' };
  }

  try {
    const { error } = await supabase
      .from('telegram_channels')
      .delete()
      .eq('id', channelId);

    if (error) {
      console.error('Delete telegram channel error:', error);
      return { success: false, error: error.message || 'Gagal menghapus channel.' };
    }

    revalidatePath('/admin/telegram');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}
