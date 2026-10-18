'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { StudySession } from '@/lib/services/kajian';
import {
  type RouteResult,
  type RouteStep,
  formatDistanceText,
  formatDurationText,
  calculateDirectDistanceMeters,
} from '@/lib/services/routing';

interface LiveNavigationHUDProps {
  session: StudySession;
  routeResult: RouteResult;
  userLocation: { lat: number; lng: number } | null;
  userHeading?: number | null;
  onExit: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export default function LiveNavigationHUD({
  session,
  routeResult,
  userLocation,
  userHeading,
  onExit,
  isMuted,
  onToggleMute,
}: LiveNavigationHUDProps) {
  const steps = routeResult.steps || [];
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isStepsDrawerOpen, setIsStepsDrawerOpen] = useState<boolean>(false);
  const spokenStepsRef = useRef<Set<number>>(new Set());

  const currentStep: RouteStep | undefined = steps[currentStepIndex];
  const nextStep: RouteStep | undefined = steps[currentStepIndex + 1];

  // Hitung jarak dinamis dari pengguna ke titik belokan berikutnya
  const distanceToNextManeuver = useMemo(() => {
    if (!userLocation || !nextStep) {
      return currentStep?.distanceMeters || 0;
    }
    return calculateDirectDistanceMeters(
      [userLocation.lng, userLocation.lat],
      nextStep.location
    );
  }, [userLocation, currentStep, nextStep]);

  // Otomatis melangkah ke instruksi berikutnya saat belokan saat ini telah dicapai (< 25 meter)
  useEffect(() => {
    if (nextStep && distanceToNextManeuver <= 25 && currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [distanceToNextManeuver, nextStep, currentStepIndex, steps.length]);

  // Panduan Suara Otomatis (Web Speech Synthesis API dalam Bahasa Indonesia)
  useEffect(() => {
    if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (!spokenStepsRef.current.has(currentStepIndex)) {
      const stepToAnnounce = currentStep;
      if (!stepToAnnounce) return;

      spokenStepsRef.current.add(currentStepIndex);

      let textToSpeak = '';
      if (currentStepIndex === 0) {
        textToSpeak = `Mulai navigasi menuju ${session.venues?.name || session.title}. ${stepToAnnounce.instruction}`;
      } else if (currentStepIndex === steps.length - 1) {
        textToSpeak = `Anda telah tiba di lokasi kajian: ${session.venues?.name || session.title}`;
      } else {
        const distText = formatDistanceText(stepToAnnounce.distanceMeters);
        textToSpeak = `Dalam ${distText}, ${stepToAnnounce.instruction}`;
      }

      try {
        window.speechSynthesis.cancel(); // Hentikan suara sebelumnya jika ada antrean
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'id-ID';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
      }
    }
  }, [currentStepIndex, currentStep, isMuted, session]);

  const venue = session.venues;
  const googleMapsUrl = venue?.lat && venue?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`
    : null;

  return (
    <>
      {/* 1. TOP HUD BANNER (Petunjuk Belokan Aktif) */}
      <div className="fixed md:absolute top-3 md:top-4 inset-x-3 md:inset-x-auto md:left-6 md:w-[420px] z-40 animate-in slide-in-from-top-4 duration-300 font-geist select-none">
        <div className="bg-surface-container-lowest/95 backdrop-blur-md border border-surface-container-high/80 rounded-2xl shadow-2xl p-3 sm:p-4 text-on-surface">
          <div className="flex items-start gap-3">
            {/* Kotak Ikon Belokan */}
            <div className="w-13 h-13 rounded-2xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-lg shrink-0">
              <span className="material-symbols-outlined text-[32px] font-bold">
                {currentStep?.iconName || 'navigation'}
              </span>
            </div>

            {/* Teks Instruksi & Jarak Belokan */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight leading-none">
                  {formatDistanceText(distanceToNextManeuver)}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  lagi
                </span>
              </div>
              <h3 className="font-bold text-sm sm:text-base text-on-surface mt-1 line-clamp-1 leading-snug">
                {currentStep?.instruction || 'Lurus terus ikuti jalur'}
              </h3>
              {nextStep && (
                <p className="text-[11px] text-outline truncate mt-0.5 flex items-center gap-1">
                  <span>Lalu:</span>
                  <span className="font-medium text-on-surface-variant truncate">{nextStep.instruction}</span>
                </p>
              )}
            </div>

            {/* Tombol Aksi Cepat di Atas: Mute & Keluar Navigasi */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onToggleMute}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer border ${
                  isMuted
                    ? 'bg-surface-container text-outline border-surface-container-high hover:text-on-surface'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                }`}
                title={isMuted ? 'Bunyikan Panduan Suara' : 'Bisukan Suara'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isMuted ? 'volume_off' : 'volume_up'}
                </span>
              </button>

              <button
                type="button"
                onClick={onExit}
                className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-surface-container-high shadow-2xs"
                title="Keluar dari Navigasi Langsung dan Kembali ke Pratinjau Rute"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM FLOATING CONTROL BAR (Bilah Kontrol Bawah) */}
      <div className="fixed md:absolute bottom-3 md:bottom-6 inset-x-3 md:inset-x-auto md:left-6 md:w-[420px] z-40 animate-in slide-in-from-bottom-4 duration-300 font-geist pb-[env(safe-area-inset-bottom,0px)]">
        <div className="bg-surface-container-lowest/95 backdrop-blur-md border border-surface-container-high/80 rounded-2xl shadow-2xl p-3 sm:p-3.5 text-on-surface flex flex-col gap-2">
          {/* Baris 1: Sisa Waktu & Jarak, Tombol Detail Belokan, dan Tombol Keluar Navigasi */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">
                  {formatDurationText(routeResult.durationMinutes)}
                </span>
                <span className="text-xs font-semibold text-outline">
                  • {formatDistanceText(routeResult.distanceMeters)}
                </span>
              </div>
              <p className="text-[11px] font-medium text-on-surface-variant truncate mt-0.5" title={venue?.name || session.title}>
                Menuju: {venue?.name || session.title}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Tombol Buka Lembar Rincian Belokan */}
              <button
                type="button"
                onClick={() => setIsStepsDrawerOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1 border border-surface-container-high transition-colors cursor-pointer"
                title="Buka Daftar Semua Belokan"
              >
                <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                <span className="hidden sm:inline">Rincian</span>
              </button>

              {/* Tombol Keluar Navigasi yang Sangat Jelas */}
              <button
                type="button"
                onClick={onExit}
                className="px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-1 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Keluar dari Navigasi Langsung"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                <span>Keluar</span>
              </button>
            </div>
          </div>

          {/* Baris 2: Tombol Navigasi Google Maps Eksternal (Cadangan) */}
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-high text-[11px] font-semibold text-on-surface-variant hover:text-primary transition-all active:scale-95 shadow-2xs"
              title="Beralih ke Google Maps jika butuh navigasi audio mobil / Android Auto"
            >
              <span className="material-symbols-outlined text-[14px] text-primary">navigation</span>
              <span>Buka Cadangan Google Maps</span>
              <span className="material-symbols-outlined text-[12px] opacity-70">open_in_new</span>
            </a>
          )}
        </div>
      </div>

      {/* 3. STEP-BY-STEP DIRECTIONS DRAWER (Modal Lembar Rincian Belokan) */}
      {isStepsDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200 font-geist"
          onClick={() => setIsStepsDrawerOpen(false)}
        >
          <div
            className="w-full md:max-w-md bg-surface-container-lowest rounded-t-3xl md:rounded-3xl border border-surface-container-high shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Drawer */}
            <div className="p-4 border-b border-surface-container-high/60 flex items-center justify-between shrink-0">
              <div>
                <h4 className="font-bold text-sm sm:text-base text-on-surface">
                  Petunjuk Arah Rute ({steps.length} Langkah)
                </h4>
                <p className="text-[11px] text-outline truncate">
                  Ke {venue?.name || session.title}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsStepsDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Isi Daftar Belokan */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {steps.map((step, idx) => {
                const isCurrent = idx === currentStepIndex;
                const isPassed = idx < currentStepIndex;

                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 shadow-xs'
                        : isPassed
                        ? 'opacity-40 border-transparent bg-surface-container-low/40'
                        : 'bg-surface-container-low/60 border-surface-container-high/60'
                    }`}
                  >
                    {/* Lingkaran Ikon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-md'
                          : isPassed
                          ? 'bg-surface-container text-outline'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {step.iconName}
                      </span>
                    </div>

                    {/* Instruksi & Jarak */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-outline">
                          Langkah {idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatDistanceText(step.distanceMeters)}
                        </span>
                      </div>
                      <p className={`text-xs font-semibold mt-0.5 leading-snug ${isCurrent ? 'text-emerald-950 dark:text-emerald-100' : 'text-on-surface'}`}>
                        {step.instruction}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Tutup */}
            <div className="p-3 border-t border-surface-container-high/60 shrink-0">
              <button
                type="button"
                onClick={() => setIsStepsDrawerOpen(false)}
                className="w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
