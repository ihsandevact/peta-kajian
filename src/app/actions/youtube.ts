'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { ADMIN_EMAILS } from '@/lib/services/admin';
import {
  syncAllYoutubeChannels,
  checkChannelLiveStatus,
  normalizeHandle,
  type ChannelSyncReport,
} from '@/lib/services/youtubeTracker';

/**
 * Verifikasi keamanan: Hanya Admin yang berhak mengelola channel YouTube
 */
async function verifyAdminCaller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Autentikasi diperlukan. Silakan login terlebih dahulu.');
  }

  const isAdminByEmail = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
  if (isAdminByEmail) return { supabase, user };

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleData?.role !== 'admin') {
    throw new Error('Akses ditolak: Hanya administrator yang dapat mengelola YouTube Tracker.');
  }

  return { supabase, user };
}

/**
 * Server Action: Sinkronkan seluruh channel YouTube secara manual
 */
export async function syncYoutubeLiveAction(): Promise<{
  success: boolean;
  totalChannels: number;
  liveCount: number;
  upcomingCount?: number;
  reports: ChannelSyncReport[];
  error?: string;
}> {
  try {
    await verifyAdminCaller();

    const result = await syncAllYoutubeChannels();

    revalidatePath('/admin/youtube');
    revalidatePath('/live');
    revalidatePath('/');

    return {
      success: true,
      totalChannels: result.totalChannels,
      liveCount: result.liveCount,
      upcomingCount: result.upcomingCount,
      reports: result.reports,
    };
  } catch (err: any) {
    console.error('Error in syncYoutubeLiveAction:', err);
    return {
      success: false,
      totalChannels: 0,
      liveCount: 0,
      reports: [],
      error: err.message || 'Gagal menyinkronkan channel YouTube.',
    };
  }
}

/**
 * Server Action: Tambah Channel YouTube baru
 */
export async function addYoutubeChannelAction(formData: {
  channel_name: string;
  channel_handle: string;
  default_speaker_name?: string;
  default_city?: string;
  is_active?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await verifyAdminCaller();

    const handle = normalizeHandle(formData.channel_handle);
    const channelName = formData.channel_name.trim();

    if (!channelName || !handle) {
      return { success: false, error: 'Nama Channel dan Handle (@handle) wajib diisi.' };
    }

    // Cek duplikasi channel secara case-insensitive
    const { data: existing } = await supabase
      .from('youtube_channels')
      .select('id, channel_name')
      .ilike('channel_handle', handle)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: `Channel dengan handle ${handle} sudah terdaftar (${existing.channel_name}).`,
      };
    }

    const { error } = await supabase.from('youtube_channels').insert({
      channel_name: channelName,
      channel_handle: handle,
      default_speaker_name: formData.default_speaker_name?.trim() || 'Asatidzah',
      default_city: formData.default_city?.trim() || 'Nasional',
      is_active: formData.is_active ?? true,
    });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: `Channel dengan handle ${handle} sudah terdaftar.` };
      }
      throw error;
    }

    revalidatePath('/admin/youtube');
    revalidatePath('/live');

    return { success: true };
  } catch (err: any) {
    console.error('Error in addYoutubeChannelAction:', err);
    return { success: false, error: err.message || 'Gagal menambahkan channel YouTube.' };
  }
}

/**
 * Server Action: Toggle Aktif / Nonaktif Channel YouTube
 */
export async function toggleYoutubeChannelAction(
  channelId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await verifyAdminCaller();

    const { error } = await supabase
      .from('youtube_channels')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', channelId);

    if (error) throw error;

    revalidatePath('/admin/youtube');
    revalidatePath('/live');

    return { success: true };
  } catch (err: any) {
    console.error('Error in toggleYoutubeChannelAction:', err);
    return { success: false, error: err.message || 'Gagal mengubah status channel.' };
  }
}

/**
 * Server Action: Hapus Channel YouTube
 */
export async function deleteYoutubeChannelAction(
  channelId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await verifyAdminCaller();

    const { error } = await supabase
      .from('youtube_channels')
      .delete()
      .eq('id', channelId);

    if (error) throw error;

    revalidatePath('/admin/youtube');
    revalidatePath('/live');

    return { success: true };
  } catch (err: any) {
    console.error('Error in deleteYoutubeChannelAction:', err);
    return { success: false, error: err.message || 'Gagal menghapus channel.' };
  }
}

/**
 * Server Action: Cek live status 1 channel secara instan
 */
export async function checkSingleChannelLiveAction(
  rawHandle: string,
  defaultSpeaker?: string
) {
  try {
    await verifyAdminCaller();
    const result = await checkChannelLiveStatus(rawHandle, defaultSpeaker);
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal memeriksa channel.' };
  }
}
