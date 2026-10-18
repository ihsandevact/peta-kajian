'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchActiveSessions, type StudySession } from '@/lib/services/kajian';
import { getFeedSnapshot, cacheFeedSnapshot, getCachedOfflineSessions } from '@/utils/offlineCache';

interface UseActiveSessionsOptions {
  currentUserRole?: 'admin' | 'kontributor' | 'user' | null;
  isOffline?: boolean;
}

export function useActiveSessionsQuery({ currentUserRole, isOffline }: UseActiveSessionsOptions = {}) {
  const isAdmin = currentUserRole === 'admin';
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const query = useQuery<StudySession[]>({
    queryKey: ['activeSessions', { isAdmin }],
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 1000 * 30, // Throttle 30 detik agar tidak spam request bila berpindah tab cepat
    queryFn: async () => {
      // 1. Jika perangkat terdeteksi offline, segera gunakan cache lokal
      const isDeviceOffline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
      if (isDeviceOffline) {
        const cached = getFeedSnapshot();
        const offlineBookmarked = getCachedOfflineSessions();
        const map = new Map<string, StudySession>();
        [...cached, ...offlineBookmarked].forEach((s) => map.set(s.id, s));
        return Array.from(map.values());
      }

      // 2. Timeout race 6 detik agar tidak hanging jika jaringan lambat
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Koneksi timeout: Server tidak merespons dalam 6 detik.'));
        }, 6000);
      });

      try {
        const data = await Promise.race([
          fetchActiveSessions({ requireLocation: true, includeTestSessions: isAdmin }),
          timeoutPromise,
        ]).finally(() => clearTimeout(timeoutId));

        if (data && data.length > 0) {
          cacheFeedSnapshot(data);
          return data;
        }

        // Fallback jika respons kosong dari server
        const cached = getFeedSnapshot();
        const offlineBookmarked = getCachedOfflineSessions();
        const map = new Map<string, StudySession>();
        [...cached, ...offlineBookmarked].forEach((s) => map.set(s.id, s));
        return Array.from(map.values());
      } catch (err) {
        console.warn('Gagal memuat kajian terbaru, menggunakan data cache lokal:', err);
        const cached = getFeedSnapshot();
        const offlineBookmarked = getCachedOfflineSessions();
        const map = new Map<string, StudySession>();
        [...cached, ...offlineBookmarked].forEach((s) => map.set(s.id, s));
        const merged = Array.from(map.values());
        if (merged.length > 0) return merged;
        throw err;
      }
    },
  });

  // Wrapper fungsi refetch manual dengan animasi feedback minimal 400ms
  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    const startTime = Date.now();
    try {
      await query.refetch();
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 400) {
        await new Promise((res) => setTimeout(res, 400 - elapsed));
      }
      setIsManualRefreshing(false);
    }
  };

  const sessions = query.data || [];

  return {
    sessions,
    isLoading: query.isPending && sessions.length === 0,
    isRefreshing: isManualRefreshing,
    isBackgroundFetching: query.isFetching,
    hasConnectionError: query.isError,
    refetch: handleManualRefresh,
  };
}
