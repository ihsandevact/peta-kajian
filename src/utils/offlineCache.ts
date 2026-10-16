'use client';

import { useState, useEffect } from 'react';
import type { StudySession } from '@/lib/services/kajian';

const CACHED_SESSIONS_STORAGE_KEY = 'peta_kajian_offline_sessions';
const FEED_SNAPSHOT_STORAGE_KEY = 'peta_kajian_last_feed_snapshot';
const OFFLINE_CACHE_EVENT = 'peta-kajian-offline-cache-updated';

/**
 * Menyimpan data lengkap satu sesi kajian ke penyimpanan offline lokal (localStorage)
 * sehingga tetap bisa dibaca saat berada di basement masjid atau area tanpa sinyal seluler.
 */
export function cacheSessionFull(session: StudySession): void {
  if (typeof window === 'undefined' || !session || !session.id) return;

  try {
    const raw = localStorage.getItem(CACHED_SESSIONS_STORAGE_KEY);
    const store: Record<string, StudySession> = raw ? JSON.parse(raw) : {};
    store[session.id] = session;
    localStorage.setItem(CACHED_SESSIONS_STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(OFFLINE_CACHE_EVENT, { detail: store }));
  } catch (e) {
    console.warn('Gagal menyimpan sesi ke offline cache:', e);
  }
}

/**
 * Menghapus data sesi dari offline cache
 */
export function removeCachedSession(sessionId: string): void {
  if (typeof window === 'undefined' || !sessionId) return;

  try {
    const raw = localStorage.getItem(CACHED_SESSIONS_STORAGE_KEY);
    if (!raw) return;
    const store: Record<string, StudySession> = JSON.parse(raw);
    if (store[sessionId]) {
      delete store[sessionId];
      localStorage.setItem(CACHED_SESSIONS_STORAGE_KEY, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent(OFFLINE_CACHE_EVENT, { detail: store }));
    }
  } catch (e) {
    console.warn('Gagal menghapus sesi dari offline cache:', e);
  }
}

/**
 * Mengambil seluruh daftar sesi kajian yang tersimpan di offline cache
 */
export function getCachedOfflineSessions(): StudySession[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(CACHED_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const store: Record<string, StudySession> = JSON.parse(raw);
    return Object.values(store);
  } catch (e) {
    console.warn('Gagal membaca sesi offline:', e);
    return [];
  }
}

/**
 * Menyimpan snapshot ~30 sesi kajian aktif terakhir saat online
 */
export function cacheFeedSnapshot(sessions: StudySession[]): void {
  if (typeof window === 'undefined' || !Array.isArray(sessions) || sessions.length === 0) return;

  try {
    // Simpan maksimal 40 sesi teratas untuk menghemat memori localStorage
    const snapshot = sessions.slice(0, 40);
    localStorage.setItem(FEED_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('Gagal menyimpan feed snapshot:', e);
  }
}

/**
 * Mengambil snapshot sesi kajian terakhir jika aplikasi dibuka saat offline
 */
export function getFeedSnapshot(): StudySession[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(FEED_SNAPSHOT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Custom React Hook untuk mendeteksi status koneksi internet browser secara real-time
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
