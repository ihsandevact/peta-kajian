'use client';

import { VAPID_PUBLIC_KEY } from '@/utils/pushConstants';
import {
  savePushSubscriptionAction,
  removePushSubscriptionAction,
  sendTestNotificationAction,
} from '@/app/actions/notifications';

export const PUSH_SUBSCRIPTION_EVENT = 'peta-kajian-push-updated';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Memeriksa apakah browser mendukung fitur Web Push Notifications
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Memeriksa status langganan push browser saat ini
 */
export async function getPushSubscriptionStatus(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch (e) {
    return false;
  }
}

/**
 * Mendaftarkan langganan push notification browser
 * @param sendTest jika true, mengirimkan notifikasi tes instan ke browser
 */
export async function subscribeToPushNotifications(sendTest = false): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Cek apakah sudah berlangganan
    const existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      window.dispatchEvent(new CustomEvent(PUSH_SUBSCRIPTION_EVENT, { detail: { isSubscribed: true } }));
      return true;
    }

    // Minta izin notifikasi
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as any,
    });

    const subJson = sub.toJSON();
    const p256dh = subJson.keys?.p256dh || '';
    const auth = subJson.keys?.auth || '';

    await savePushSubscriptionAction({
      endpoint: sub.endpoint,
      p256dh,
      auth,
      userAgent: navigator.userAgent,
    });

    window.dispatchEvent(new CustomEvent(PUSH_SUBSCRIPTION_EVENT, { detail: { isSubscribed: true } }));

    if (sendTest) {
      sendTestNotificationAction({
        endpoint: sub.endpoint,
        p256dh,
        auth,
      }).catch(() => {});
    }

    return true;
  } catch (err) {
    console.warn('Gagal subscribe push notification:', err);
    return false;
  }
}

/**
 * Membatalkan langganan push notification
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const currentSub = await reg.pushManager.getSubscription();
    if (currentSub) {
      await currentSub.unsubscribe();
      await removePushSubscriptionAction(currentSub.endpoint);
    }
    window.dispatchEvent(new CustomEvent(PUSH_SUBSCRIPTION_EVENT, { detail: { isSubscribed: false } }));
    return true;
  } catch (err) {
    console.warn('Gagal unsubscribe push notification:', err);
    return false;
  }
}
