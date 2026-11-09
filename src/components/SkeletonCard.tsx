import React from 'react';

export default function SkeletonCard() {
  return (
    <div className="p-3.5 sm:p-4 border-b border-surface-container-high/50 cursor-default pointer-events-none select-none">
      {/* Konten Utama: Kolom Teks Informasi di Kiri + Kolom Aksi & Thumbnail di Kanan */}
      <div className="flex items-start justify-between gap-3">
        {/* Kolom Kiri: Tanggal, Judul, Pemateri, Lokasi */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Baris 1: Tanggal & Waktu */}
          <div className="flex items-center gap-1.5 animate-pulse">
            <div className="h-4 bg-surface-container-high rounded-full w-28 sm:w-32" />
          </div>

          {/* Baris 2: Judul Kajian & Nama Pemateri */}
          <div className="space-y-1.5 animate-pulse">
            <div className="h-4 bg-surface-container-high rounded w-4/5" />
            <div className="h-4 bg-surface-container-high rounded w-3/5" />
            <div className="h-3.5 bg-surface-container-high rounded w-1/2 pt-0.5" />
          </div>

          {/* Baris 3: Lokasi / Masjid */}
          <div className="flex items-center gap-1.5 pt-0.5 animate-pulse">
            <div className="w-3.5 h-3.5 bg-surface-container-high rounded shrink-0" />
            <div className="h-3 bg-surface-container-high rounded w-2/3" />
          </div>
        </div>

        {/* Kolom Kanan: Tombol Bookmark + Poster Thumbnail */}
        <div className="flex flex-col items-end gap-2 shrink-0 animate-pulse">
          <div className="w-6 h-6 rounded-full bg-surface-container-high" />
          <div className="w-16 h-[84px] sm:w-[70px] sm:h-[90px] rounded-xl bg-surface-container-high shrink-0 shadow-2xs" />
        </div>
      </div>

      {/* Baris Bawah: Status Badges, Kategori Audiens & Jarak */}
      <div className="mt-2.5 pt-1.5 border-t border-surface-container-high/40 flex items-center justify-between gap-2 animate-pulse">
        <div className="flex items-center gap-1.5">
          <div className="h-4 bg-surface-container-high rounded-full w-14" />
          <div className="h-4 bg-surface-container-high rounded w-12" />
        </div>
        <div className="h-4 bg-surface-container-high rounded w-12" />
      </div>
    </div>
  );
}
