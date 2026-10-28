import React from 'react';

/**
 * Skeleton untuk kartu kajian di Beranda (Grid 1 / 2 / 3 kolom)
 */
export function HomeKajianCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/40 bg-surface-container-low shadow-2xs pointer-events-none select-none flex flex-col justify-between space-y-2.5 sm:space-y-3 ${className}`}
    >
      <div className="space-y-2 animate-pulse">
        {/* Baris Badges Tanggal & Jarak */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="h-5 bg-emerald-600/15 rounded-full w-28 sm:w-32" />
          <div className="h-5 bg-surface-container-high rounded-full w-16 sm:w-20" />
        </div>

        {/* Judul Kajian (2 Baris) */}
        <div className="space-y-1.5 pt-1">
          <div className="h-4 sm:h-5 bg-surface-container-high rounded-md w-4/5" />
          <div className="h-4 sm:h-5 bg-surface-container-high rounded-md w-3/5" />
        </div>

        {/* Pemateri */}
        <div className="h-3.5 bg-surface-container-high rounded w-1/2 pt-0.5" />

        {/* Lokasi / Masjid */}
        <div className="flex items-center gap-1.5 pt-1">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-600/20 shrink-0" />
          <div className="h-3.5 bg-surface-container-high rounded w-2/3" />
        </div>
      </div>

      {/* Tombol Aksi Bawah */}
      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-outline-variant/30 animate-pulse">
        <div className="flex items-center gap-1.5">
          <div className="h-7 w-20 sm:w-24 rounded-lg sm:rounded-xl bg-surface-container-high" />
          <div className="w-7 h-7 rounded-lg sm:rounded-xl bg-surface-container-high" />
        </div>
        <div className="h-4 w-20 rounded bg-emerald-600/20" />
      </div>
    </div>
  );
}

/**
 * Skeleton untuk kartu direktori masjid di Beranda (Grid 1 / 2 / 4 kolom)
 */
export function HomeMosqueCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/40 bg-surface-container-low shadow-2xs pointer-events-none select-none flex flex-col justify-between space-y-2.5 sm:space-y-3 ${className}`}
    >
      <div className="space-y-2 animate-pulse">
        {/* Ikon Kubah Masjid & Badge Jarak */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-teal-100/70 dark:bg-teal-950/70 shrink-0" />
          <div className="h-5 bg-surface-container-high rounded-full w-20 sm:w-24" />
        </div>

        {/* Nama Masjid & Alamat */}
        <div className="space-y-1.5 pt-1">
          <div className="h-4 sm:h-5 bg-surface-container-high rounded-md w-4/5" />
          <div className="h-3.5 bg-surface-container-high rounded w-3/5" />
        </div>

        {/* Badge Status Kajian Aktif */}
        <div className="h-4 bg-emerald-600/15 rounded-md w-28 mt-1" />
      </div>

      {/* Tombol Aksi Profil & Rute */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-outline-variant/30 animate-pulse">
        <div className="flex-1 h-7 rounded-lg sm:rounded-xl bg-surface-container-high" />
        <div className="h-7 w-16 sm:w-20 rounded-lg sm:rounded-xl bg-emerald-600/20" />
      </div>
    </div>
  );
}

/**
 * Skeleton untuk kartu kutipan hadits harian di Beranda
 */
export function DailyHadithSkeleton() {
  return (
    <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pb-4 sm:pb-6 w-full">
      <div className="rounded-2xl sm:rounded-3xl bg-surface border border-emerald-500/20 p-3.5 sm:p-5 shadow-xs space-y-2.5 animate-pulse">
        {/* Baris Atas */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-600/15" />
            <div className="h-4 w-24 rounded bg-surface-container-high" />
            <div className="h-4 w-20 rounded-full bg-emerald-600/10" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-7 w-12 sm:w-16 rounded-lg sm:rounded-xl bg-surface-container-high" />
            <div className="h-7 w-12 sm:w-16 rounded-lg sm:rounded-xl bg-surface-container-high" />
            <div className="h-7 w-14 sm:w-18 rounded-lg sm:rounded-xl bg-emerald-600/20" />
          </div>
        </div>

        {/* Teks Terjemahan Hadits */}
        <div className="space-y-1.5 pt-1">
          <div className="h-4 sm:h-4.5 bg-surface-container-high rounded w-full" />
          <div className="h-4 sm:h-4.5 bg-surface-container-high rounded w-4/5" />
        </div>

        {/* Perawi */}
        <div className="h-3 w-36 rounded bg-emerald-600/15 mt-2" />
      </div>
    </section>
  );
}

/**
 * Skeleton untuk kartu Artikel Islam di Beranda (Horizontal Snap di Mobile & 3-Kolom Grid di Desktop)
 */
export function HomeArticleCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`w-[78vw] sm:w-auto shrink-0 snap-start first:ml-3.5 last:mr-3.5 sm:first:ml-0 sm:last:mr-0 rounded-2xl sm:rounded-3xl bg-surface-container-low border border-outline-variant/40 flex flex-col justify-between overflow-hidden shadow-2xs pointer-events-none select-none ${className}`}
    >
      {/* Banner Thumbnail Placeholder (Aspect 16/9) */}
      <div className="relative aspect-[16/9] w-full bg-surface-container-high shrink-0 animate-pulse">
        <div className="absolute top-2.5 left-2.5">
          <div className="h-4 w-20 rounded-full bg-emerald-600/20" />
        </div>
        <div className="absolute bottom-2 right-2.5">
          <div className="h-4 w-16 rounded-full bg-surface/60" />
        </div>
      </div>

      {/* Konten Teks Placeholder */}
      <div className="p-3.5 sm:p-4 flex flex-col justify-between flex-1 gap-2.5 animate-pulse">
        <div className="space-y-2">
          {/* Judul (2 Baris) */}
          <div className="space-y-1.5">
            <div className="h-3.5 sm:h-4 bg-surface-container-high rounded w-11/12" />
            <div className="h-3.5 sm:h-4 bg-surface-container-high rounded w-3/4" />
          </div>
          {/* Ringkasan (2 Baris) */}
          <div className="space-y-1 pt-0.5">
            <div className="h-2.5 sm:h-3 bg-surface-container-high rounded w-full" />
            <div className="h-2.5 sm:h-3 bg-surface-container-high rounded w-4/5" />
          </div>
        </div>

        {/* Footer Penulis & Tombol Baca */}
        <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
          <div className="h-3 w-28 rounded bg-surface-container-high" />
          <div className="h-3 w-12 rounded bg-emerald-600/20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton Penuh Halaman Beranda (Home Dashboard Skeleton)
 * Menampilkan representasi layout 1:1 saat halaman pertama kali di-load
 */
export default function HomeDashboardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="min-h-screen bg-background text-on-surface font-geist flex flex-col select-none pointer-events-none pb-[calc(76px+env(safe-area-inset-bottom,16px))] md:pb-0"
    >
      {/* 1. NAVBAR HEADER DESKTOP SKELETON */}
      <header className="hidden md:block sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b border-outline-variant/40">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-4 animate-pulse">
          {/* Logo & Brand Placeholder */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-surface-container-high shrink-0" />
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-24 rounded-md bg-surface-container-high" />
              <div className="h-3.5 w-16 rounded-md bg-emerald-600/15" />
            </div>
          </div>

          {/* Desktop Nav Links (5 Pill Placeholders) */}
          <nav className="flex items-center gap-1.5">
            <div className="h-8 w-18 rounded-xl bg-emerald-600/15" />
            <div className="h-8 w-22 rounded-xl bg-surface-container-high" />
            <div className="h-8 w-26 rounded-xl bg-surface-container-high" />
            <div className="h-8 w-24 rounded-xl bg-surface-container-high" />
            <div className="h-8 w-18 rounded-xl bg-surface-container-high" />
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-surface-container-high" />
            <div className="h-8 w-24 rounded-xl bg-surface-container-high" />
          </div>
        </div>
      </header>

      {/* 2. HERO BENTO SECTION SKELETON: Sapaan, Waktu Sholat & Pencarian */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-600/10 via-emerald-600/5 to-transparent pt-4 sm:pt-6 pb-6 sm:pb-8 border-b border-outline-variant/30">
        {/* Quick Switch Dark Mode Placeholder Khusus Mobile */}
        <div className="md:hidden absolute top-3.5 right-3.5 z-20 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-surface/90 border border-outline-variant/60 shadow-xs" />
        </div>

        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
          {/* Baris Sapaan, Tanggal & Tombol Lokasi */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 pr-9 md:pr-0 animate-pulse">
            <div>
              <div className="h-3 sm:h-3.5 w-32 sm:w-40 bg-emerald-600/20 rounded" />
              <div className="h-6 sm:h-8 w-60 sm:w-80 bg-surface-container-high rounded-xl mt-1.5" />
              <div className="h-3.5 sm:h-4 w-80 sm:w-96 max-w-[85%] bg-surface-container-high rounded mt-1.5" />
            </div>

            <div className="h-7 sm:h-8 w-36 sm:w-44 rounded-xl bg-surface/90 border border-outline-variant/60 self-start md:self-auto" />
          </div>

          {/* Bento Box Waktu Sholat Real-Time */}
          <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-surface/95 backdrop-blur-md border border-emerald-600/25 shadow-sm space-y-3 sm:space-y-4 animate-pulse">
            {/* Header Box Waktu Sholat */}
            <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-600/15 shrink-0" />
                <div className="space-y-1">
                  <div className="h-4 w-28 rounded bg-surface-container-high" />
                  <div className="h-2.5 w-20 rounded bg-surface-container-high" />
                </div>
              </div>
              <div className="h-7 sm:h-8 w-36 sm:w-44 rounded-xl sm:rounded-2xl bg-emerald-600/20 shrink-0" />
            </div>

            {/* Grid 5 Waktu Sholat */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 text-center">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-center py-2 sm:py-3 px-1 sm:px-2 rounded-xl sm:rounded-2xl border border-outline-variant/40 bg-surface-container-low/70 gap-1 sm:gap-1.5"
                >
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-surface-container-high" />
                  <div className="h-2.5 sm:h-3 w-8 sm:w-12 rounded bg-surface-container-high" />
                  <div className="h-3.5 sm:h-4 w-10 sm:w-14 rounded bg-surface-container-high" />
                </div>
              ))}
            </div>
          </div>

          {/* Form Pencarian Cepat Placeholder */}
          <div className="relative max-w-3xl mx-auto h-11 sm:h-13 bg-surface rounded-xl sm:rounded-2xl border border-outline-variant/60 shadow-xs flex items-center px-4 justify-between animate-pulse">
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded bg-surface-container-high" />
              <div className="h-3.5 w-40 sm:w-56 bg-surface-container-high rounded" />
            </div>
            <div className="h-7 sm:h-8 w-14 sm:w-16 rounded-lg sm:rounded-xl bg-emerald-600/25" />
          </div>
        </div>
      </section>

      {/* 3. BENTO QUICK LINKS: 4 PILAR UTAMA */}
      <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 w-full">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-surface border border-outline-variant/50 shadow-xs flex flex-col justify-between space-y-3 animate-pulse"
            >
              <div>
                <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-surface-container-high shrink-0" />
                  <div className="h-4 sm:h-5 w-16 sm:w-20 rounded-full bg-surface-container-high" />
                </div>
                <div className="h-4 sm:h-5 w-3/4 rounded bg-surface-container-high" />
                <div className="hidden sm:block space-y-1 mt-1.5">
                  <div className="h-3 w-5/6 rounded bg-surface-container-high" />
                  <div className="h-3 w-2/3 rounded bg-surface-container-high" />
                </div>
              </div>
              <div className="h-3.5 w-20 rounded bg-emerald-600/20 mt-2.5 sm:mt-4" />
            </div>
          ))}
        </div>
      </section>

      {/* 3.6 SEKSI ARTIKEL ISLAM SKELETON */}
      <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pb-4 sm:pb-6 w-full">
        <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-surface/90 border border-outline-variant/50 shadow-xs space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-2 px-1 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-600/20" />
              <div className="h-4 w-28 rounded bg-surface-container-high" />
            </div>
            <div className="h-3.5 w-20 rounded bg-emerald-600/20" />
          </div>

          <div className="flex overflow-x-auto snap-x snap-mandatory pb-1 -mx-3.5 sm:mx-0 sm:pb-0 sm:grid sm:grid-cols-3 gap-3 sm:gap-4 no-scrollbar">
            {Array.from({ length: 3 }).map((_, idx) => (
              <HomeArticleCardSkeleton key={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* 4. SEKSI MUTIARA HADITS SKELETON */}
      <DailyHadithSkeleton />

      {/* 5. SEKSI JADWAL KAJIAN TERDEKAT & HARI INI */}
      <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pb-8 sm:pb-10 w-full space-y-3.5 sm:space-y-4">
        {/* Header Seksi & Tab Filter Placeholder */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 animate-pulse">
          <div>
            <div className="h-5 sm:h-6 w-56 sm:w-72 rounded-md bg-surface-container-high" />
            <div className="h-3 w-64 sm:w-80 rounded bg-surface-container-high mt-1" />
          </div>

          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl sm:rounded-2xl border border-outline-variant/40 self-start sm:self-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 sm:h-7 w-16 sm:w-20 rounded-lg sm:rounded-xl bg-surface-container-high" />
            ))}
          </div>
        </div>

        {/* Grid 4 Kartu Kajian (Mobile Swipe / Desktop 4-Kolom) */}
        <div className="flex overflow-x-auto snap-x snap-mandatory pb-2 -mx-3.5 sm:mx-0 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-scrollbar">
          {Array.from({ length: 4 }).map((_, i) => (
            <HomeKajianCardSkeleton key={i} className="w-[82vw] sm:w-auto shrink-0 snap-start first:ml-3.5 last:mr-3.5 sm:first:ml-0 sm:last:mr-0" />
          ))}
        </div>

        {/* Tombol Jelajahi Semua Kajian */}
        <div className="pt-2 flex justify-center animate-pulse">
          <div className="h-10 sm:h-12 w-full sm:w-80 rounded-xl sm:rounded-2xl bg-emerald-600/20" />
        </div>
      </section>

      {/* 5. SEKSI MASJID TERDEKAT */}
      <section className="bg-surface-container-lowest/60 border-t border-outline-variant/30 pt-6 pb-24 sm:py-10">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 animate-pulse">
            <div>
              <div className="h-5 sm:h-6 w-60 sm:w-80 rounded-md bg-surface-container-high" />
              <div className="h-3 w-72 sm:w-96 rounded bg-surface-container-high mt-1" />
            </div>
            <div className="h-4 w-32 rounded bg-teal-600/20 self-start sm:self-auto" />
          </div>

          {/* Grid 4 Kartu Masjid (Mobile Swipe / Desktop 4-Kolom) */}
          <div className="flex overflow-x-auto snap-x snap-mandatory pb-2 -mx-3.5 sm:mx-0 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 no-scrollbar">
            {Array.from({ length: 4 }).map((_, i) => (
              <HomeMosqueCardSkeleton key={i} className="w-[78vw] sm:w-auto shrink-0 snap-start first:ml-3.5 last:mr-3.5 sm:first:ml-0 sm:last:mr-0" />
            ))}
          </div>
        </div>
      </section>

      {/* 6. FOOTER DESKTOP SKELETON */}
      <footer className="hidden md:block mt-auto border-t border-outline-variant/40 bg-surface-container-low py-6 sm:py-8 text-xs text-on-surface-variant">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4 animate-pulse">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-surface-container-high" />
              <div className="h-4 w-36 rounded bg-surface-container-high" />
            </div>
            <div className="flex items-center gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-3.5 w-18 rounded bg-surface-container-high" />
              ))}
            </div>
          </div>
          <div className="border-t border-outline-variant/30 pt-3 flex items-center justify-between">
            <div className="h-3 w-48 rounded bg-surface-container-high" />
            <div className="h-3 w-64 rounded bg-surface-container-high" />
          </div>
        </div>
      </footer>
    </div>
  );
}
