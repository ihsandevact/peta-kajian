'use client';

import React from 'react';

interface EndedStreamSkeletonProps {
  count?: number;
}

export function EndedStreamCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-container-lowest border-2 border-surface-container-high/60 shadow-xs flex flex-col overflow-hidden animate-pulse font-geist">
      {/* Video Thumbnail Skeleton Area */}
      <div className="relative aspect-video w-full bg-surface-container flex items-center justify-center">
        {/* Placeholder Tombol Play */}
        <div className="w-12 h-12 rounded-full bg-surface-container-high/70" />
        {/* Placeholder Badge Waktu Selesai */}
        <div className="absolute top-3 left-3 w-24 h-5 rounded-md bg-surface-container-high/80" />
        {/* Placeholder Label Rekaman */}
        <div className="absolute bottom-3 right-3 w-14 h-4 rounded bg-surface-container-high/70" />
      </div>

      {/* Video Details Skeleton Area */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          {/* Baris Channel & Avatar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 rounded-full bg-surface-container-high shrink-0" />
            <div className="w-28 h-3 rounded bg-surface-container-high" />
          </div>

          {/* Baris Judul Video */}
          <div className="space-y-1.5 mt-2">
            <div className="w-full h-4 rounded bg-surface-container-high" />
            <div className="w-3/4 h-4 rounded bg-surface-container-high" />
          </div>
        </div>

        {/* Baris Footer: Asatidzah & Aksi */}
        <div className="pt-3 border-t border-surface-container-high/50 flex items-center justify-between">
          <div className="w-24 h-3.5 rounded bg-surface-container-high" />
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-surface-container-high" />
            <div className="w-7 h-7 rounded-lg bg-surface-container-high" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EndedStreamSkeleton({ count = 6 }: EndedStreamSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <EndedStreamCardSkeleton key={idx} />
      ))}
    </div>
  );
}
