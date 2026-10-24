'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function PWASplashScreen() {
  const pathname = usePathname();
  const isPipRoute = pathname === '/live/pip' || pathname?.startsWith('/live/pip');
  const [shouldRender, setShouldRender] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // 1. Cek apakah pengguna berada dalam mode PWA Standalone (dibuka dari ikon layar utama)
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true);

    // 2. Pada browser biasa, splash screen hanya ditampilkan pada kunjungan pertama dalam sesi
    // Pada mode standalone PWA, splash screen selalu ditampilkan untuk nuansa native app
    const hasShown = typeof window !== 'undefined' ? sessionStorage.getItem('peta_kajian_splash_shown') : null;
    if (hasShown && !isStandalone) {
      setShouldRender(false);
      return;
    }

    // 3. Beri durasi minimum tampilan (~750ms) agar transisi branding terasa tenang & tidak berkedip
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      try {
        sessionStorage.setItem('peta_kajian_splash_shown', 'true');
      } catch (e) {
        // Abaikan jika private mode menolak sessionStorage
      }

      // 4. Hapus total komponen dari DOM setelah animasi fade-out (500ms) selesai
      const unmountTimer = setTimeout(() => {
        setShouldRender(false);
      }, 500);

      return () => clearTimeout(unmountTimer);
    }, 750);

    return () => clearTimeout(timer);
  }, []);

  if (isPipRoute || !shouldRender) return null;

  return (
    <div
      aria-hidden={isFadingOut}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between py-12 px-6 bg-surface text-on-surface select-none transition-opacity duration-500 ease-out font-geist ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Spacer Atas */}
      <div className="w-full" />

      {/* Konten Utama Tengah: Logo, Tipografi Brand & Indikator Loading */}
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Kontainer Logo dengan Efek Cahaya Hijau Lembut */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-32 h-32 rounded-full bg-emerald-500/15 dark:bg-emerald-400/20 blur-2xl animate-pulse" />
          <img
            src="/logo.png?v=3"
            alt="Peta Kajian Logo"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain relative z-10 drop-shadow-md animate-in zoom-in-95 duration-500"
          />
        </div>

        {/* Nama & Tagline Aplikasi */}
        <div className="flex flex-col items-center mt-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
            Peta Kajian
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-primary mt-1 tracking-tight">
            Menemukan Majelis Ilmu Lebih Dekat
          </p>
        </div>

        {/* Indikator Loading Minimalis Berwarna Emerald */}
        <div className="w-36 h-1 bg-surface-container-high rounded-full overflow-hidden mt-6">
          <div className="w-full h-full bg-primary rounded-full animate-pulse" />
        </div>
      </div>

      {/* Footer Bawah: Tagline Wilayah */}
      <div className="text-center">
        <span className="text-[11px] font-semibold text-outline tracking-wider uppercase">
          Kajian Islam Seluruh Indonesia
        </span>
      </div>
    </div>
  );
}
