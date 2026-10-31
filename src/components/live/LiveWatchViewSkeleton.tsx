'use client';

import React from 'react';
import { YoutubeCompactCardSkeleton } from './EndedStreamSkeleton';

export function LiveWatchViewSkeleton() {
  return (
    <div className="w-full min-h-screen bg-surface font-geist text-on-surface flex flex-col">
      {/* ========================================================
          1. MOBILE SKELETON (< 640px)
          Tampilan identik dengan MobileYoutubeLiveViewer
          ======================================================== */}
      <div className="sm:hidden w-full flex flex-col">
        {/* Sticky Top 16:9 Player Skeleton */}
        <div className="sticky top-0 z-30 w-full bg-black shadow-md">
          <div className="relative aspect-video w-full bg-neutral-900 animate-pulse flex items-center justify-center">
            <span className="material-symbols-outlined text-neutral-800 text-[48px]">smart_display</span>
            {/* Quick Header Overlay Placeholder */}
            <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-neutral-800/80" />
          </div>
        </div>

        {/* Video Info Skeleton */}
        <div className="px-3.5 pt-3 pb-3 space-y-3 bg-surface border-b border-surface-container-high/60 animate-pulse">
          {/* Judul Kajian (2 Baris) */}
          <div className="space-y-1.5">
            <div className="h-4.5 bg-surface-container rounded-md w-11/12" />
            <div className="h-4 bg-surface-container rounded-md w-3/4" />
          </div>

          {/* Profil Saluran & Tombol Aksi */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-surface-container shrink-0" />
              <div className="space-y-1">
                <div className="h-3.5 bg-surface-container rounded w-32" />
                <div className="h-2.5 bg-surface-container-high rounded w-20" />
              </div>
            </div>

            {/* Tombol Catat Faidah */}
            <div className="w-9 h-9 rounded-full bg-surface-container shrink-0" />
          </div>
        </div>

        {/* Filter Tabs Skeleton (3 Kategori: Live, Mendatang, Rekaman) */}
        <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-surface-container-high/60 bg-surface/95 animate-pulse">
          <div className="h-8 w-20 rounded-full bg-surface-container" />
          <div className="h-8 w-28 rounded-full bg-surface-container" />
          <div className="h-8 w-24 rounded-full bg-surface-container" />
        </div>

        {/* List Feed Kajian Compact */}
        <div className="p-3 space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <YoutubeCompactCardSkeleton key={idx} />
          ))}
        </div>
      </div>

      {/* ========================================================
          2. DESKTOP SKELETON (>= 640px)
          Tampilan identik dengan Desktop Watch Mode 2-Kolom (70% + 30%)
          ======================================================== */}
      <div className="hidden sm:flex flex-col flex-1">
        {/* Top Header Desktop Skeleton */}
        <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4 animate-pulse">
            {/* Sisi Kiri: Back button & Title */}
            <div className="flex items-center gap-3">
              <div className="w-24 h-8 rounded-xl bg-surface-container" />
              <div className="h-5 w-px bg-surface-container-high" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-surface-container shrink-0" />
                <div className="h-4 bg-surface-container rounded w-24" />
              </div>
            </div>

            {/* Sisi Tengah: Search Bar */}
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="w-full h-8 rounded-full bg-surface-container-low border border-surface-container-high" />
            </div>

            {/* Sisi Kanan: Action Pills */}
            <div className="flex items-center gap-2.5">
              <div className="w-28 h-8 rounded-full bg-surface-container" />
              <div className="w-24 h-8 rounded-xl bg-surface-container" />
            </div>
          </div>
        </header>

        {/* Main 2-Column Content Skeleton */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex-1 w-full">
          <div className="flex flex-col lg:flex-row gap-6 w-full animate-pulse">
            {/* Kolom Kiri: Player Utama (70%) */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* 16:9 Video Box Skeleton */}
              <div className="aspect-video w-full rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center relative overflow-hidden shadow-lg">
                <span className="material-symbols-outlined text-neutral-800 text-[64px]">smart_display</span>
              </div>

              {/* Judul Kajian */}
              <div className="mt-4 space-y-2">
                <div className="h-6 bg-surface-container rounded-lg w-5/6" />
                <div className="h-4.5 bg-surface-container rounded-lg w-1/2" />
              </div>

              {/* Baris Saluran & Tombol Aksi */}
              <div className="flex items-center justify-between gap-4 py-3.5 border-b border-surface-container-high/60 mt-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-surface-container shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-4 bg-surface-container rounded w-36" />
                    <div className="h-3 bg-surface-container-high rounded w-24" />
                  </div>
                </div>

                {/* Tombol Aksi Kanan */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-9 w-28 rounded-full bg-surface-container" />
                  <div className="h-9 w-28 rounded-full bg-surface-container" />
                </div>
              </div>

              {/* Description Card */}
              <div className="mt-3.5 p-4 rounded-2xl bg-surface-container-low border border-surface-container-high/60 space-y-2">
                <div className="h-3 bg-surface-container rounded w-44" />
                <div className="h-3 bg-surface-container rounded w-full" />
                <div className="h-3 bg-surface-container rounded w-4/5" />
              </div>
            </div>

            {/* Kolom Kanan: Sidebar Rekomendasi (30%) */}
            <div className="w-full lg:w-[32%] xl:w-[28%] flex flex-col gap-3 shrink-0">
              {/* Header Sidebar */}
              <div className="flex items-center justify-between pb-1">
                <div className="h-4 bg-surface-container rounded w-28" />
                <div className="h-3 bg-surface-container rounded w-14" />
              </div>

              {/* Filter Chips Pills */}
              <div className="flex items-center gap-1.5 pb-1">
                <div className="h-7 w-16 rounded-lg bg-surface-container" />
                <div className="h-7 w-22 rounded-lg bg-surface-container" />
                <div className="h-7 w-20 rounded-lg bg-surface-container" />
              </div>

              {/* Daftar Kartu Video Compact Sidebar */}
              <div className="flex flex-col gap-2.5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <YoutubeCompactCardSkeleton key={idx} />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default LiveWatchViewSkeleton;
