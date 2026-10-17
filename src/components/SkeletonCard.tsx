import React from 'react';

export default function SkeletonCard() {
  return (
    <div className="p-3.5 sm:p-4 border-b border-surface-container-high/50 cursor-default pointer-events-none">
      {/* Baris 1: Tanggal & Bookmark */}
      <div className="flex items-center justify-between gap-2 animate-pulse">
        <div className="h-4 bg-surface-container-high rounded w-28"></div>
        <div className="w-6 h-6 bg-surface-container-high rounded-full"></div>
      </div>

      {/* Baris 2: Judul Kajian & Pemateri */}
      <div className="mt-2 animate-pulse">
        <div className="h-4 bg-surface-container-high rounded w-4/5 mb-1.5"></div>
        <div className="h-3.5 bg-surface-container-high rounded w-1/2"></div>
      </div>

      {/* Baris 3: Lokasi */}
      <div className="mt-2 flex items-center gap-1.5 animate-pulse">
        <div className="w-3.5 h-3.5 bg-surface-container-high rounded shrink-0"></div>
        <div className="h-3 bg-surface-container-high rounded w-3/5"></div>
      </div>

      {/* Baris 4 (Bawah): Badges & Jarak */}
      <div className="mt-2.5 pt-1.5 border-t border-surface-container-high/40 flex items-center justify-between gap-2 animate-pulse">
        <div className="flex items-center gap-1.5">
          <div className="h-4 bg-surface-container-high rounded w-12"></div>
          <div className="h-4 bg-surface-container-high rounded w-14"></div>
        </div>
        <div className="h-4 bg-surface-container-high rounded w-10"></div>
      </div>
    </div>
  );
}
