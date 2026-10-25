'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePWAInstall } from '@/components/PWAInstallPrompt';

export interface MobileNavDrawerUser {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
}

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: MobileNavDrawerUser | null;
  isAdmin?: boolean;
  onOpenRequestContributor?: () => void;
}

export default function MobileNavDrawer({
  isOpen,
  onClose,
  currentUser,
  isAdmin = false,
  onOpenRequestContributor,
}: MobileNavDrawerProps) {
  const pathname = usePathname();
  const [avatarError, setAvatarError] = useState(false);
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();

  // Otomatis tutup drawer jika rute berpindah
  useEffect(() => {
    onClose();
  }, [pathname]);

  // Handle tombol ESC untuk menutup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Kunci scroll halaman belakang saat drawer terbuka
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isContributorOrAdmin = isAdmin || currentUser?.role === 'kontributor';

  const mainNavLinks = currentUser
    ? [
        { id: 'nav-home', href: '/', label: 'Beranda', icon: 'home', desc: 'Ringkasan & info terkini' },
        { id: 'nav-dzikir', href: '/dzikir', label: 'Dzikir Pagi & Petang', icon: 'wb_twilight', desc: 'Dzikir sunnah & tasbih digital' },
        { id: 'nav-map', href: '/peta', label: 'Peta Kajian', icon: 'map', desc: 'Jelajahi peta persebaran kajian' },
        { id: 'nav-masjid', href: '/masjid', label: 'Cari Masjid', icon: 'mosque', desc: 'Direktori & rute masjid terdekat' },
        { id: 'nav-live', href: '/live', label: 'Live Kajian', icon: 'smart_display', desc: 'Siaran langsung kajian Islam' },
        isContributorOrAdmin
          ? { id: 'nav-contribute', href: '/kontributor/dashboard', label: 'Kirim Info Kajian', icon: 'add_circle', desc: 'Bagikan info kajian baru' }
          : { id: 'nav-request-contributor', href: '/kontributor/profile?action=request', label: 'Ajukan Jadi Kontributor', icon: 'volunteer_activism', desc: 'Daftar sebagai relawan dakwah' },
        { id: 'nav-leaderboard', href: '/leaderboard', label: 'Papan Peringkat', icon: 'workspace_premium', desc: 'Leaderboard kontributor dakwah' },
        { id: 'nav-faq', href: '/faq', label: 'Pusat Bantuan & FAQ', icon: 'help', desc: 'Panduan penggunaan & tanya jawab' },
        {
          id: 'nav-profile',
          href: '/kontributor/profile',
          label: isContributorOrAdmin ? 'Profil Relawan' : 'Buku Saku Saya',
          icon: isContributorOrAdmin ? 'account_circle' : 'auto_stories',
          desc: isContributorOrAdmin ? 'Kelola akun & permohonan Anda' : 'Agenda tersimpan & riwayat majelis',
        },
      ]
    : [
        { id: 'nav-home', href: '/', label: 'Beranda', icon: 'home', desc: 'Ringkasan & info terkini' },
        { id: 'nav-dzikir', href: '/dzikir', label: 'Dzikir Pagi & Petang', icon: 'wb_twilight', desc: 'Dzikir sunnah & tasbih digital' },
        { id: 'nav-map', href: '/peta', label: 'Peta Kajian', icon: 'map', desc: 'Jelajahi peta persebaran kajian' },
        { id: 'nav-masjid', href: '/masjid', label: 'Cari Masjid', icon: 'mosque', desc: 'Direktori & rute masjid terdekat' },
        { id: 'nav-live', href: '/live', label: 'Live Kajian', icon: 'smart_display', desc: 'Siaran langsung kajian Islam' },
        { id: 'nav-leaderboard', href: '/leaderboard', label: 'Papan Peringkat', icon: 'workspace_premium', desc: 'Leaderboard kontributor dakwah' },
        { id: 'nav-faq', href: '/faq', label: 'Pusat Bantuan & FAQ', icon: 'help', desc: 'Panduan penggunaan & tanya jawab' },
      ];

  const adminNavLinks = [
    { id: 'admin-mod', href: '/admin', label: 'Moderasi Kajian', icon: 'fact_check', desc: 'Tinjau & setujui kiriman kajian' },
    { id: 'admin-users', href: '/admin/users', label: 'Kelola Relawan', icon: 'group', desc: 'Daftar pengguna & hak akses' },
    { id: 'admin-telegram', href: '/admin/telegram', label: 'Channel Telegram', icon: 'rss_feed', desc: 'Kelola sumber data scraper' },
    { id: 'admin-youtube', href: '/admin/youtube', label: 'YouTube Live Channels', icon: 'smart_display', desc: 'Kelola & pantau siaran live kajian' },
    { id: 'admin-cron', href: '/admin/cron', label: 'Status Otomatisasi (Cron)', icon: 'schedule', desc: 'Pantau scheduler background worker' },
  ];

  const userAvatar = currentUser?.avatarUrl || (currentUser as any)?.user_metadata?.avatar_url;
  const displayName = currentUser?.name || (currentUser as any)?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Relawan';

  return (
    <>
      {/* Backdrop Gelap dengan Blur */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Slide-over Drawer dari Kanan */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-[290px] sm:w-[320px] max-w-[85vw] bg-surface-container-lowest border-l border-surface-container-high/80 shadow-2xl flex flex-col transition-transform duration-300 ease-out font-geist md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Navigasi Menu Mobile"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-surface-container-high/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png?v=3"
              alt="Peta Kajian Logo"
              className="w-10 h-10 rounded-xl object-contain shrink-0"
            />
            <div>
              <span className="font-bold text-sm text-on-surface">Peta Kajian</span>
              <p className="text-[10px] text-outline leading-tight">Seluruh Indonesia</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Tutup menu"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* User Card (Jika login) */}
        {currentUser && (
          <div className="p-3 mx-3 mt-3 rounded-2xl bg-surface-container-low/70 border border-surface-container-high/60 flex items-center gap-3">
            <div className="relative shrink-0">
              {userAvatar && !avatarError ? (
                <img
                  src={userAvatar}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border border-surface-container-high"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-on-surface truncate">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[10px]">shield_person</span>
                    Admin
                  </span>
                ) : currentUser?.role === 'kontributor' ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[10px]">verified</span>
                    Relawan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[10px]">person</span>
                    Jamaah
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Buku Saku Jamaah Banner (Jika belum login) */}
        {!currentUser && (
          <div className="p-3.5 mx-3 mt-3 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/25 dark:border-primary/35 flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">auto_stories</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-on-surface">Buku Saku Penuntut Ilmu</h4>
                <p className="text-[10px] text-on-surface-variant leading-tight mt-0.5">
                  Simpan agenda kajian, catat riwayat majelis, & sinkronkan antar perangkat.
                </p>
              </div>
            </div>

            <Link
              href={pathname && pathname !== '/' ? `/login?next=${encodeURIComponent(pathname)}` : '/login'}
              onClick={() => {
                onClose();
                if (pathname && pathname !== '/') {
                  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
                  document.cookie = `peta_kajian_auth_next=${encodeURIComponent(pathname)}; path=/; max-age=600; SameSite=Lax${isHttps ? '; Secure' : ''}`;
                  try {
                    sessionStorage.setItem('peta_kajian_auth_next', pathname);
                    sessionStorage.setItem('peta_kajian_auth_in_progress', 'true');
                  } catch {}
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-2xs active:scale-95"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                className="w-3.5 h-3.5 bg-white rounded-full p-0.5 shrink-0"
                alt=""
              />
              <span>Masuk dengan Google</span>
            </Link>
          </div>
        )}

        {/* Navigation List Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Menu Khusus Admin (jika admin) */}
          {isAdmin && (
            <div>
              <p className="px-2 pb-1.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">security</span>
                Portal Admin
              </p>
              <div className="space-y-1">
                {adminNavLinks.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[18px] shrink-0 ${isActive ? 'text-white' : 'text-purple-600'}`}>
                        {item.icon}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{item.label}</span>
                        <span className={`text-[10px] font-normal truncate ${isActive ? 'text-purple-100' : 'text-outline'}`}>
                          {item.desc}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigasi Utama */}
          <div>
            <p className="px-2 pb-1.5 text-[10px] font-bold text-outline uppercase tracking-wider">
              Menu Utama
            </p>
            <div className="space-y-1">
              {mainNavLinks.map((item) => {
                const isActive = item.id === 'nav-request-contributor' ? false : pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[18px] shrink-0 ${isActive ? 'text-on-primary' : 'text-primary'}`}>
                      {item.icon}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.label}</span>
                      <span className={`text-[10px] font-normal truncate ${isActive ? 'text-primary-container' : 'text-outline'}`}>
                        {item.desc}
                      </span>
                    </div>
                  </Link>
                );
              })}

              {/* Tombol Install Aplikasi PWA */}
              {canInstall && !isInstalled && (
                <button
                  type="button"
                  onClick={() => {
                    promptInstall();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 mt-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-all text-left shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] shrink-0">
                    download_for_offline
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">Pasang Aplikasi</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white/20 text-white rounded-md shrink-0">
                        PWA
                      </span>
                    </div>
                    <span className="text-[10px] text-white/80 truncate font-normal">
                      Akses cepat di layar HP
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer: Logout / Login */}
        <div className="p-3 border-t border-surface-container-high/60 mt-auto bg-surface-container-low/40">
          {currentUser ? (
            <form action="/auth/signout" method="post" className="w-full">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>Keluar Akun</span>
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors shadow-2xs"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                className="w-3.5 h-3.5 bg-white rounded-full p-0.5 shrink-0"
                alt=""
              />
              <span>Masuk dengan Google</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
