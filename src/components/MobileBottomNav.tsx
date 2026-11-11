'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useBottomNav } from '@/context/BottomNavContext';
import { useYoutubeChannelsQuery } from '@/lib/hooks/useYoutubeChannelsQuery';

interface MobileBottomNavProps {
  className?: string;
}

export default function MobileBottomNav({
  className = '',
}: MobileBottomNavProps) {
  const pathname = usePathname() || '/';
  const { isHidden, isDarkTheme } = useBottomNav();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);
  const { channels } = useYoutubeChannelsQuery();

  const hasActiveLive = useMemo(() => {
    if (!channels) return false;
    return channels.some((ch) => ch.is_currently_live && Boolean(ch.current_video_id));
  }, [channels]);

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

  const isPipRoute = pathname === '/live/pip' || pathname?.startsWith('/live/pip');

  // Urutan baru: 0: Beranda · 1: Kajian · 2: Live · 3: Masjid · 4: Profil
  const isBerandaActive = pathname === '/';
  const isKajianActive = pathname.startsWith('/peta');
  const isLiveActive = pathname.startsWith('/live') && !isPipRoute;
  const isMasjidActive = pathname.startsWith('/masjid');
  const isProfilActive =
    pathname.startsWith('/kontributor/profile') ||
    pathname.startsWith('/kontributor/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profile') ||
    pathname === '/login';

  const routeActiveIndex = useMemo(() => {
    if (isBerandaActive) return 0;
    if (isKajianActive) return 1;
    if (isLiveActive) return 2;
    if (isMasjidActive) return 3;
    if (isProfilActive) return 4;
    return 0;
  }, [isBerandaActive, isKajianActive, isLiveActive, isMasjidActive, isProfilActive]);

  // Reset optimistic index saat pathname sudah sinkron
  useEffect(() => {
    setOptimisticIndex(null);
  }, [pathname]);

  const isAllowedPage =
    !isPipRoute &&
    (pathname === '/' ||
      pathname.startsWith('/masjid') ||
      pathname.startsWith('/peta') ||
      pathname.startsWith('/live'));

  if (!isAllowedPage || isPipRoute) {
    return null;
  }

  const currentIndex = optimisticIndex !== null ? optimisticIndex : routeActiveIndex;

  const getTabClass = (index: number, isLiveTab = false) => {
    const isActive = currentIndex === index;
    if (isActive) {
      if (isLiveTab) return 'text-red-600 dark:text-red-400 font-bold';
      return isDarkTheme
        ? 'text-white font-bold'
        : 'text-[#126947] dark:text-emerald-300 font-bold';
    }
    if (isDarkTheme) {
      return 'text-white/65 hover:text-white font-medium';
    }
    return 'text-on-surface-variant hover:text-on-surface font-medium';
  };

  return (
    <nav
      className={`md:hidden fixed z-50 left-3 right-3 sm:left-6 sm:right-6 max-w-md mx-auto bottom-[calc(10px+env(safe-area-inset-bottom,0px))] transition-transform duration-300 font-sans ${
        isHidden ? 'translate-y-[150%] opacity-0 pointer-events-none' : 'pointer-events-auto'
      } ${className}`}
      aria-label="Navigasi Menu Mobile"
    >
      <div
        className={`relative backdrop-blur-2xl rounded-[26px] p-1.5 px-2 flex items-center transition-all duration-300 ${
          isDarkTheme
            ? 'bg-black/80 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.7)]'
            : 'bg-surface-container-lowest/95 border border-outline-variant/25 shadow-[0_8px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)]'
        }`}
      >
        {/* Sliding Active Pill Background */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-2xl pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-transform z-0"
          style={{
            left: '8px',
            width: 'calc((100% - 16px) / 5)',
            transform: `translateX(${currentIndex * 100}%)`,
          }}
        >
          <div
            className={`w-full h-full rounded-2xl transition-colors duration-300 ${
              isDarkTheme
                ? 'bg-white/15'
                : currentIndex === 2
                ? 'bg-red-500/12 dark:bg-red-500/20'
                : 'bg-[#dfece4] dark:bg-emerald-950/80'
            }`}
          />
        </div>

        {/* 1. TAB BERANDA */}
        <Link
          href="/"
          onClick={() => setOptimisticIndex(0)}
          className={`relative z-10 flex-1 min-h-[48px] flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${getTabClass(0)}`}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[22px] leading-none"
              style={{ fontVariationSettings: currentIndex === 0 ? "'FILL' 1" : "'FILL' 0" }}
            >
              home
            </span>
          </div>
          <span className="text-[12px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Beranda
          </span>
        </Link>

        {/* 2. TAB KAJIAN (Peta & Daftar) */}
        <Link
          href="/peta"
          onClick={() => setOptimisticIndex(1)}
          className={`relative z-10 flex-1 min-h-[48px] flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${getTabClass(1)}`}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[22px] leading-none"
              style={{ fontVariationSettings: currentIndex === 1 ? "'FILL' 1" : "'FILL' 0" }}
            >
              map
            </span>
          </div>
          <span className="text-[12px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Kajian
          </span>
        </Link>

        {/* 3. TAB LIVE (Titik pulse saat ada siaran) */}
        <Link
          href="/live"
          onClick={() => {
            setOptimisticIndex(2);
            try {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                ctx.resume().then(() => ctx.close());
              }
            } catch {}
            if (isLiveActive && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('peta-kajian:switch-to-swipe'));
            }
          }}
          className={`relative z-10 flex-1 min-h-[48px] flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${getTabClass(2, true)}`}
        >
          <div className="w-6 h-6 flex items-center justify-center relative shrink-0">
            <span
              className="material-symbols-outlined text-[22px] leading-none"
              style={{ fontVariationSettings: currentIndex === 2 ? "'FILL' 1" : "'FILL' 0" }}
            >
              smart_display
            </span>
            {hasActiveLive && (
              <span
                aria-label="Sedang siaran langsung"
                className="absolute -top-0.5 -right-1 flex h-2 w-2"
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
          </div>
          <span className="text-[12px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Live
          </span>
        </Link>

        {/* 4. TAB MASJID */}
        <Link
          href="/masjid"
          onClick={() => setOptimisticIndex(3)}
          className={`relative z-10 flex-1 min-h-[48px] flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${getTabClass(3)}`}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[22px] leading-none"
              style={{ fontVariationSettings: currentIndex === 3 ? "'FILL' 1" : "'FILL' 0" }}
            >
              mosque
            </span>
          </div>
          <span className="text-[12px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Masjid
          </span>
        </Link>

        {/* 5. TAB PROFIL */}
        <Link
          href={currentUser ? '/kontributor/profile' : '/login'}
          onClick={() => setOptimisticIndex(4)}
          className={`relative z-10 flex-1 min-h-[48px] flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${getTabClass(4)}`}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[22px] leading-none"
              style={{ fontVariationSettings: currentIndex === 4 ? "'FILL' 1" : "'FILL' 0" }}
            >
              person
            </span>
          </div>
          <span className="text-[12px] leading-tight tracking-tight whitespace-nowrap mt-0.5">
            Profil
          </span>
        </Link>
      </div>
    </nav>
  );
}
