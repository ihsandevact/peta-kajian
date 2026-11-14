'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';

interface DesktopTopNavbarProps {
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onSearchSubmit?: (e: React.FormEvent) => void;
  searchPlaceholder?: string;
  onOpenNotifications?: () => void;
  hasNotificationBadge?: boolean;
  fullWidth?: boolean;
}

export default function DesktopTopNavbar({
  searchQuery: controlledQuery,
  onSearchChange: controlledOnChange,
  onSearchSubmit: controlledOnSubmit,
  searchPlaceholder = 'Cari kajian, ustadz, atau masjid...',
  onOpenNotifications,
  hasNotificationBadge = false,
  fullWidth = false,
}: DesktopTopNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Local state untuk uncontrolled search
  const [localQuery, setLocalQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const query = controlledQuery !== undefined ? controlledQuery : localQuery;
  const setQuery = controlledOnChange || setLocalQuery;

  // Cek user login
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleDefaultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (controlledOnSubmit) {
      controlledOnSubmit(e);
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) return;

    if (pathname.startsWith('/artikel')) {
      router.push(`/artikel?q=${encodeURIComponent(trimmed)}`);
    } else if (pathname.startsWith('/masjid')) {
      router.push(`/masjid?q=${encodeURIComponent(trimmed)}`);
    } else if (pathname.startsWith('/doa')) {
      router.push(`/doa?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push(`/peta?q=${encodeURIComponent(trimmed)}`);
    }
  };

  // Tentukan menu aktif
  const isBerandaActive = pathname === '/';
  const isKajianActive = pathname.startsWith('/peta');
  const isLiveActive = pathname.startsWith('/live');
  const isMasjidActive = pathname.startsWith('/masjid');
  const isArtikelActive = pathname.startsWith('/artikel');

  // Initial profil avatar
  const userName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split('@')[0] ||
    'Ihsan';
  const avatarInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="hidden lg:block sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/20 shadow-2xs transition-colors shrink-0">
      <div
        className={`${
          fullWidth ? 'w-full px-5 lg:px-7' : 'max-w-7xl mx-auto px-4 lg:px-6'
        } h-16 flex items-center justify-between gap-4`}
      >
        {/* Sisi Kiri: Brand Logo & 5 Nav Links */}
        <div className="flex items-center gap-7">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src="/logo.png?v=3"
              alt="Peta Kajian Logo"
              className="w-9 h-9 rounded-xl object-contain shadow-2xs group-hover:scale-105 transition-transform"
            />
            <span className="font-extrabold text-[17px] tracking-tight text-on-surface">
              Peta Kajian
            </span>
          </Link>

          {/* 5 Menu Utama */}
          <nav
            aria-label="Navigasi Utama Desktop"
            className="flex items-center gap-1 text-[13px] font-semibold text-on-surface-variant"
          >
            <Link
              href="/"
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                isBerandaActive
                  ? 'bg-[#e4eee8] text-[#126947] dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                  : 'hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              Beranda
            </Link>

            <Link
              href="/peta"
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                isKajianActive
                  ? 'bg-[#e4eee8] text-[#126947] dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                  : 'hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              Kajian
            </Link>

            <Link
              href="/live"
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                isLiveActive
                  ? 'bg-[#e4eee8] text-[#126947] dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                  : 'hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              <span>Live</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            </Link>

            <Link
              href="/masjid"
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                isMasjidActive
                  ? 'bg-[#e4eee8] text-[#126947] dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                  : 'hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              Masjid
            </Link>

            <Link
              href="/artikel"
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                isArtikelActive
                  ? 'bg-[#e4eee8] text-[#126947] dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                  : 'hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              Artikel
            </Link>
          </nav>
        </div>

        {/* Sisi Kanan: Search Input Desktop (lg+), Leaderboard/Relawan, Notif, Theme, User Avatar */}
        <div className="flex items-center gap-2.5">
          {/* Search Bar Terintegrasi Navbar (khusus lg+) */}
          <form
            onSubmit={handleDefaultSubmit}
            className="hidden lg:flex items-center relative w-60 xl:w-72"
          >
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/70 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-10 pl-9 pr-8 rounded-2xl bg-surface-container-low border border-outline-variant/25 focus:outline-none focus:border-[#126947] focus:ring-2 focus:ring-[#126947]/15 text-[13px] text-on-surface placeholder:text-on-surface-variant/70 transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                aria-label="Bersihkan pencarian"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            )}
          </form>

          {/* Pintasan Leaderboard Relawan */}
          <Link
            href="/leaderboard"
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              pathname.startsWith('/leaderboard')
                ? 'bg-[#e4eee8] text-[#126947] border-[#126947]/30 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/25 text-on-surface-variant hover:text-on-surface'
            }`}
            title="Leaderboard Relawan Dakwah"
            aria-label="Leaderboard Relawan Dakwah"
          >
            <span className="material-symbols-outlined text-[19px] text-amber-500">
              workspace_premium
            </span>
          </Link>

          {/* Tombol Notifikasi / Pengingat */}
          {onOpenNotifications ? (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative w-10 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/25 flex items-center justify-center text-on-surface transition-all cursor-pointer active:scale-95"
              title="Pengingat Sholat, Puasa & Lokasi"
              aria-label="Pengingat dan Lokasi"
            >
              <span className="material-symbols-outlined text-[19px]">notifications</span>
              {hasNotificationBadge && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#126947] dark:bg-emerald-400" />
              )}
            </button>
          ) : (
            <Link
              href="/sholat"
              className="relative w-10 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/25 flex items-center justify-center text-on-surface transition-all cursor-pointer active:scale-95"
              title="Jadwal Sholat & Pengingat"
              aria-label="Pengingat dan Lokasi"
            >
              <span className="material-symbols-outlined text-[19px]">notifications</span>
              {hasNotificationBadge && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#126947] dark:bg-emerald-400" />
              )}
            </Link>
          )}

          {/* Toggle Tema (Dark / Light) */}
          <ThemeToggle
            variant="icon"
            className="!w-10 !h-10 !rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/25"
          />

          {/* Avatar Profil Pengguna (Lingkaran Hijau) */}
          <Link
            href={currentUser ? '/kontributor/profile' : '/login'}
            className="w-10 h-10 rounded-full bg-[#126947] hover:bg-[#0e5237] text-white font-extrabold text-[15px] flex items-center justify-center shadow-2xs transition-colors shrink-0"
            title={currentUser ? `Profil: ${userName}` : 'Masuk ke Akun'}
          >
            {avatarInitial}
          </Link>
        </div>
      </div>
    </header>
  );
}
