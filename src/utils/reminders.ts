'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { subscribeToPushNotifications } from '@/utils/webPushClient';

const REMINDERS_STORAGE_KEY = 'peta_kajian_reminders';
const REMINDERS_EVENT = 'peta-kajian-reminders-updated';

/**
 * Mengambil daftar session_id yang diaktifkan pengingatnya dari localStorage
 */
export function getStoredReminders(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Memeriksa apakah suatu session_id diaktifkan pengingatnya
 */
export function isSessionReminded(id: string): boolean {
  if (!id) return false;
  return getStoredReminders().includes(id);
}

/**
 * Melakukan toggle pengingat untuk suatu kajian spesifik (session_id).
 * Mengembalikan status baru (true jika aktif, false jika nonaktif).
 */
export async function toggleSessionReminder(sessionId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !sessionId) return false;

  try {
    const current = getStoredReminders();
    const exists = current.includes(sessionId);
    const updated = exists ? current.filter((item) => item !== sessionId) : [...current, sessionId];
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(updated));

    // Siarkan event agar seluruh komponen reaktif seketika
    window.dispatchEvent(
      new CustomEvent(REMINDERS_EVENT, {
        detail: { sessionId, isReminded: !exists, reminders: updated },
      })
    );

    // Jika mengaktifkan pengingat, pastikan push subscription browser aktif di background
    if (!exists) {
      subscribeToPushNotifications(false).catch(() => {});
    }

    // Sinkronisasi ke cloud (asinkron)
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data?.user;

      let endpoint: string | null = null;
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          endpoint = sub?.endpoint || null;
        } catch {}
      }

      if (exists) {
        // Hapus pengingat sesi dari cloud
        if (user?.id) {
          (supabase.from('session_reminders') as any)
            .delete()
            .match({ user_id: user.id, session_id: sessionId })
            .then(() => {});
        }
        if (endpoint) {
          (supabase.from('session_reminders') as any)
            .delete()
            .match({ endpoint, session_id: sessionId })
            .then(() => {});
        }
      } else {
        // Simpan pengingat sesi ke cloud
        (supabase.from('session_reminders') as any)
          .insert({
            session_id: sessionId,
            user_id: user?.id || null,
            endpoint: endpoint || null,
          })
          .then(() => {});
      }
    });

    return !exists;
  } catch (e) {
    console.error('Error toggling session reminder:', e);
    return false;
  }
}

/**
 * React Hook untuk memantau status pengingat sesi tertentu
 */
export function useSessionReminder(sessionId?: string) {
  const [reminders, setReminders] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setReminders(getStoredReminders());
    setIsLoaded(true);

    const handleUpdate = () => {
      setReminders(getStoredReminders());
    };

    window.addEventListener(REMINDERS_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(REMINDERS_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const isReminded = sessionId ? reminders.includes(sessionId) : false;

  const toggle = useCallback(
    async (targetId?: string) => {
      const idToToggle = targetId || sessionId;
      if (!idToToggle) return false;
      return toggleSessionReminder(idToToggle);
    },
    [sessionId]
  );

  return {
    isReminded,
    reminders,
    isLoaded,
    toggle,
  };
}
