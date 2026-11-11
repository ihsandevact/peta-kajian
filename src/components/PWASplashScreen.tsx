'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function PWASplashScreen() {
  const pathname = usePathname();
  const isPipRoute = pathname === '/live/pip' || pathname?.startsWith('/live/pip');
  const [shouldRender, setShouldRender] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // 1. Cek apakah pengguna berada dalam mode PWA Standalone (dibuka dari icon layar utama)
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true);

    // Splash screen hanya ditujukan untuk pengalaman native app saat PWA dibuka dari home screen
    if (!isStandalone) {
      setShouldRender(false);
      return;
    }

    const hasShown = typeof window !== 'undefined' ? sessionStorage.getItem('peta_kajian_splash_shown') : null;
    if (hasShown) {
      setShouldRender(false);
      return;
    }

    setShouldRender(true);

    const timer = setTimeout(() => {
      setIsFadingOut(true);
      try {
        sessionStorage.setItem('peta_kajian_splash_shown', 'true');
      } catch {}

      const unmountTimer = setTimeout(() => {
        setShouldRender(false);
      }, 400);

      return () => clearTimeout(unmountTimer);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  if (isPipRoute || !shouldRender) return null;

  return (
    <div
      aria-hidden={isFadingOut}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between py-12 px-6 bg-surface text-on-surface select-none transition-opacity duration-400 ease-out font-geist ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="w-full" />

      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-32 h-32 rounded-full bg-emerald-500/15 dark:bg-emerald-400/20 blur-2xl animate-pulse" />
          <img
            src="/logo.png?v=3"
            alt="Peta Kajian Logo"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain relative z-10 drop-shadow-md"
          />
        </div>

        <div className="flex flex-col items-center mt-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
            Peta Kajian
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-primary mt-1 tracking-tight">
            Menemukan Majelis Ilmu Lebih Dekat
          </p>
        </div>

        <div className="w-36 h-1 bg-surface-container-high rounded-full overflow-hidden mt-6">
          <div className="w-full h-full bg-primary rounded-full animate-pulse" />
        </div>
      </div>

      <div className="text-center">
        <span className="text-[11px] font-semibold text-outline tracking-wider uppercase">
          Kajian Islam Seluruh Indonesia
        </span>
      </div>
    </div>
  );
}
