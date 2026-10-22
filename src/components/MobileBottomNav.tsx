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
      className={`md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-container-lowest/95 backdrop-blur-lg shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom,0px)] border-t border-surface-container-high/60 transition-transform duration-300 font-geist ${className}`}
      aria-label="Navigasi Menu Mobile"
    >
      <div className="grid grid-cols-5 items-end h-16 px-1.5 pb-1.5 relative">
        {/* 1. TAB BERANDA */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-end h-12 gap-0.5 transition-colors relative ${
            isBerandaActive
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'text-on-surface-variant/70 hover:text-on-surface font-medium'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[22px] leading-none transition-transform"
              style={{ fontVariationSettings: isBerandaActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              home
            </span>
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap">
            Beranda
          </span>
          {isBerandaActive && (
            <span className="w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-0.5" />
          )}
        </Link>

        {/* 2. TAB MASJID (Ditukar ke posisi 2) */}
        <Link
          href="/masjid"
          className={`flex flex-col items-center justify-end h-12 gap-0.5 transition-colors relative ${
            isMasjidActive
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'text-on-surface-variant/70 hover:text-on-surface font-medium'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[22px] leading-none transition-transform"
              style={{ fontVariationSettings: isMasjidActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              mosque
            </span>
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap">
            Masjid
          </span>
          {isMasjidActive && (
            <span className="w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-0.5" />
          )}
        </Link>

        {/* 3. TAB KAJIAN (DENGAN LOGO PETA KAJIAN) */}
        <Link
          href="/peta"
          className={`flex flex-col items-center justify-end h-12 gap-0.5 transition-colors relative group ${
            isKajianActive
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'text-on-surface-variant/70 hover:text-on-surface font-medium'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <img
              src="/logo.png?v=3"
              alt="Kajian"
              className={`w-[22px] h-[22px] rounded-md object-contain transition-all ${
                isKajianActive
                  ? 'ring-2 ring-emerald-500 scale-105 shadow-xs'
                  : 'opacity-75 group-hover:opacity-100 grayscale-[0.2]'
              }`}
            />
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap">
            Kajian
          </span>
          {isKajianActive && (
            <span className="w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-0.5" />
          )}
        </Link>

        {/* 4. TAB LIVE (TETAP MERAH + PING NOTIFIKASI) */}
        <Link
          href="/live"
          className={`flex flex-col items-center justify-end h-12 gap-0.5 text-red-600 dark:text-red-400 hover:text-red-700 transition-colors relative ${
            isLiveActive ? 'font-black' : 'font-bold'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center relative shrink-0">
            <span
              className="material-symbols-outlined text-[22px] leading-none"
              style={{ fontVariationSettings: isLiveActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              smart_display
            </span>
            {hasActiveLiveStreams && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-600 animate-ping" />
            )}
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap">
            Live
          </span>
          {isLiveActive && (
            <span className="w-1 h-1 rounded-full bg-red-600 mt-0.5" />
          )}
        </Link>

        {/* 5. TAB PROFIL / MASUK */}
        {currentUser ? (
          <Link
            href="/kontributor/profile"
            className={`flex flex-col items-center justify-end h-12 gap-0.5 transition-colors relative ${
              isProfilActive
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'text-on-surface-variant/70 hover:text-on-surface font-medium'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[22px] leading-none"
                style={{ fontVariationSettings: isProfilActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                account_circle
              </span>
            </div>
            <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap">
              Profil
            </span>
            {isProfilActive && (
              <span className="w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-0.5" />
            )}
          </Link>
        ) : (
          <Link
            href="/login"
            className={`flex flex-col items-center justify-end h-12 gap-0.5 transition-colors relative ${
              isProfilActive
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'text-on-surface-variant/70 hover:text-on-surface font-medium'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[22px] leading-none"
                style={{ fontVariationSettings: isProfilActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                login
              </span>
            </div>
            <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap">
              Masuk
            </span>
            {isProfilActive && (
              <span className="w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-0.5" />
            )}
          </Link>
        )}
      </div>
    </nav>
  );
}
