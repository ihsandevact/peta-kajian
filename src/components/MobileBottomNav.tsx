'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface MobileBottomNavProps {
  currentUser?: User | null;
  hasActiveLiveStreams?: boolean;
  className?: string;
}

export default function MobileBottomNav({
  currentUser,
  hasActiveLiveStreams = false,
  className = '',
}: MobileBottomNavProps) {
  const pathname = usePathname() || '/';

  const isBerandaActive = pathname === '/';
  const isMasjidActive = pathname.startsWith('/masjid');
  const isKajianActive = pathname.startsWith('/peta');
  const isLiveActive = pathname.startsWith('/live');
  const isProfilActive =
    pathname.startsWith('/kontributor/profile') ||
    pathname.startsWith('/kontributor/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname === '/login';

  return (
    <nav
      className={`md:hidden fixed z-50 left-3 right-3 sm:left-6 sm:right-6 max-w-md mx-auto bottom-[calc(10px+env(safe-area-inset-bottom,0px))] transition-transform duration-300 font-geist ${className}`}
      aria-label="Navigasi Menu Mobile"
    >
      <div className="bg-surface/90 dark:bg-surface-container-low/90 backdrop-blur-xl border border-outline-variant/40 dark:border-white/10 rounded-full shadow-[0_10px_35px_rgba(0,0,0,0.14)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)] p-1.5 px-2 grid grid-cols-5 items-center gap-1">
        {/* 1. TAB BERANDA */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 ${
            isBerandaActive
              ? 'bg-emerald-600/10 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-2xs'
              : 'text-on-surface-variant/70 hover:text-on-surface font-medium hover:bg-surface-container/50'
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[20px] leading-none transition-transform"
              style={{ fontVariationSettings: isBerandaActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              home
            </span>
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Beranda
          </span>
        </Link>

        {/* 2. TAB MASJID (Ditukar ke posisi 2) */}
        <Link
          href="/masjid"
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 ${
            isMasjidActive
              ? 'bg-emerald-600/10 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-2xs'
              : 'text-on-surface-variant/70 hover:text-on-surface font-medium hover:bg-surface-container/50'
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[20px] leading-none transition-transform"
              style={{ fontVariationSettings: isMasjidActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              mosque
            </span>
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Masjid
          </span>
        </Link>

        {/* 3. TAB KAJIAN (DENGAN LOGO PETA KAJIAN) */}
        <Link
          href="/peta"
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 group ${
            isKajianActive
              ? 'bg-emerald-600/10 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-2xs'
              : 'text-on-surface-variant/70 hover:text-on-surface font-medium hover:bg-surface-container/50'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <img
              src="/logo.png?v=3"
              alt="Kajian"
              className={`w-[23px] h-[23px] rounded-md object-contain transition-all ${
                isKajianActive
                  ? 'scale-105 opacity-100'
                  : 'opacity-75 group-hover:opacity-100 grayscale-[0.2]'
              }`}
            />
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Kajian
          </span>
        </Link>

        {/* 4. TAB LIVE (TETAP MERAH + PING NOTIFIKASI) */}
        <Link
          href="/live"
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 ${
            isLiveActive
              ? 'bg-red-600/10 dark:bg-red-400/15 text-red-600 dark:text-red-400 font-black shadow-2xs'
              : 'text-red-600/90 dark:text-red-400/90 font-bold hover:bg-red-500/10'
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center relative shrink-0">
            <span
              className="material-symbols-outlined text-[20px] leading-none"
              style={{ fontVariationSettings: isLiveActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              smart_display
            </span>
            {hasActiveLiveStreams && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
            )}
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Live
          </span>
        </Link>

        {/* 5. TAB PROFIL / MASUK */}
        {currentUser ? (
          <Link
            href="/kontributor/profile"
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 ${
              isProfilActive
                ? 'bg-emerald-600/10 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-2xs'
                : 'text-on-surface-variant/70 hover:text-on-surface font-medium hover:bg-surface-container/50'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[20px] leading-none"
                style={{ fontVariationSettings: isProfilActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                account_circle
              </span>
            </div>
            <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
              Profil
            </span>
          </Link>
        ) : (
          <Link
            href="/login"
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 ${
              isProfilActive
                ? 'bg-emerald-600/10 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-2xs'
                : 'text-on-surface-variant/70 hover:text-on-surface font-medium hover:bg-surface-container/50'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[20px] leading-none"
                style={{ fontVariationSettings: isProfilActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                login
              </span>
            </div>
            <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
              Masuk
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}
