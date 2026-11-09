'use client';

import React from 'react';

interface SkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton Kartu Video YouTube Desktop (Grid 3-4 Kolom)
 * Struktur: Thumbnail 16:9 + Avatar bulat di kiri + Judul & Info di kanan
 */
export function YoutubeCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 font-geist animate-pulse">
      {/* Thumbnail 16:9 */}
      <div className="relative aspect-video w-full rounded-2xl bg-surface-container overflow-hidden">
        {/* Placeholder Badge Pojok Kanan Bawah */}
        <div className="absolute bottom-2.5 right-2.5 w-16 h-4 rounded-md bg-surface-container-high/80" />
      </div>

      {/* Info Baris: Avatar + Text Details */}
      <div className="flex items-start gap-3">
        {/* Avatar Bulat Saluran */}
        <div className="w-9 h-9 rounded-full bg-surface-container shrink-0 mt-0.5" />

        {/* Kolom Teks Judul & Meta */}
        <div className="flex-1 space-y-2">
          {/* Judul Baris 1 & 2 */}
          <div className="w-full h-4 rounded-md bg-surface-container" />
          <div className="w-3/4 h-3.5 rounded-md bg-surface-container" />

          {/* Saluran & Pemateri */}
          <div className="pt-1 space-y-1">
            <div className="w-32 h-3 rounded bg-surface-container-high" />
            <div className="w-24 h-2.5 rounded bg-surface-container-high/70" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton Kartu Video YouTube Compact (Sidebar Rekomendasi Kanan pada Watch View)
 * Struktur: Thumbnail 16:9 compact di kiri + Teks di kanan
 */
export function YoutubeCompactCardSkeleton() {
  return (
    <div className="flex items-start gap-2.5 font-geist animate-pulse p-1.5 rounded-xl">
      {/* Thumbnail 16:9 Compact */}
      <div className="w-36 sm:w-40 aspect-video rounded-xl bg-surface-container shrink-0 overflow-hidden relative">
        <div className="absolute bottom-1.5 right-1.5 w-10 h-3 rounded bg-surface-container-high/80" />
      </div>

      {/* Kolom Teks Kanan */}
      <div className="flex-1 min-w-0 space-y-1.5 py-0.5">
        <div className="w-full h-3.5 rounded bg-surface-container" />
        <div className="w-2/3 h-3 rounded bg-surface-container" />
        <div className="w-24 h-2.5 rounded bg-surface-container-high mt-1" />
        <div className="w-16 h-2 rounded bg-surface-container-high/70" />
      </div>
    </div>
  );
}

/**
 * Grid Skeleton YouTube Desktop (3-4 Kolom)
 */
export function YoutubeGridSkeleton({ count = 8, className = '' }: SkeletonProps) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6 ${className}`}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <YoutubeCardSkeleton key={idx} />
      ))}
    </div>
  );
}

/**
 * Sidebar Skeleton YouTube Desktop
 */
export function YoutubeSidebarSkeleton({ count = 6 }: SkeletonProps) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, idx) => (
        <YoutubeCompactCardSkeleton key={idx} />
      ))}
    </div>
  );
}

/**
 * Backward compatibility: EndedStreamCardSkeleton & EndedStreamSkeleton
 */
export function EndedStreamCardSkeleton() {
  return <YoutubeCardSkeleton />;
}

export default function EndedStreamSkeleton({ count = 6 }: SkeletonProps) {
  return <YoutubeGridSkeleton count={count} />;
}
