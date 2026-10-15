'use client';

const DEVICE_ID_KEY = 'peta_kajian_device_id';

/**
 * Mendapatkan atau menghasilkan Device ID acak yang tersimpan di localStorage.
 * Digunakan untuk identifikasi unik jamaah anonim (tanpa login) agar kehadiran (RSVP)
 * tidak terhitung ganda di database.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      // Gunakan crypto.randomUUID jika tersedia, atau fallback timestamp + random
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        deviceId = crypto.randomUUID();
      } else {
        deviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      }
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return 'dev_fallback_' + Math.random().toString(36).substring(2, 9);
  }
}
