'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface QiblaCompassProps {
  qiblaBearing: number;
  distanceKm: number;
  cityName: string;
  compassHeadingLabel: string;
}

export default function QiblaCompass({
  qiblaBearing,
  distanceKm,
  cityName,
  compassHeadingLabel,
}: QiblaCompassProps) {
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [isSensorSupported, setIsSensorSupported] = useState<boolean | null>(null);
  const [requiresPermission, setRequiresPermission] = useState<boolean>(false);
  const [isAligned, setIsAligned] = useState<boolean>(false);

  const hasVibratedRef = useRef<boolean>(false);

  // Normalisasi sudut ke rentang 0 - 360
  const normalizeAngle = (angle: number) => {
    return ((angle % 360) + 360) % 360;
  };

  // Listener orientasi perangkat
  const handleOrientation = useCallback(
    (e: DeviceOrientationEvent) => {
      let heading: number | null = null;

      // 1. iOS Safari menggunakan webkitCompassHeading
      if ('webkitCompassHeading' in e && typeof (e as any).webkitCompassHeading === 'number') {
        heading = (e as any).webkitCompassHeading;
      }
      // 2. Android / Browser standar menggunakan alpha (dengan compass heading absolute)
      else if (e.alpha !== null) {
        if (e.absolute) {
          heading = 360 - e.alpha;
        } else {
          // Relatif ke orientasi awal
          heading = 360 - e.alpha;
        }
      }

      if (heading !== null) {
        const normalizedHeading = normalizeAngle(heading);
        setDeviceHeading(normalizedHeading);
        setIsSensorSupported(true);

        // Periksa apakah perangkat tepat menghadap Ka'bah (toleransi ±3.5 derajat)
        const diff = Math.abs(normalizedHeading - qiblaBearing);
        const shortestDiff = Math.min(diff, 360 - diff);
        const aligned = shortestDiff <= 3.5;

        setIsAligned(aligned);

        if (aligned) {
          if (!hasVibratedRef.current) {
            hasVibratedRef.current = true;
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate([35, 40, 35]);
              } catch {}
            }
          }
        } else {
          hasVibratedRef.current = false;
        }
      }
    },
    [qiblaBearing]
  );

  // Inisialisasi pengecekan sensor & permission
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (
      typeof (DeviceOrientationEvent as any) !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      // iOS 13+ membutuhkan izin interaksi user
      setRequiresPermission(true);
      setIsSensorSupported(true);
    } else if (typeof window.ondeviceorientation !== 'undefined' || 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
      // Tunggu 1.5 detik jika tidak ada event alpha yang masuk
      const timeout = setTimeout(() => {
        setDeviceHeading((curr) => {
          if (curr === null) {
            setIsSensorSupported(false);
          }
          return curr;
        });
      }, 1500);

      return () => {
        window.removeEventListener('deviceorientation', handleOrientation, true);
        clearTimeout(timeout);
      };
    } else {
      setIsSensorSupported(false);
    }
  }, [handleOrientation]);

  // Request permission untuk iOS
  const requestIOSPermission = async () => {
    try {
      if (
        typeof (DeviceOrientationEvent as any) !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res === 'granted') {
          setRequiresPermission(false);
          window.addEventListener('deviceorientation', handleOrientation, true);
        } else {
          alert('Izin sensor orientasi ditolak. Kompas kiblat manual tetap dapat Anda gunakan.');
          setRequiresPermission(false);
          setIsSensorSupported(false);
        }
      }
    } catch {
      setRequiresPermission(false);
      setIsSensorSupported(false);
    }
  };

  // Rotasi piringan kompas: jika sensor aktif, putar piringan berlawanan arah heading HP
  const dialRotation = deviceHeading !== null ? -deviceHeading : 0;
  // Rotasi jarum kiblat
  const qiblaNeedleRotation = deviceHeading !== null ? qiblaBearing - deviceHeading : qiblaBearing;

  return (
    <div className="w-full flex flex-col items-center max-w-md mx-auto space-y-6">
      {/* 1. STATUS PRESISI & BANNER SEJAJAR */}
      <div
        className={`w-full p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 ${
          isAligned
            ? 'bg-emerald-600/15 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
            : 'bg-surface-container-low border-outline-variant/50 text-on-surface'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
              isAligned ? 'bg-emerald-600 text-white scale-110' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isAligned ? 'verified' : 'explore'}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-xs sm:text-sm truncate">
              {isAligned ? 'Tepat Menghadap Kiblat!' : `Arah Kiblat: ${qiblaBearing}° ${compassHeadingLabel}`}
            </h3>
            <p className="text-[10px] text-on-surface-variant truncate">
              {isAligned
                ? 'Posisi perangkat sejajar dengan arah Ka\'bah'
                : `Lokasi: ${cityName} (${distanceKm.toLocaleString('id-ID')} km)`}
            </p>
          </div>
        </div>

        {isAligned && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse shrink-0">
            PAS
          </span>
        )}
      </div>

      {/* 2. TOMBOL IZIN IOS (Jika diperlukan) */}
      {requiresPermission && (
        <div className="w-full p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2.5">
          <p className="text-xs text-on-surface leading-relaxed">
            Perangkat iOS memerlukan izin sensor kompas untuk memutar piringan secara otomatis.
          </p>
          <button
            type="button"
            onClick={requestIOSPermission}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Aktifkan Sensor Kompas
          </button>
        </div>
      )}

      {/* 3. VISUAL DIAL KOMPAS */}
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center select-none">
        {/* Lingkaran Luar Berpendar (Saat Aligned) */}
        <div
          className={`absolute inset-0 rounded-full transition-all duration-500 ${
            isAligned
              ? 'ring-4 ring-emerald-500/60 ring-offset-4 ring-offset-background shadow-[0_0_40px_rgba(16,185,129,0.35)]'
              : 'ring-1 ring-outline-variant/40'
          }`}
        />

        {/* Piringan Derajat Kompas (Dial yang berputar) */}
        <div
          className="absolute inset-2 rounded-full bg-surface-container-low border border-outline-variant/60 shadow-inner flex items-center justify-center transition-transform duration-200 ease-out"
          style={{ transform: `rotate(${dialRotation}deg)` }}
        >
          {/* Garis-garis Derajat Tik */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = i * 15;
            const isMajor = angle % 90 === 0;
            const isMedium = angle % 30 === 0;

            return (
              <div
                key={angle}
                className="absolute w-full h-full flex justify-center"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <div
                  className={`rounded-full ${
                    isMajor
                      ? 'w-1 h-3.5 bg-emerald-600 dark:bg-emerald-400'
                      : isMedium
                      ? 'w-0.5 h-2.5 bg-on-surface-variant'
                      : 'w-0.5 h-1.5 bg-outline-variant'
                  }`}
                />
              </div>
            );
          })}

          {/* Huruf Mata Angin (U, T, S, B) */}
          <span className="absolute top-4 font-black text-xs text-red-600">U</span>
          <span className="absolute right-4 font-black text-xs text-on-surface-variant">T</span>
          <span className="absolute bottom-4 font-black text-xs text-on-surface-variant">S</span>
          <span className="absolute left-4 font-black text-xs text-on-surface-variant">B</span>
        </div>

        {/* Garis Bidik Perangkat (Tetap statis tegak lurus ke atas layar) */}
        <div className="absolute top-0 w-1 h-6 bg-red-600 rounded-full shadow-xs z-20" />

        {/* Jarum Arah Kiblat (Menunjuk ke Ka'bah) */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-200 ease-out z-10"
          style={{ transform: `rotate(${qiblaNeedleRotation}deg)` }}
        >
          {/* Setengah Atas: Ikon Ka'bah & Panah Emas */}
          <div className="absolute top-6 flex flex-col items-center">
            {/* Badge Ka'bah */}
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                isAligned
                  ? 'bg-emerald-600 text-white scale-125 ring-2 ring-white animate-bounce'
                  : 'bg-slate-900 text-amber-400 border border-amber-400/40'
              }`}
              title="Arah Ka'bah Makkah"
            >
              <span className="material-symbols-outlined text-[20px]">mosque</span>
            </div>
            {/* Ujung Panah Arah */}
            <div
              className={`w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[14px] mt-1 ${
                isAligned ? 'border-b-emerald-600' : 'border-b-amber-500'
              }`}
            />
          </div>

          {/* Garis Poros Tengah Jarum */}
          <div
            className={`w-1 h-28 rounded-full ${
              isAligned ? 'bg-emerald-600' : 'bg-gradient-to-t from-transparent via-amber-500 to-amber-600'
            }`}
          />
        </div>

        {/* Pusat Kompas (Center Cap) */}
        <div className="relative z-20 w-14 h-14 rounded-full bg-surface border-2 border-outline-variant shadow-md flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-black leading-none text-on-surface font-mono">
            {Math.round(qiblaBearing)}°
          </span>
          <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-400 leading-tight">
            KIBLAT
          </span>
        </div>
      </div>

      {/* 4. FOOTNOTE / CARA PENGGUNAAN */}
      <div className="w-full text-center space-y-1.5 px-2">
        {deviceHeading !== null ? (
          <p className="text-xs text-on-surface-variant">
            Pegang ponsel mendatar sejajar dengan permukaan tanah, lalu putar badan hingga tanda Ka'bah berada di puncak garis merah.
          </p>
        ) : isSensorSupported === false ? (
          <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/40 text-xs text-on-surface-variant text-left flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">
              info
            </span>
            <p className="leading-relaxed">
              Sensor kompas tidak aktif pada perangkat ini. Kompas di atas diatur menghadap Utara sejati (U di atas). Ka'bah berada di posisi <strong>{qiblaBearing}°</strong> dari arah Utara.
            </p>
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant animate-pulse">
            Menghubungkan ke sensor kompas ponsel...
          </p>
        )}
      </div>
    </div>
  );
}
