import React from 'react';

export default function MosqueProfileLoading() {
  return (
    <div className="min-h-screen bg-background text-on-surface font-geist">
      {/* Header Bar Skeleton */}
      <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 border-b border-outline-variant/40 bg-surface/90 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-9 h-9 rounded-xl bg-surface-container-high" />
          <div className="h-4 w-44 rounded bg-surface-container-high" />
        </div>
        <div className="w-9 h-9 rounded-xl bg-surface-container-high animate-pulse" />
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Hero Card Skeleton */}
        <div className="p-5 sm:p-6 rounded-3xl border border-outline-variant/50 bg-surface space-y-4 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface-container-high shrink-0" />
            <div className="flex-1 space-y-2.5">
              <div className="flex gap-2">
                <div className="h-5 w-24 rounded-full bg-surface-container-high" />
                <div className="h-5 w-28 rounded-full bg-surface-container-high" />
              </div>
              <div className="h-6 sm:h-7 w-3/5 rounded-lg bg-surface-container-high" />
              <div className="h-4 w-4/5 rounded bg-surface-container-high" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <div className="h-9 w-32 rounded-xl bg-emerald-600/20" />
            <div className="h-9 w-28 rounded-xl bg-surface-container-high" />
            <div className="h-9 w-24 rounded-xl bg-surface-container-high" />
          </div>
        </div>

        {/* Grid Jadwal & Peta Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="lg:col-span-2 space-y-3">
            <div className="h-5 w-40 rounded bg-surface-container-high" />
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-outline-variant/40 bg-surface space-y-2.5"
              >
                <div className="h-4 w-32 rounded-full bg-surface-container-high" />
                <div className="h-5 w-3/4 rounded bg-surface-container-high" />
                <div className="h-4 w-1/2 rounded bg-surface-container-high" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="h-5 w-36 rounded bg-surface-container-high" />
            <div className="h-64 rounded-2xl bg-surface-container-high" />
          </div>
        </div>
      </main>
    </div>
  );
}
