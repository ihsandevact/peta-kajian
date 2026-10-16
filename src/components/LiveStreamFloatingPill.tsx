'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface LiveStreamFloatingPillProps {
  hasSelectedSession?: boolean;
}

export default function LiveStreamFloatingPill({
  hasSelectedSession = false,
}: LiveStreamFloatingPillProps) {
  const [liveCount, setLiveCount] = useState<number>(0);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    async function checkLiveCount() {
      try {
        const supabase = createClient();
        const { count, error } = await supabase
          .from('youtube_channels')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('is_currently_live', true);

        if (!error && typeof count === 'number') {
          setLiveCount(count);
        }
      } catch (err) {
        // Silent fail
      }
    }

    checkLiveCount();
    // Poll every 2 minutes
    const interval = setInterval(checkLiveCount, 120000);
    return () => clearInterval(interval);
  }, []);

  if (liveCount <= 0 || dismissed) {
    return null;
  }

  return (
    <div
      className={`absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 w-max max-w-[calc(100vw-24px)] ${
        hasSelectedSession ? 'hidden md:block' : 'block'
      }`}
    >
      <div className="flex items-center flex-nowrap whitespace-nowrap gap-2 pl-3 sm:pl-3.5 pr-1.5 py-1 sm:py-1.5 rounded-full bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md border border-red-500/30 dark:border-red-500/40 shadow-lg text-xs font-semibold text-on-surface">
        {/* Pulsing Red Dot */}
        <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-full w-full bg-red-600" />
        </span>

        {/* Text Status (Rapi, 1 Baris, Tidak Wrapping) */}
        <span className="text-[11px] sm:text-xs text-on-surface whitespace-nowrap shrink-0">
          <span className="sm:hidden">
            <strong>{liveCount} Channel</strong> Live
          </span>
          <span className="hidden sm:inline">
            <strong>{liveCount} Channel</strong> Sedang Live Kajian
          </span>
        </span>

        {/* Action Button Tonton */}
        <Link
          href="/live"
          className="ml-0.5 px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all shadow-xs shrink-0 whitespace-nowrap"
        >
          <span>Tonton</span>
          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
        </Link>

        {/* Dismiss Button */}
        <button
          onClick={() => setDismissed(true)}
          className="w-5 h-5 rounded-full text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors shrink-0 ml-0.5 cursor-pointer"
          title="Tutup pemberitahuan"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>
    </div>
  );
}
