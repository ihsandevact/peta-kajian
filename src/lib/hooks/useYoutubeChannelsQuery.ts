'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import type { YoutubeChannel } from '@/lib/services/youtubeTracker';

export function useYoutubeChannelsQuery() {
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const query = useQuery<YoutubeChannel[]>({
    queryKey: ['youtube_channels'],
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 1000 * 30, // 30 detik stale time
    refetchInterval: 1000 * 60, // Auto-poll setiap 60 detik agar siaran live terdeteksi secara otomatis
    queryFn: async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Koneksi internet terputus');
      }

      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Koneksi timeout: Server tidak merespons dalam 6 detik.'));
        }, 6000);
      });

      const supabase = createClient();
      const queryPromise = supabase
        .from('youtube_channels')
        .select('*')
        .eq('is_active', true)
        .order('is_currently_live', { ascending: false })
        .order('channel_name', { ascending: true });

      const { data, error } = (await Promise.race([queryPromise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
      })) as any;

      if (error) {
        throw error;
      }

      return (data || []) as YoutubeChannel[];
    },
  });

  const manualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [query]);

  return {
    channels: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching || isManualRefreshing,
    refetch: manualRefresh,
  };
}
