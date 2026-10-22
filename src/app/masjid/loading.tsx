import React from 'react';
import MosqueCardSkeleton from '@/components/MosqueCardSkeleton';

export default function MosqueDirectoryLoading() {
  return (
    <div className="relative w-full h-[100dvh] flex flex-col bg-background text-on-surface overflow-hidden">
      <div className="flex-1 relative flex overflow-hidden">
        {/* SIDEBAR SKELETON */}
        <aside className="w-full sm:w-[420px] lg:w-[480px] xl:w-[510px] h-full flex flex-col bg-surface border-r border-outline-variant/40 shrink-0 z-30">
          {/* Header + Prayer Bar + Search + Quick Cities Skeleton */}
          <div className="p-3 sm:p-4 border-b border-outline-variant/40 space-y-3 bg-surface shrink-0">
            <div className="flex items-center justify-between gap-2 animate-pulse">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-surface-container-high" />
                <div className="w-7 h-7 rounded-lg bg-emerald-600/30" />
                <div className="h-5 w-32 rounded-md bg-surface-container-high" />
              </div>
              <div className="w-8 h-8 rounded-xl bg-surface-container-high" />
            </div>

            {/* Prayer Countdown Bar Skeleton */}
            <div className="h-8 rounded-xl bg-emerald-600/10 border border-emerald-600/20 animate-pulse" />

            {/* Search + Filter Button Skeleton */}
            <div className="flex items-center gap-2 animate-pulse">
              <div className="flex-1 h-9 sm:h-[38px] rounded-xl bg-surface-container-high" />
              <div className="w-24 h-9 sm:h-[38px] rounded-xl bg-surface-container-high shrink-0" />
            </div>

            {/* Quick Cities Pill Carousel Skeleton */}
            <div className="flex items-center gap-1.5 overflow-hidden animate-pulse">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-6 w-16 rounded-lg bg-surface-container-high shrink-0"
                />
              ))}
            </div>
          </div>

          {/* List Cards Skeleton */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
            <div className="flex items-center justify-between px-1 animate-pulse">
              <div className="h-4 w-40 rounded bg-surface-container-high" />
              <div className="h-5 w-24 rounded-full bg-surface-container-high" />
            </div>

            {Array.from({ length: 6 }).map((_, idx) => (
              <MosqueCardSkeleton key={idx} />
            ))}
          </div>
        </aside>

        {/* MAP AREA SKELETON */}
        <main className="hidden sm:flex flex-1 h-full relative items-center justify-center bg-surface-container-low">
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-surface/90 border border-outline-variant/60 shadow-md text-xs font-bold text-on-surface-variant">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="animate-pulse">Menyiapkan peta direktori masjid...</span>
          </div>
        </main>
      </div>
    </div>
  );
}
