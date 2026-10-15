'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getOrCreateDeviceId } from '@/utils/device';

const ATTENDANCE_STORAGE_KEY = 'peta_kajian_attendance';
const ATTENDANCE_COUNTS_KEY = 'peta_kajian_attendance_counts';
const ATTENDANCE_EVENT = 'peta-kajian-attendance-updated';

/**
 * Mengambil daftar ID kajian yang ditandai "Saya Hadir" dari localStorage
 */
export function getStoredAttendance(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading attendance from localStorage', e);
    return [];
  }
}

/**
 * Memeriksa apakah pengguna menandai hadir di kajian tertentu
 */
export function isSessionAttending(id: string): boolean {
  return getStoredAttendance().includes(id);
}

/**
 * Sinkronisasi data kehadiran dengan database Supabase:
 * - Menghubungkan ID user jika login atau deviceId jika anonim
 * - Mengunggah kehadiran lokal ke database jika belum tersimpan
 * - Menggabungkan riwayat kehadiran cloud ke browser
 */
export async function syncAttendanceWithDatabase(userId?: string): Promise<string[]> {
  if (typeof window === 'undefined') return getStoredAttendance();

  const supabase = createClient();
  const deviceId = getOrCreateDeviceId();

  try {
    let query = supabase.from('session_attendees').select('session_id');

    if (userId) {
      // Jika user login, ambil yang milik user_id atau device_id sebelumnya
      query = query.or(`user_id.eq.${userId},device_id.eq.${deviceId}`);
    } else {
      // Jika anonim, ambil yang sesuai device_id
      query = query.eq('device_id', deviceId);
    }

    const { data: remoteData, error } = await query;

    if (error) {
      console.warn('Sync attendance DB read error:', error.message);
      return getStoredAttendance();
    }

    const remoteIds = (remoteData || []).map((row) => row.session_id);
    const localIds = getStoredAttendance();

    // 1. Jika ada kehadiran lokal yang belum ada di remote, simpan ke database
    const missingInRemote = localIds.filter((id) => !remoteIds.includes(id));
    if (missingInRemote.length > 0) {
      const rowsToInsert = missingInRemote.map((sessionId) => ({
        session_id: sessionId,
        user_id: userId || null,
        device_id: userId ? null : deviceId,
      }));
      await (supabase.from('session_attendees') as any).insert(rowsToInsert);
    }

    // 2. Jika user login, migrasikan entri deviceId yang belum terhubung ke user_id
    if (userId && deviceId) {
      await (supabase
        .from('session_attendees') as any)
        .update({ user_id: userId })
        .eq('device_id', deviceId)
        .is('user_id', null);
    }

    // 3. Gabungkan riwayat
    const merged = Array.from(new Set([...localIds, ...remoteIds]));
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(
      new CustomEvent(ATTENDANCE_EVENT, {
        detail: { attending: merged },
      })
    );

    return merged;
  } catch (e) {
    console.error('Error syncing attendance with database:', e);
    return getStoredAttendance();
  }
}

/**
 * Melakukan toggle kehadiran (Insya Allah Hadir <-> Batal)
 * - Berjalan optimis di localStorage & state lokal seketika (zero latency)
 * - Mengirim mutasi ke Supabase: mencatat user_id (jika login) atau device_id (jika anonim)
 * - Database trigger trg_attendees_count otomatis meng-update kolom attendees_count di study_sessions
 */
export async function toggleSessionAttendance(id: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const current = getStoredAttendance();
    const exists = current.includes(id);
    const updated = exists ? current.filter((item) => item !== id) : [...current, id];
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(updated));

    // Dispatch event agar semua komponen reaktif seketika
    window.dispatchEvent(
      new CustomEvent(ATTENDANCE_EVENT, {
        detail: { attending: updated, sessionId: id, isAttending: !exists },
      })
    );

    // Kirim mutasi ke database Supabase
    const supabase = createClient();
    const deviceId = getOrCreateDeviceId();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (exists) {
      // Hapus kehadiran (Batal Hadir)
      let deleteQuery = supabase.from('session_attendees').delete().eq('session_id', id);

      if (user?.id) {
        deleteQuery = deleteQuery.eq('user_id', user.id);
      } else {
        deleteQuery = deleteQuery.eq('device_id', deviceId);
      }

      const { error } = await deleteQuery;
      if (error) console.warn('Gagal menghapus attendance di cloud:', error.message);
    } else {
      // Tambah kehadiran (Insya Allah Hadir)
      const newAttendeeRow: Record<string, any> = {
        session_id: id,
        user_id: user?.id || null,
        device_id: user?.id ? null : deviceId,
      };

      const { error } = await (supabase.from('session_attendees') as any).insert(newAttendeeRow);
      if (error) console.warn('Gagal menyimpan attendance di cloud:', error.message);
    }

    return !exists;
  } catch (e) {
    console.error('Error toggling attendance in localStorage', e);
    return false;
  }
}

/**
 * React Hook untuk menggunakan dan memantau status kehadiran pengguna
 */
export function useAttendance() {
  const [attending, setAttending] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const initialAttendingRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Bersihkan legacy delta storage jika ada
    try {
      localStorage.removeItem(ATTENDANCE_COUNTS_KEY);
    } catch {}

    const initial = getStoredAttendance();
    setAttending(initial);
    if (!initialAttendingRef.current) {
      initialAttendingRef.current = new Set(initial);
    }
    setIsLoaded(true);

    const handleUpdate = () => {
      setAttending(getStoredAttendance());
    };

    window.addEventListener(ATTENDANCE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // Cek auth pengguna untuk sinkronisasi cloud
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      syncAttendanceWithDatabase(data?.user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      syncAttendanceWithDatabase(session?.user?.id);
    });

    return () => {
      window.removeEventListener(ATTENDANCE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      subscription.unsubscribe();
    };
  }, []);

  const toggle = useCallback((id: string) => {
    return toggleSessionAttendance(id);
  }, []);

  const isAttending = useCallback(
    (id: string) => {
      return attending.includes(id);
    },
    [attending]
  );

  /**
   * Menghitung offset perubahan kehadiran pengguna pada sesi aktif.
   * - +1 jika pengguna baru saja menandai hadir sejak halaman dibuka
   * - -1 jika pengguna baru saja membatalkan kehadiran sejak halaman dibuka
   * - 0 jika status sama dengan saat halaman pertama kali memuat data database
   */
  const getExtraCount = useCallback(
    (id: string) => {
      if (!initialAttendingRef.current) return 0;
      const wasInitiallyAttending = initialAttendingRef.current.has(id);
      const isCurrentlyAttending = attending.includes(id);

      if (isCurrentlyAttending && !wasInitiallyAttending) return 1;
      if (!isCurrentlyAttending && wasInitiallyAttending) return -1;
      return 0;
    },
    [attending]
  );

  return {
    attending,
    isLoaded,
    toggle,
    isAttending,
    getExtraCount,
  };
}
