import webpush from 'web-push';
import { VAPID_PUBLIC_KEY } from '@/utils/pushConstants';
export { VAPID_PUBLIC_KEY };

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'jtM2po9L0Fp6KGCnT6as-8tBU0GXxx3Qv3WlGXOsgTk';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:dev.ihsan.act@gmail.com';

// Inisialisasi VAPID configuration
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn('VAPID setup warning:', e);
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  data?: any;
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Mengirim pesan push notification terenkripsi ke browser jemaah
 */
export async function sendWebPushNotification(
  subscription: PushSubscriptionData,
  payload: PushNotificationPayload
) {
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const notificationString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    icon: payload.icon || '/android-chrome-192x192.png',
    badge: payload.badge || '/favicon-32x32.png',
    data: payload.data || {},
  });

  return webpush.sendNotification(pushSubscription, notificationString);
}
