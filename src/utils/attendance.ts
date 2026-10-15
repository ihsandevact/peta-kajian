'use client';

import { useState, useEffect, useCallback } from 'react';

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
 * Mengambil cache delta jumlah kehadiran per kajian dari localStorage
 */
export function getStoredAttendanceDeltas(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ATTENDANCE_COUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    return {};
  }
}

/**
 * Memeriksa apakah pengguna menandai hadir di kajian tertentu
 */
export function isSessionAttending(id: string): boolean {
  return getStoredAttendance().includes(id);
}

/**
 * Melakukan toggle kehadiran (Insya Allah Hadir <-> Batal)
 */
export function toggleSessionAttendance(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = getStoredAttendance();
    const exists = current.includes(id);
    const updated = exists ? current.filter((item) => item !== id) : [...current, id];
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(updated));

    // Update delta count di localStorage
    const deltas = getStoredAttendanceDeltas();
    deltas[id] = (deltas[id] || 0) + (exists ? -1 : 1);
    localStorage.setItem(ATTENDANCE_COUNTS_KEY, JSON.stringify(deltas));

    window.dispatchEvent(
      new CustomEvent(ATTENDANCE_EVENT, {
        detail: { attending: updated, sessionId: id, isAttending: !exists },
      })
    );
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
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setAttending(getStoredAttendance());
    setDeltas(getStoredAttendanceDeltas());
    setIsLoaded(true);

    const handleUpdate = () => {
      setAttending(getStoredAttendance());
      setDeltas(getStoredAttendanceDeltas());
    };

    window.addEventListener(ATTENDANCE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(ATTENDANCE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
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

  const getExtraCount = useCallback(
    (id: string) => {
      return deltas[id] || 0;
    },
    [deltas]
  );

  return {
    attending,
    isLoaded,
    toggle,
    isAttending,
    getExtraCount,
  };
}
