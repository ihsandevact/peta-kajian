'use server';

import { createClient } from '@/utils/supabase/server';
import { sendWebPushNotification } from '@/lib/services/webPush';

export interface SaveSubscriptionParams {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

/**
 * Menyimpan atau memperbarui data langganan push notification browser ke Supabase
 */
export async function savePushSubscriptionAction(params: SaveSubscriptionParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await (supabase.from('push_subscriptions') as any).upsert(
      {
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        user_agent: params.userAgent || null,
        user_id: user?.id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('Error saving push subscription:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Exception in savePushSubscriptionAction:', err);
    return { success: false, error: err.message || 'Gagal menyimpan langganan notifikasi.' };
  }
}

/**
 * Menghapus langganan notifikasi ketika pengguna menonaktifkan pengingat
 */
export async function removePushSubscriptionAction(endpoint: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Mengirim notifikasi tes langsung ke endpoint pengguna yang sedang aktif
 */
export async function sendTestNotificationAction(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  try {
    await sendWebPushNotification(subscription, {
      title: '🔔 Pengingat Peta Kajian Aktif',
      body: 'Alhamdulillah! Notifikasi pengingat kajian Anda telah aktif. Anda akan menerima notifikasi 2 jam sebelum kajian dimulai.',
      url: '/',
    });
    return { success: true };
  } catch (err: any) {
    console.error('Test notification error:', err);
    return { success: false, error: err.message || 'Gagal mengirim notifikasi tes.' };
  }
}
