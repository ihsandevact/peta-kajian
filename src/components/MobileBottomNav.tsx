'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useBottomNav } from '@/context/BottomNavContext';

interface MobileBottomNavProps {
  className?: string;
}

export default function MobileBottomNav({
  className = '',
}: MobileBottomNavProps) {
  const pathname = usePathname() || '/';
  const { isHidden } = useBottomNav();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data?.user || null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isBerandaActive = pathname === '/';
  const isMasjidActive = pathname.startsWith('/masjid');
  const isKajianActive = pathname.startsWith('/peta');
  const isLiveActive = pathname.startsWith('/live');
  const isProfilActive =
    pathname.startsWith('/kontributor/profile') ||
    pathname.startsWith('/kontributor/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname === '/login';

  const routeActiveIndex = useMemo(() => {
    if (isBerandaActive) return 0;
    if (isMasjidActive) return 1;
    if (isKajianActive) return 2;
    if (isLiveActive) return 3;
    if (isProfilActive) return 4;
    return 0;
  }, [isBerandaActive, isMasjidActive, isKajianActive, isLiveActive, isProfilActive]);

  // Reset optimistic index saat pathname sudah sinkron
  useEffect(() => {
    setOptimisticIndex(null);
  }, [pathname]);

  const isAllowedPage =
    pathname === '/' ||
    pathname.startsWith('/masjid') ||
    pathname.startsWith('/peta') ||
    pathname.startsWith('/live');

  if (!isAllowedPage) {
    return null;
  }

  const currentIndex = optimisticIndex !== null ? optimisticIndex : routeActiveIndex;

  return (
    <nav
      className={`md:hidden fixed z-50 left-3 right-3 sm:left-6 sm:right-6 max-w-md mx-auto bottom-[calc(10px+env(safe-area-inset-bottom,0px))] transition-transform duration-300 font-geist ${
        isHidden ? 'translate-y-[150%] opacity-0 pointer-events-none' : ''
      } ${className}`}
      aria-label="Navigasi Menu Mobile"
    >
      <div className="relative bg-surface/90 dark:bg-surface-container-low/90 backdrop-blur-xl border border-outline-variant/40 dark:border-white/10 rounded-full shadow-[0_10px_35px_rgba(0,0,0,0.14)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)] p-1.5 px-2 flex items-center">
        {/* Sliding Active Pill Background (Meluncur halus antar tab) */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-full pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-transform z-0"
          style={{
            left: '8px',
            width: 'calc((100% - 16px) / 5)',
            transform: `translateX(${currentIndex * 100}%)`,
          }}
        >
          <div
            className={`w-full h-full rounded-full transition-colors duration-300 ${
              currentIndex === 3
                ? 'bg-red-600/12 dark:bg-red-400/20 ring-1 ring-red-500/25 shadow-2xs'
                : 'bg-emerald-600/12 dark:bg-emerald-400/20 ring-1 ring-emerald-500/25 shadow-2xs'
            }`}
          />
        </div>

        {/* 1. TAB BERANDA */}
        <Link
          href="/"
          onClick={() => setOptimisticIndex(0)}
          className={`relative z-10 flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 ${
            currentIndex === 0
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'text-on-surface-variant/70 hover:text-on-surface font-medium hover:bg-surface-container/30'
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <span
              className={`material-symbols-outlined text-[20px] leading-none transition-transform duration-200 ${
                currentIndex === 0 ? 'scale-105' : ''
              }`}
              style={{ fontVariationSettings: currentIndex === 0 ? "'FILL' 1" : "'FILL' 0" }}
            >
              home
            </span>
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Beranda
          </span>
        </Link>

        {/* 2. TAB MASJID */}
        <Link
          href="/masjid"
          onClick={() => setOptimisticIndex(1)}
          className={`relative z-10 flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 ${
            currentIndex === 1
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'text-on-surface-variant/70 hover:text-on-surface font-medium hover:bg-surface-container/30'
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <span
              className={`material-symbols-outlined text-[20px] leading-none transition-transform duration-200 ${
                currentIndex === 1 ? 'scale-105' : ''
              }`}
              style={{ fontVariationSettings: currentIndex === 1 ? "'FILL' 1" : "'FILL' 0" }}
            >
              mosque
            </span>
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Masjid
          </span>
        </Link>

        {/* 3. TAB KAJIAN */}
        <Link
          href="/peta"
          onClick={() => setOptimisticIndex(2)}
          className={`relative z-10 flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 group ${
            currentIndex === 2
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'text-on-surface-variant/70 hover:text-on-surface font-medium hover:bg-surface-container/30'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <img
              src="/logo.png?v=3"
              alt="Kajian"
              className={`w-[23px] h-[23px] rounded-md object-contain transition-all duration-200 ${
                currentIndex === 2
                  ? 'scale-110 opacity-100'
                  : 'opacity-75 group-hover:opacity-100 grayscale-[0.2]'
              }`}
            />
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Kajian
          </span>
        </Link>

        {/* 4. TAB LIVE */}
        <Link
          href="/live"
          onClick={() => setOptimisticIndex(3)}
          className={`relative z-10 flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 ${
            currentIndex === 3
              ? 'text-red-600 dark:text-red-400 font-black'
              : 'text-red-600/90 dark:text-red-400/90 font-bold hover:bg-red-500/10'
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center relative shrink-0">
            <span
              className={`material-symbols-outlined text-[20px] leading-none transition-transform duration-200 ${
                currentIndex === 3 ? 'scale-105' : ''
              }`}
              style={{ fontVariationSettings: currentIndex === 3 ? "'FILL' 1" : "'FILL' 0" }}
            >
              smart_display
            </span>
          </div>
          <span className="text-[10px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Live
          </span>
        </Link>

        {/* 5. TAB PROFIL / MASUK */}
        {currentUser ? (
          <Link
            href="/kontributor/profile"
            onClick={() => setOptimisticIndex(4)}
            className={`relative z-10 flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 ${
              currentIndex === 4
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'text-on-surface-variant/70 hover:text-on-surface font-medium hover:bg-surface-container/30'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <span
                className={`material-symbols-outlined text-[20px] leading-none transition-transform duration-200 ${
                  currentIndex === 4 ? 'scale-105' : ''
                }`}
                style={{ fontVariationSettings: currentIndex === 4 ? "'FILL' 1" : "'FILL' 0" }}
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
            onClick={() => setOptimisticIndex(4)}
            className={`relative z-10 flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 ${
              currentIndex === 4
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'text-on-surface-variant/70 hover:text-on-surface font-medium hover:bg-surface-container/30'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <span
                className={`material-symbols-outlined text-[20px] leading-none transition-transform duration-200 ${
                  currentIndex === 4 ? 'scale-105' : ''
                }`}
                style={{ fontVariationSettings: currentIndex === 4 ? "'FILL' 1" : "'FILL' 0" }}
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
