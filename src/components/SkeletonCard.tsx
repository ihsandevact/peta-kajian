import React from 'react';

export default function SkeletonCard() {
  return (
    <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-2xs overflow-hidden cursor-default pointer-events-none select-none animate-pulse">
      {/* 1. Baris Header Full-Width: Status + Jadwal + Jarak di Kiri, Bookmark di Kanan */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-14 rounded-lg bg-surface-container-high shrink-0" />
          <div className="h-5 w-36 rounded-lg bg-[#e4eee8]/80 dark:bg-emerald-950/50" />
        </div>
        <div className="w-7 h-7 rounded-lg bg-surface-container-high shrink-0" />
      </div>

      {/* 2. Baris Body: Blok Teks di Kiri + Thumbnail Bersih di Kanan */}
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Judul Kajian */}
          <div className="space-y-1.5">
            <div className="h-4 bg-surface-container-high rounded w-11/12" />
            <div className="h-4 bg-surface-container-high rounded w-3/4" />
          </div>

          {/* Nama Pemateri */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <div className="w-3.5 h-3.5 rounded-full bg-surface-container-high shrink-0" />
            <div className="h-3 bg-surface-container rounded w-1/2" />
          </div>

          {/* Lokasi */}
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-surface-container-high shrink-0" />
            <div className="h-3 bg-surface-container rounded w-2/3" />
          </div>
        </div>

        {/* Thumbnail Box (70x70 / 74x74) */}
        <div className="w-[70px] h-[70px] sm:w-[74px] sm:h-[74px] rounded-xl bg-surface-container-high shrink-0" />
      </div>
    </div>
  );
}
