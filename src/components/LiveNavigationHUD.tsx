'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { StudySession } from '@/lib/services/kajian';
import {
  type RouteResult,
  type RouteStep,
  formatDistanceText,
  formatDurationText,
  calculateDirectDistanceMeters,
  calculateMinDistanceToPolyline,
} from '@/lib/services/routing';
import {
  type NavigationVehicleIcon,
  setStoredVehicleIcon,
  VEHICLE_OPTIONS,
  ALL_VEHICLE_OPTIONS,
} from '@/utils/navigationVehicle';
import { saveParkingSpot } from '@/utils/parkingSpot';
import VehiclePickerModal from './VehiclePickerModal';

interface LiveNavigationHUDProps {
  session: StudySession;
  routeResult: RouteResult;
  userLocation: { lat: number; lng: number } | null;
  userHeading?: number | null;
  userAccuracy?: number | null;
  onExit: () => void;
  onFinish?: () => void;
  onReroute?: (newOrigin: { lat: number; lng: number }) => Promise<void> | void;
  isMuted: boolean;
  onToggleMute: () => void;
  vehicleIcon?: NavigationVehicleIcon;
  onVehicleIconChange?: (icon: NavigationVehicleIcon) => void;
  onParkingSaved?: () => void;
}

// Suara bel Ding-Dong kedatangan sintetis (Web Audio API - 0 dependensi & bekerja offline)
function playArrivalChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Nada 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.18, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Nada 2: A5 (880 Hz) - jeda 160ms (Ding-Dong!)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
    gain2.gain.setValueAtTime(0.22, ctx.currentTime + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.16);
    osc2.stop(ctx.currentTime + 0.65);
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
}

// Selector otomatis suara penutur pria Bahasa Indonesia
function getIndonesianMaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Filter suara bahasa Indonesia
  const idVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('id'));
  if (idVoices.length === 0) return null;

  // 1. Cari suara yang spesifik penutur pria (Andika, Ardi, Male, Pria, David)
  const maleVoice = idVoices.find((v) =>
    /andika|ardi|male|pria|david/i.test(v.name)
  );
  if (maleVoice) return maleVoice;

  // 2. Cari suara Google Bahasa Indonesia
  const googleVoice = idVoices.find((v) => /google/i.test(v.name));
  if (googleVoice) return googleVoice;

  return idVoices[0];
}

export default function LiveNavigationHUD({
  session,
  routeResult,
  userLocation,
  userHeading,
  userAccuracy,
  onExit,
  onFinish,
  onReroute,
  isMuted,
  onToggleMute,
  vehicleIcon,
  onVehicleIconChange,
  onParkingSaved,
}: LiveNavigationHUDProps) {
  const steps = routeResult.steps || [];
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isStepsDrawerOpen, setIsStepsDrawerOpen] = useState<boolean>(false);
  const [isVehiclePickerOpen, setIsVehiclePickerOpen] = useState<boolean>(false);
  const [hasArrived, setHasArrived] = useState<boolean>(false);
  const [showArrivalModal, setShowArrivalModal] = useState<boolean>(false);
  const [isRerouting, setIsRerouting] = useState<boolean>(false);
  const [parkingSaved, setParkingSaved] = useState<boolean>(false);
  const spokenStepsRef = useRef<Set<number>>(new Set());
  const hasAnnouncedArrivalRef = useRef<boolean>(false);
  const offRouteCounterRef = useRef<number>(0);
  const lastRerouteTimeRef = useRef<number>(0);

  const activeVehicle = vehicleIcon || 'car';
  const currentVehicleConfig =
    ALL_VEHICLE_OPTIONS.find((v) => v.id === activeVehicle) || VEHICLE_OPTIONS[0];

  const handleSelectVehicle = (newIcon: NavigationVehicleIcon) => {
    setStoredVehicleIcon(newIcon);
    if (onVehicleIconChange) {
      onVehicleIconChange(newIcon);
    }
  };

  const currentStep: RouteStep | undefined = steps[currentStepIndex];
  const nextStep: RouteStep | undefined = steps[currentStepIndex + 1];

  // Koordinat tujuan akhir
  const destinationCoord = useMemo<[number, number] | null>(() => {
    if (session.venues?.lng && session.venues?.lat) {
      return [session.venues.lng, session.venues.lat];
    }
    if (routeResult.geometry.coordinates.length > 0) {
      return routeResult.geometry.coordinates[routeResult.geometry.coordinates.length - 1];
    }
    return null;
  }, [session.venues, routeResult.geometry.coordinates]);

  // Jarak langsung realtime ke lokasi tujuan akhir
  const distanceToDestination = useMemo(() => {
    if (!userLocation || !destinationCoord) return Infinity;
    return calculateDirectDistanceMeters(
      [userLocation.lng, userLocation.lat],
      destinationCoord
    );
  }, [userLocation, destinationCoord]);

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

  // Fungsi pengucapan narator suara pria Bahasa Indonesia dengan artikulasi jelas
  const speakText = useCallback(
    (text: string) => {
      if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';

        const selectedVoice = getIndonesianMaleVoice();
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        // Tuning nada (pitch) & kecepatan (rate) untuk suara pria yang mantap, tenang & artikulatif
        utterance.pitch = 0.88;
        utterance.rate = 0.95;

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
      }
    },
    [isMuted]
  );

  // Trigger kedatangan tujuan
  const triggerArrival = useCallback(() => {
    if (hasAnnouncedArrivalRef.current) return;
    hasAnnouncedArrivalRef.current = true;
    setHasArrived(true);
    setShowArrivalModal(true);

    // 1. Bel Ding-Dong Chime
    if (!isMuted) {
      playArrivalChime();
    }

    // 2. Getar Haptic
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 80, 150, 80, 250]);
      } catch {}
    }

    // 3. Suara Narator Pria Bahasa Indonesia
    const placeName = session.venues?.name || session.title;
    speakText(`Alhamdulillah, Anda telah tiba di lokasi tujuan: ${placeName}`);
  }, [isMuted, session, speakText]);

  // Deteksi kedatangan otomatis saat mendekati tujuan (< 35m) atau langkah terakhir dicapai (<= 50m)
  useEffect(() => {
    if (hasArrived) return;
    const isVeryClose = distanceToDestination <= 35;
    const isLastStepAndClose = currentStepIndex === steps.length - 1 && distanceToDestination <= 50;

    if (isVeryClose || isLastStepAndClose) {
      triggerArrival();
    }
  }, [distanceToDestination, currentStepIndex, steps.length, hasArrived, triggerArrival]);

  // Panduan Suara Otomatis Belokan (Narator Pria Bahasa Indonesia)
  useEffect(() => {
    if (hasArrived) return;
    if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (!spokenStepsRef.current.has(currentStepIndex)) {
      const stepToAnnounce = currentStep;
      if (!stepToAnnounce) return;

      spokenStepsRef.current.add(currentStepIndex);

      let textToSpeak = '';
      if (currentStepIndex === 0) {
        textToSpeak = `Bismillah, mulai navigasi menuju ${session.venues?.name || session.title}. ${stepToAnnounce.instruction}`;
      } else if (currentStepIndex === steps.length - 1) {
        textToSpeak = `Mendekati lokasi kajian: ${session.venues?.name || session.title}`;
      } else {
        const distText = formatDistanceText(stepToAnnounce.distanceMeters);
        textToSpeak = `Dalam ${distText}, ${stepToAnnounce.instruction}`;
      }

      speakText(textToSpeak);
    }
  }, [currentStepIndex, currentStep, isMuted, session, steps.length, hasArrived, speakText]);

  // Deteksi Off-Route Otomatis saat Salah Jalan & Recalculate
  useEffect(() => {
    if (hasArrived || !userLocation || !routeResult.geometry?.coordinates || isRerouting) {
      return;
    }

    const now = Date.now();
    // Cooldown 12 detik antar reroute agar tidak memanggil berulang
    if (now - lastRerouteTimeRef.current < 12000) {
      return;
    }

    const distToRoute = calculateMinDistanceToPolyline(
      [userLocation.lng, userLocation.lat],
      routeResult.geometry.coordinates
    );

    // Jika deviasi lebih dari 45 meter dari jalur
    if (distToRoute > 45) {
      offRouteCounterRef.current += 1;
      // Butuh 2 kali pembacaan berurutan untuk menyaring noise GPS
      if (offRouteCounterRef.current >= 2) {
        offRouteCounterRef.current = 0;
        lastRerouteTimeRef.current = now;
        setIsRerouting(true);

        if (!isMuted) {
          speakText('Menghitung ulang rute');
        }

        if (onReroute) {
          Promise.resolve(onReroute(userLocation)).finally(() => {
            setIsRerouting(false);
          });
        } else {
          setIsRerouting(false);
        }
      }
    } else {
      offRouteCounterRef.current = 0;
    }
  }, [userLocation, routeResult, hasArrived, isRerouting, isMuted, onReroute, speakText]);

  const venue = session.venues;
  const googleMapsUrl = venue?.lat && venue?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`
    : null;

  return (
    <>
      {/* 1. TOP HUD BANNER (Petunjuk Belokan Aktif atau Status Tiba) */}
      <div className="fixed md:absolute top-3 md:top-4 inset-x-3 md:inset-x-auto md:left-6 md:w-[420px] z-40 animate-in slide-in-from-top-4 duration-300 font-geist select-none">
        <div className="bg-surface-container-lowest/95 backdrop-blur-md border border-surface-container-high/80 rounded-2xl shadow-2xl p-3 sm:p-4 text-on-surface">
          <div className="flex items-start gap-3">
            {/* Kotak Ikon Belokan atau Ceklis Kedatangan */}
            <div
              className={`w-13 h-13 rounded-2xl ${
                hasArrived
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 ring-4 ring-emerald-500/20 shadow-emerald-600/30'
                  : 'bg-emerald-600 dark:bg-emerald-500'
              } text-white flex items-center justify-center shadow-lg shrink-0 transition-all`}
            >
              <span className="material-symbols-outlined text-[32px] font-bold">
                {hasArrived ? 'check_circle' : currentStep?.iconName || 'navigation'}
              </span>
            </div>

            {/* Teks Instruksi & Jarak Belokan / Status Tiba */}
            <div className="flex-1 min-w-0">
              {hasArrived ? (
                <div>
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Tiba di Tujuan
                  </span>
                  <h3 className="font-extrabold text-sm sm:text-base text-on-surface mt-0.5 line-clamp-1 leading-snug">
                    {venue?.name || session.title}
                  </h3>
                  <p className="text-[11px] text-outline truncate mt-0.5">
                    Alhamdulillah perjalanan Anda telah selesai
                  </p>
                </div>
              ) : (
                <>
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
                      <span className="font-medium text-on-surface-variant truncate">
                        {nextStep.instruction}
                      </span>
                    </p>
                  )}

                  {/* Status Rerouting Otomatis */}
                  {isRerouting && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold animate-pulse mt-1.5">
                      <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                      <span>Menghitung ulang rute...</span>
                    </div>
                  )}

                  {/* Indikator Akurasi GPS Rendah */}
                  {typeof userAccuracy === 'number' && userAccuracy > 25 && !isRerouting && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[10px] font-semibold mt-1.5">
                      <span className="material-symbols-outlined text-[12px]">satellite_alt</span>
                      <span>Akurasi GPS ±{Math.round(userAccuracy)}m</span>
                    </div>
                  )}
                </>
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
                onClick={hasArrived && onFinish ? onFinish : onExit}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border shadow-2xs ${
                  hasArrived
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-surface-container-high'
                }`}
                title={hasArrived ? 'Selesai dan Buka Kajian' : 'Keluar dari Navigasi Langsung'}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {hasArrived ? 'check' : 'arrow_back'}
                </span>
                <span className="hidden sm:inline">{hasArrived ? 'Selesai' : 'Keluar'}</span>
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

              {/* Tombol Ganti Ikon Kendaraan (Hanya untuk moda berkendara) */}
              {routeResult.mode === 'driving' && (
                <button
                  type="button"
                  onClick={() => setIsVehiclePickerOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1 border border-surface-container-high transition-colors cursor-pointer"
                  title={`Kendaraan: ${currentVehicleConfig.label} (Klik untuk ganti)`}
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    {currentVehicleConfig.icon}
                  </span>
                  <span className="hidden sm:inline">{currentVehicleConfig.label}</span>
                </button>
              )}

              {/* Tombol Selesai (saat tiba) atau Keluar Navigasi */}
              {hasArrived ? (
                <button
                  type="button"
                  onClick={onFinish ? onFinish : onExit}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Selesai Navigasi dan Buka Kajian"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Selesai</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onExit}
                  className="px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-1 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Keluar dari Navigasi Langsung"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  <span>Keluar</span>
                </button>
              )}
            </div>
          </div>

          {/* Tombol Bantuan Manual 'Saya Sudah Sampai' saat berada dalam radius 150m */}
          {!hasArrived && distanceToDestination <= 150 && (
            <button
              type="button"
              onClick={triggerArrival}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer animate-in fade-in zoom-in-95"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Saya Sudah Sampai di Lokasi ({formatDistanceText(distanceToDestination)})</span>
            </button>
          )}

          {/* Tombol Tampilkan Kartu Kedatangan jika dialog ditutup pengguna */}
          {hasArrived && !showArrivalModal && (
            <button
              type="button"
              onClick={() => setShowArrivalModal(true)}
              className="w-full py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">info</span>
              <span>Buka Kartu Tiba di Tujuan</span>
            </button>
          )}

          {/* Baris 2: Tombol Navigasi Google Maps Eksternal (Cadangan) */}
          {googleMapsUrl && !hasArrived && (
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

      {/* 3. MODAL / BOTTOM SHEET KEDATANGAN (Google Maps Style) */}
      {showArrivalModal && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end md:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 font-geist"
          onClick={() => setShowArrivalModal(false)}
        >
          <div
            className="w-full md:max-w-md bg-surface-container-lowest rounded-3xl border-2 border-emerald-500/80 shadow-2xl p-5 sm:p-6 text-on-surface animate-in slide-in-from-bottom-8 duration-300 relative text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tombol Tutup Silang */}
            <button
              type="button"
              onClick={() => setShowArrivalModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              title="Tutup dialog kedatangan"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {/* Badge Ikon Ceklis Animasi */}
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-600/30 ring-4 ring-emerald-500/20">
              <span className="material-symbols-outlined text-[34px] font-bold">check_circle</span>
            </div>

            <p className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              TIBA DI TUJUAN
            </p>
            <h3 className="text-xl sm:text-2xl font-black text-on-surface mt-1 tracking-tight">
              Alhamdulillah, Anda Telah Sampai!
            </h3>

            {/* Info Lokasi & Kajian */}
            <div className="mt-4 p-3.5 rounded-2xl bg-surface-container-low/80 border border-surface-container-high/60 text-left space-y-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400 shrink-0">
                  mosque
                </span>
                <h4 className="font-bold text-sm text-on-surface line-clamp-1">
                  {venue?.name || session.title}
                </h4>
              </div>
              {venue?.address && (
                <p className="text-xs text-outline line-clamp-2 pl-6">
                  {venue.address}
                </p>
              )}
              {session.speaker_name && (
                <p className="text-[11px] text-on-surface-variant font-medium pl-6 pt-1">
                  Pemateri: <span className="font-bold text-on-surface">{session.speaker_name}</span>
                </p>
              )}
            </div>

            {/* Statistik Perjalanan */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-left">
              <div className="p-2.5 rounded-xl bg-surface-container/60 border border-surface-container-high/40">
                <p className="text-[10px] text-outline font-semibold uppercase">Jarak Tempuh</p>
                <p className="text-sm font-black text-on-surface mt-0.5">
                  {formatDistanceText(routeResult.distanceMeters)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container/60 border border-surface-container-high/40">
                <p className="text-[10px] text-outline font-semibold uppercase">Waktu Perjalanan</p>
                <p className="text-sm font-black text-on-surface mt-0.5">
                  {formatDurationText(routeResult.durationMinutes)}
                </p>
              </div>
            </div>

            {/* Tombol Aksi Utama */}
            <div className="mt-5 space-y-2">
              {/* Tombol Tandai Lokasi Parkir Kendaraan */}
              {userLocation && (
                <button
                  type="button"
                  onClick={() => {
                    saveParkingSpot(
                      userLocation,
                      venue?.name || session.title,
                      vehicleIcon || 'car'
                    );
                    setParkingSaved(true);
                    onParkingSaved?.();
                  }}
                  disabled={parkingSaved}
                  className={`w-full py-2.5 px-4 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    parkingSaved
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 active:scale-95 shadow-2xs'
                  }`}
                  title="Simpan titik koordinat parkir kendaraan Anda"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {parkingSaved ? 'check_circle' : 'local_parking'}
                  </span>
                  <span>
                    {parkingSaved
                      ? 'Lokasi Parkir Berhasil Ditandai!'
                      : 'Tandai Lokasi Parkir Kendaraan Saya'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowArrivalModal(false);
                  if (onFinish) {
                    onFinish();
                  } else {
                    onExit();
                  }
                }}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">check</span>
                <span>Selesai Navigasi & Buka Kajian</span>
              </button>

              <button
                type="button"
                onClick={() => setShowArrivalModal(false)}
                className="w-full py-2 text-xs font-semibold text-outline hover:text-on-surface transition-colors cursor-pointer"
              >
                Tetap Tampilkan Peta
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal Pemilih Kustomisasi Kendaraan */}
      <VehiclePickerModal
        isOpen={isVehiclePickerOpen}
        onClose={() => setIsVehiclePickerOpen(false)}
        currentIcon={activeVehicle}
        onSelect={handleSelectVehicle}
      />
    </>
  );
}
