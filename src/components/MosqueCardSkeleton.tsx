import React from 'react';

export default function MosqueCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="p-3.5 sm:p-4 rounded-2xl border border-outline-variant/50 bg-surface shadow-xs pointer-events-none select-none"
    >
      <div className="flex items-start gap-3 animate-pulse">
        {/* Placeholder Ikon Kubah Masjid */}
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-surface-container-high shrink-0" />

        {/* Placeholder Konten Utama */}
        <div className="flex-1 min-w-0">
          {/* Baris Nama Masjid & Pill Jarak + Waktu Tempuh */}
          <div className="flex items-start justify-between gap-2">
            <div className="h-4 sm:h-[18px] bg-surface-container-high rounded-md w-3/5" />
            <div className="h-5 bg-surface-container-high rounded-full w-24 shrink-0" />
          </div>

          {/* Baris Alamat */}
          <div className="h-3 bg-surface-container-high rounded w-4/5 mt-2" />

          {/* Baris Badges Status Kajian & Fasilitas */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <div className="h-4 sm:h-[18px] bg-surface-container-high rounded-md w-24" />
            <div className="h-4 sm:h-[18px] bg-surface-container-high rounded-md w-14" />
            <div className="h-4 sm:h-[18px] bg-surface-container-high rounded-md w-16" />
          </div>
        </div>
      </div>

      {/* Placeholder Tombol Aksi Bawah */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-outline-variant/30 animate-pulse">
        <div className="h-5 bg-surface-container-high rounded-lg w-24" />
        <div className="h-7 bg-emerald-600/20 dark:bg-emerald-500/20 rounded-xl w-24" />
      </div>
    </div>
  );
}
