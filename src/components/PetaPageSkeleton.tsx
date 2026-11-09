import React from 'react';
import SkeletonCard from './SkeletonCard';

/**
 * Skeleton khusus untuk Kanvas Peta (digunakan saat bundle MapLibre sedang diunduh di client)
 */
export function MapCanvasSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`w-full h-full relative flex items-center justify-center bg-surface-container-low overflow-hidden select-none pointer-events-none ${className}`}
    >
      {/* Motif Grid Peta Halus */}
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Titik-titik Pin Placeholder Beranimasi Denyut */}
      <div className="absolute top-1/4 left-1/3 w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center animate-ping" />
      <div className="absolute top-1/2 left-2/3 w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center animate-ping [animation-delay:400ms]" />
      <div className="absolute bottom-1/3 left-1/2 w-7 h-7 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center animate-ping [animation-delay:800ms]" />

      {/* Badge Status Tengah */}
      <div className="relative z-10 inline-flex items-center gap-2.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-surface/90 backdrop-blur-md border border-outline-variant/60 shadow-lg text-xs font-bold text-on-surface">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="animate-pulse">Menyiapkan peta interaktif kajian...</span>
      </div>

      {/* Placeholder Tombol Kontrol Peta (Kanan Bawah) */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <div className="w-10 h-10 rounded-xl bg-surface-container-high/80 backdrop-blur-sm animate-pulse shadow-md" />
        <div className="w-10 h-10 rounded-xl bg-surface-container-high/80 backdrop-blur-sm animate-pulse shadow-md" />
      </div>
    </div>
  );
}

/**
 * Skeleton Lengkap Halaman Peta Kajian (/peta)
 */
export default function PetaPageSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat Peta Kajian"
      className="relative w-full h-[100dvh] flex flex-col md:flex-row bg-background text-on-surface overflow-hidden font-geist select-none pointer-events-none"
    >
      {/* 1. DESKTOP LEFT NAVIGATION RAIL SKELETON */}
      <aside className="hidden md:flex w-16 h-full flex-col items-center justify-between py-3.5 border-r border-outline-variant/40 bg-surface-container-lowest shrink-0 z-30">
        <div className="flex flex-col items-center gap-5 w-full">
          {/* Logo Skeleton */}
          <div className="w-10 h-10 rounded-xl bg-surface-container-high animate-pulse" />

          {/* Nav Icons Skeleton */}
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="w-9 h-9 rounded-xl bg-surface-container-high animate-pulse" />
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-600/30 animate-pulse" />
            <div className="w-9 h-9 rounded-xl bg-surface-container-high animate-pulse" />
            <div className="w-9 h-9 rounded-xl bg-surface-container-high animate-pulse" />
            <div className="w-9 h-9 rounded-xl bg-surface-container-high animate-pulse" />
          </div>
        </div>

        {/* Bottom Theme & User Avatar Skeleton */}
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="w-8 h-8 rounded-full bg-surface-container-high animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-surface-container-high animate-pulse" />
        </div>
      </aside>

      {/* 2. MAIN SIDEBAR LIST SKELETON */}
      <div className="w-full md:w-[410px] lg:w-[430px] h-full flex flex-col bg-surface-container-lowest border-r border-outline-variant/40 shrink-0 z-30">
        {/* Top Header & Search Bar Skeleton */}
        <div className="p-3 sm:p-4 border-b border-surface-container-high/60 space-y-3 shrink-0">
          <div className="flex items-center gap-2 animate-pulse">
            <div className="flex-1 h-9 sm:h-[38px] rounded-xl bg-surface-container-high" />
            <div className="w-20 sm:w-24 h-9 sm:h-[38px] rounded-xl bg-surface-container-high shrink-0" />
          </div>

          {/* Filter Pills Skeleton */}
          <div className="flex items-center gap-1.5 overflow-hidden animate-pulse">
            <div className="h-7 w-20 rounded-lg bg-surface-container-high shrink-0" />
            <div className="h-7 w-16 rounded-lg bg-surface-container-high shrink-0" />
            <div className="h-7 w-24 rounded-lg bg-surface-container-high shrink-0" />
            <div className="h-7 w-16 rounded-lg bg-surface-container-high shrink-0" />
          </div>
        </div>

        {/* Counter Row Skeleton */}
        <div className="px-4 py-2 border-b border-surface-container-high/40 flex items-center justify-between gap-2 shrink-0 animate-pulse">
          <div className="h-3.5 w-32 rounded bg-surface-container-high" />
          <div className="h-3.5 w-16 rounded bg-surface-container-high" />
        </div>

        {/* List of Skeleton Cards */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>

      {/* 3. MAP AREA SKELETON */}
      <main className="hidden md:flex flex-1 h-full relative items-center justify-center bg-surface-container-low overflow-hidden">
        <MapCanvasSkeleton />
      </main>

      {/* 4. MOBILE BOTTOM NAVIGATION SKELETON */}
      <div className="md:hidden fixed inset-x-0 bottom-0 h-16 bg-surface-container-lowest border-t border-outline-variant/40 flex items-center justify-around px-2 z-40 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-6 h-6 rounded-lg bg-surface-container-high" />
            <div className="w-10 h-2 rounded bg-surface-container-high" />
          </div>
        ))}
      </div>
    </div>
  );
}
