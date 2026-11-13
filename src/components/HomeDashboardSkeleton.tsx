import React from 'react';

/**
 * Skeleton untuk kartu kajian vertikal di Beranda (Mobile)
 */
export function HomeKajianCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`p-4 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest shadow-2xs pointer-events-none select-none space-y-3 ${className}`}
    >
      <div className="space-y-2.5 animate-pulse">
        {/* Baris Badges Waktu & Jarak */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-6 bg-surface-container rounded-lg w-28" />
            <div className="h-6 bg-surface-container-low rounded-lg w-16" />
          </div>
          <div className="h-5 w-14 rounded-full bg-surface-container-low" />
        </div>

        {/* Judul Kajian (2 Baris) */}
        <div className="space-y-1.5 pt-0.5">
          <div className="h-4.5 bg-surface-container-high rounded-md w-11/12" />
          <div className="h-4.5 bg-surface-container-high rounded-md w-2/3" />
        </div>

        {/* Pemateri & Lokasi */}
        <div className="space-y-1.5 pt-0.5">
          <div className="h-3.5 bg-surface-container rounded w-1/2" />
          <div className="h-3.5 bg-surface-container-low rounded w-3/5" />
        </div>
      </div>

      {/* Tombol Aksi Bawah: Hadir & Simpan */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-outline-variant/20 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-10 w-24 rounded-xl bg-surface-container" />
          <div className="h-10 w-24 rounded-xl bg-surface-container-low" />
        </div>
        <div className="h-8 w-20 rounded-xl bg-surface-container-low" />
      </div>
    </div>
  );
}

/**
 * Skeleton untuk kartu kajian horizontal di Beranda (Desktop lg+)
 */
export function HomeKajianDesktopCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`p-4 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest shadow-2xs pointer-events-none select-none flex items-center justify-between gap-4 animate-pulse ${className}`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Kotak Jam di Kiri */}
        <div className="w-16 h-16 rounded-2xl bg-surface-container shrink-0" />

        {/* Detail Judul & Pemateri */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 bg-surface-container-high rounded-md w-3/4" />
          <div className="flex items-center gap-3">
            <div className="h-3.5 bg-surface-container rounded w-1/3" />
            <div className="h-3.5 bg-surface-container-low rounded w-1/4" />
          </div>
        </div>
      </div>

      {/* Tombol Aksi di Kanan */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-surface-container-low" />
        <div className="h-10 w-28 rounded-xl bg-[#126947]/30" />
        <div className="h-10 w-20 rounded-xl bg-surface-container-low" />
      </div>
    </div>
  );
}

/**
 * Skeleton untuk kartu Artikel Pilihan di Beranda (Mobile list vertikal)
 */
export function HomeArticleCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 flex items-center gap-3.5 shadow-2xs pointer-events-none select-none animate-pulse ${className}`}
    >
      {/* Thumbnail kecil di kiri */}
      <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl bg-surface-container-high shrink-0" />

      {/* Konten Teks di kanan */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 w-28 rounded bg-surface-container" />
        <div className="space-y-1.5">
          <div className="h-4 bg-surface-container-high rounded w-11/12" />
          <div className="h-4 bg-surface-container-high rounded w-3/4" />
        </div>
        <div className="h-3 w-32 rounded bg-surface-container-low" />
      </div>
    </div>
  );
}

/**
 * Skeleton untuk kartu Artikel Pilihan di Beranda (Desktop 3-Column Grid)
 */
export function HomeArticleDesktopGridSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-2xs pointer-events-none select-none space-y-3 animate-pulse ${className}`}
    >
      <div className="aspect-[16/10] w-full rounded-xl bg-surface-container-high" />
      <div className="space-y-1.5">
        <div className="h-4 bg-surface-container-high rounded w-full" />
        <div className="h-4 bg-surface-container-high rounded w-3/4" />
      </div>
      <div className="h-3 w-1/2 rounded bg-surface-container-low pt-1" />
    </div>
  );
}

/**
 * Skeleton untuk kartu Renungan Harian
 */
export function DailyHadithSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-6 w-36 rounded-md bg-surface-container-high" />
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/25 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 rounded-full bg-surface-container" />
          <div className="flex items-center gap-1.5">
            <div className="w-9 h-9 rounded-xl bg-surface-container-low" />
            <div className="w-9 h-9 rounded-xl bg-surface-container-low" />
            <div className="w-9 h-9 rounded-xl bg-surface-container-low" />
          </div>
        </div>
        <div className="space-y-2 pt-1">
          <div className="h-4 bg-surface-container-high rounded w-full" />
          <div className="h-4 bg-surface-container-high rounded w-5/6" />
        </div>
        <div className="h-3.5 w-36 rounded bg-surface-container" />
      </div>
    </div>
  );
}

/**
 * Skeleton Penuh Halaman Beranda (Home Dashboard Skeleton)
 */
export default function HomeDashboardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="min-h-screen bg-surface text-on-surface font-sans flex flex-col select-none pointer-events-none pb-[calc(88px+env(safe-area-inset-bottom,16px))] md:pb-12"
    >
      {/* NAVBAR DESKTOP SKELETON */}
      <header className="hidden md:block sticky top-0 z-40 w-full bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/25">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-4 animate-pulse">
          {/* Logo & Links */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-surface-container-high shrink-0" />
              <div className="h-4 w-28 rounded-md bg-surface-container-high" />
            </div>

            <div className="hidden md:flex items-center gap-2">
              <div className="h-8 w-20 rounded-xl bg-surface-container" />
              <div className="h-8 w-20 rounded-xl bg-surface-container-low" />
              <div className="h-8 w-16 rounded-xl bg-surface-container-low" />
              <div className="h-8 w-20 rounded-xl bg-surface-container-low" />
              <div className="h-8 w-20 rounded-xl bg-surface-container-low" />
            </div>
          </div>

          {/* Right: Search, Notif, Theme, Avatar */}
          <div className="flex items-center gap-2.5">
            <div className="hidden lg:block w-64 h-10 rounded-2xl bg-surface-container-low" />
            <div className="w-10 h-10 rounded-xl bg-surface-container-low" />
            <div className="w-10 h-10 rounded-xl bg-surface-container-low" />
            <div className="hidden lg:block w-10 h-10 rounded-full bg-[#126947]/30" />
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER SKELETON */}
      <main className="w-full max-w-xl md:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 lg:px-6 pt-4 sm:pt-6 lg:pt-8">
        {/* SKELETON MOBILE (< lg) */}
        <div className="lg:hidden space-y-6">
          {/* 1. Header Ringkas */}
          <section className="space-y-3.5 animate-pulse">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="h-3.5 w-44 rounded bg-surface-container-high" />
                <div className="h-7 w-56 rounded-lg bg-surface-container-high" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-11 h-11 rounded-2xl bg-surface-container-lowest border border-outline-variant/25" />
                <div className="w-11 h-11 rounded-2xl bg-surface-container-lowest border border-outline-variant/25" />
              </div>
            </div>
            <div className="h-12 w-full rounded-2xl bg-surface-container-lowest border border-outline-variant/25 px-4 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-surface-container" />
              <div className="h-3.5 w-48 rounded bg-surface-container" />
            </div>
          </section>

          {/* 2. Hero Waktu Sholat */}
          <section className="rounded-3xl bg-[#126947] p-5 sm:p-6 text-white space-y-4 shadow-sm animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 rounded bg-white/20" />
              <div className="h-6 w-28 rounded-full bg-white/15" />
            </div>
            <div className="h-11 w-64 rounded-xl bg-white/25" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`h-16 rounded-2xl ${i === 1 ? 'bg-white' : 'bg-white/15'}`} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="h-11 rounded-2xl bg-white/15" />
              <div className="h-11 rounded-2xl bg-white/15" />
            </div>
          </section>

          {/* 4. Quick Access 5 Ikon */}
          <section className="grid grid-cols-5 gap-2 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface-container" />
                <div className="h-3 w-12 rounded bg-surface-container" />
              </div>
            ))}
          </section>

          {/* 5. Kajian Hari Ini */}
          <section className="space-y-3.5">
            <div className="flex items-center justify-between animate-pulse">
              <div className="h-6 w-56 rounded-md bg-surface-container-high" />
              <div className="h-4 w-24 rounded bg-surface-container" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <HomeKajianCardSkeleton key={i} />
              ))}
            </div>
          </section>

          {/* 6. Renungan Harian */}
          <DailyHadithSkeleton />

          {/* 7. Artikel Pilihan */}
          <section className="space-y-3">
            <div className="flex items-center justify-between animate-pulse">
              <div className="h-6 w-36 rounded-md bg-surface-container-high" />
              <div className="h-4 w-24 rounded bg-surface-container" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <HomeArticleCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>

        {/* SKELETON DESKTOP (lg+) */}
        <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
          {/* Kolom Kiri */}
          <div className="min-w-0 space-y-7">
            {/* Greeting */}
            <div className="space-y-2 animate-pulse">
              <div className="h-4 w-52 rounded bg-surface-container" />
              <div className="h-8 w-80 rounded-lg bg-surface-container-high" />
              <div className="h-4 w-96 rounded bg-surface-container-low" />
            </div>

            {/* Kajian Hari Ini */}
            <div className="space-y-4">
              <div className="flex items-center justify-between animate-pulse">
                <div className="h-6 w-60 rounded-md bg-surface-container-high" />
                <div className="h-4 w-24 rounded bg-surface-container" />
              </div>
              <div className="flex items-center gap-2 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 w-24 rounded-full bg-surface-container-low" />
                ))}
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <HomeKajianDesktopCardSkeleton key={i} />
                ))}
              </div>
            </div>

            {/* Artikel Pilihan */}
            <div className="space-y-4">
              <div className="flex items-center justify-between animate-pulse">
                <div className="h-6 w-40 rounded-md bg-surface-container-high" />
                <div className="h-4 w-24 rounded bg-surface-container" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <HomeArticleDesktopGridSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>

          {/* Kolom Kanan (Sidebar) */}
          <aside className="space-y-6">
            {/* Hero Waktu Sholat */}
            <div className="rounded-3xl bg-[#126947] p-5 sm:p-6 text-white space-y-4 shadow-sm animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 w-36 rounded bg-white/20" />
                <div className="h-6 w-24 rounded-full bg-white/15" />
              </div>
              <div className="h-11 w-52 rounded-xl bg-white/25" />
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`h-16 rounded-2xl ${i === 1 ? 'bg-white' : 'bg-white/15'}`} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="h-11 rounded-2xl bg-white/15" />
                <div className="h-11 rounded-2xl bg-white/15" />
              </div>
            </div>

            {/* Quick Access Grid 2x3 */}
            <div className="grid grid-cols-2 gap-2.5 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-2xl bg-surface-container-low" />
              ))}
            </div>

            {/* Renungan Sidebar */}
            <div className="p-5 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest space-y-3 animate-pulse">
              <div className="h-4 w-32 rounded bg-surface-container" />
              <div className="h-16 rounded-lg bg-surface-container-low" />
              <div className="h-4 w-40 rounded bg-surface-container" />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
