'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Drawer } from 'vaul';
import ThemeToggle from '@/components/ThemeToggle';
import { usePWAInstall } from '@/components/PWAInstallPrompt';

interface MoreMenuBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  isAdmin?: boolean;
  userRole?: string;
  onOpenRequestContributor?: () => void;
}

const DAILY_IBADAH_ITEMS = [
  {
    href: '/dzikir',
    label: 'Dzikir Pagi & Petang',
    desc: 'Hisnul Muslim & counter dzikir',
    icon: 'wb_twilight',
  },
  {
    href: '/doa',
    label: 'Doa Harian',
    desc: 'Kumpulan doa shahih harian',
    icon: 'menu_book',
  },
  {
    href: '/sifat-sholat',
    label: 'Panduan Sholat',
    desc: 'Tata cara sholat sesuai sunnah',
    icon: 'accessibility_new',
  },
  {
    href: '/sholat?tab=jadwal',
    label: 'Jadwal Sholat',
    desc: 'Waktu sholat standar Kemenag RI',
    icon: 'schedule',
  },
  {
    href: '/sholat?tab=kiblat',
    label: 'Arah Kiblat',
    desc: 'Kompas kiblat interaktif',
    icon: 'explore',
  },
  {
    href: '/kalender',
    label: 'Kalender & Puasa',
    desc: 'Penanggalan Hijriah & puasa sunnah',
    icon: 'calendar_month',
  },
];

export default function MoreMenuBottomSheet({
  isOpen,
  onClose,
  currentUser,
  isAdmin = false,
  userRole,
  onOpenRequestContributor,
}: MoreMenuBottomSheetProps) {
  const pathname = usePathname();
  const [avatarError, setAvatarError] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();

  // Deteksi ukuran layar desktop (md: >= 768px)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Handle tombol ESC untuk menutup di Desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen && isDesktop) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDesktop, onClose]);

  // Kunci scroll halaman belakang saat desktop drawer terbuka
  useEffect(() => {
    if (isOpen && isDesktop) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isDesktop]);

  const role = userRole || currentUser?.role;
  const isContributorOrAdmin = isAdmin || role === 'kontributor' || role === 'admin';
  const userAvatar = currentUser?.avatarUrl || currentUser?.user_metadata?.avatar_url;
  const displayName =
    currentUser?.name ||
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split('@')[0] ||
    'Jamaah';

  // Body content menu (dipakai bersama baik oleh Desktop Side Drawer maupun Mobile Bottom Sheet)
  const renderMenuContent = () => (
    <>
      {/* 1. KARTU USER / LOGIN BANNER */}
      {currentUser ? (
        <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex items-center gap-3">
          <div className="relative shrink-0">
            {userAvatar && !avatarError ? (
              <img
                src={userAvatar}
                alt=""
                className="w-11 h-11 rounded-full object-cover border-2 border-[#126947]/40"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#e4eee8] dark:bg-emerald-950 text-[#126947] dark:text-emerald-300 font-bold flex items-center justify-center text-sm border border-[#126947]/30">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface-container-low bg-[#126947]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="font-extrabold text-xs text-on-surface truncate">{displayName}</h4>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold tracking-wide uppercase bg-[#e4eee8] dark:bg-emerald-950/80 text-[#126947] dark:text-emerald-300">
                {isAdmin ? 'Admin' : role === 'kontributor' ? 'Relawan' : 'Jamaah'}
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
              {currentUser?.email || 'Akun Terverifikasi'}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#126947] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[19px]">person</span>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-on-surface">Masuk ke Peta Kajian</h4>
              <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">
                Simpan kajian, catat faidah majelis, dan sinkronisasi di seluruh perangkat Anda.
              </p>
            </div>
          </div>

          <Link
            href={pathname && pathname !== '/' ? `/login?next=${encodeURIComponent(pathname)}` : '/login'}
            onClick={onClose}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#126947] text-white text-xs font-bold hover:bg-[#0e5539] transition-all shadow-2xs active:scale-95"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              className="w-4 h-4 bg-white rounded-full p-0.5 shrink-0"
              alt=""
            />
            <span>Masuk dengan Google</span>
          </Link>
        </div>
      )}

      {/* 2. AMALAN & IBADAH HARIAN (Dilebur ke menu Semua sesuai struktur baru) */}
      <div className="space-y-2 pt-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant px-1">
          Amalan &amp; Ibadah Harian
        </span>

        <div className="grid grid-cols-2 gap-2">
          {DAILY_IBADAH_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/25 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-on-surface group-hover:text-[#126947] dark:group-hover:text-emerald-400 transition-colors truncate">
                  {item.label}
                </h4>
                <p className="text-[10px] text-on-surface-variant truncate">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 3. MENU FITUR PENUNTUT ILMU */}
      <div className="space-y-2 pt-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant px-1">
          Eksplorasi &amp; Komunitas
        </span>

        {/* Peta Kajian & Direktori Masjid */}
        <div className="space-y-1.5">
          <Link
            href="/artikel"
            onClick={onClose}
            className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/25 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[19px]">article</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-on-surface group-hover:text-[#126947] dark:group-hover:text-emerald-400 transition-colors truncate">
                  Artikel &amp; Faidah Islam
                </h4>
                <p className="text-[10px] text-on-surface-variant truncate">
                  Bacaan dakwah dari Muslim.or.id, Rumaysho, &amp; portal sunnah
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
              chevron_right
            </span>
          </Link>

          <Link
            href="/kontributor/profile"
            onClick={onClose}
            className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/25 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[19px]">auto_stories</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-on-surface group-hover:text-[#126947] dark:group-hover:text-emerald-400 transition-colors truncate">
                  Buku Saku Saya
                </h4>
                <p className="text-[10px] text-on-surface-variant truncate">
                  Agenda tersimpan, faedah ilmu &amp; riwayat hadir
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
              chevron_right
            </span>
          </Link>

          <Link
            href="/leaderboard"
            onClick={onClose}
            className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/25 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[19px]">workspace_premium</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-on-surface group-hover:text-[#126947] dark:group-hover:text-emerald-400 transition-colors truncate">
                  Papan Peringkat Relawan
                </h4>
                <p className="text-[10px] text-on-surface-variant truncate">
                  Apresiasi kontributor &amp; relawan penyebar dakwah
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
              chevron_right
            </span>
          </Link>

          {/* Kirim Info / Ajukan Jadi Relawan */}
          {isContributorOrAdmin ? (
            <Link
              href="/kontributor/dashboard"
              onClick={onClose}
              className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/25 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[19px]">add_circle</span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-on-surface group-hover:text-[#126947] dark:group-hover:text-emerald-400 transition-colors truncate">
                    Kirim Info Kajian Baru
                  </h4>
                  <p className="text-[10px] text-on-surface-variant truncate">
                    Dashboard publikasi &amp; kelola jadwal majelis
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
                chevron_right
              </span>
            </Link>
          ) : currentUser?.requestStatus === 'pending' ? (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
              <div className="w-9 h-9 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[19px]">hourglass_top</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-on-surface truncate">
                  Permohonan Relawan Dalam Proses
                </h4>
                <p className="text-[10px] text-on-surface-variant truncate">
                  Sedang ditinjau oleh tim administrator
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenRequestContributor) {
                  onOpenRequestContributor();
                }
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/25 transition-colors group text-left cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[19px]">volunteer_activism</span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-on-surface group-hover:text-[#126947] dark:group-hover:text-emerald-400 transition-colors truncate">
                    Ajukan Menjadi Relawan
                  </h4>
                  <p className="text-[10px] text-on-surface-variant truncate">
                    Bantu verifikasi &amp; update jadwal kajian daerah Anda
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
                chevron_right
              </span>
            </button>
          )}

          {/* Bantuan & FAQ */}
          <Link
            href="/faq"
            onClick={onClose}
            className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/25 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[19px]">help</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-on-surface group-hover:text-[#126947] dark:group-hover:text-emerald-400 transition-colors truncate">
                  Pusat Bantuan &amp; FAQ
                </h4>
                <p className="text-[10px] text-on-surface-variant truncate">
                  Panduan penggunaan &amp; tanya jawab umum
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
              chevron_right
            </span>
          </Link>
        </div>
      </div>

      {/* 4. PENGATURAN TEMA (DARK MODE SWITCH) */}
      <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#126947] dark:text-emerald-400">
              dark_mode
            </span>
            <span className="text-xs font-bold text-on-surface">Mode Tampilan</span>
          </div>
          <span className="text-[10px] text-on-surface-variant font-medium">Tema Aplikasi</span>
        </div>
        <ThemeToggle variant="segmented" className="w-full" />
      </div>

      {/* 5. MENU KHUSUS ADMIN (JIKA ADMIN) */}
      {isAdmin && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#126947] dark:text-emerald-400 px-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">security</span>
            Panel Khusus Admin
          </span>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/admin"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-[#126947] dark:text-emerald-400">fact_check</span>
              <span className="truncate">Moderasi</span>
            </Link>

            <Link
              href="/admin/users"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-[#126947] dark:text-emerald-400">group</span>
              <span className="truncate">Relawan</span>
            </Link>

            <Link
              href="/admin/telegram"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-[#126947] dark:text-emerald-400">rss_feed</span>
              <span className="truncate">Telegram</span>
            </Link>

            <Link
              href="/admin/youtube"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-[#126947] dark:text-emerald-400">smart_display</span>
              <span className="truncate">YouTube Live</span>
            </Link>

            <Link
              href="/admin/cron"
              onClick={onClose}
              className="col-span-2 p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-[#126947] dark:text-emerald-400">schedule</span>
              <span className="truncate">Status Otomatisasi (Cron Worker)</span>
            </Link>
          </div>
        </div>
      )}

      {/* 6. PASANG APLIKASI PWA (JIKA DIDUKUNG) */}
      {canInstall && !isInstalled && (
        <button
          type="button"
          onClick={() => {
            promptInstall();
            onClose();
          }}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#e4eee8]/70 dark:bg-emerald-950/40 border border-[#126947]/20 hover:bg-[#e4eee8] transition-all text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#126947] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-[#126947] dark:text-emerald-300">Pasang Aplikasi PWA</h4>
                <span className="px-1.5 py-0.2 rounded bg-[#126947] text-white text-[9px] font-black">
                  PWA
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant">
                Akses cepat langsung dari layar utama HP Anda
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-[16px] text-[#126947] dark:text-emerald-300 shrink-0">
            arrow_forward
          </span>
        </button>
      )}

      {/* 7. LOGOUT BUTTON (JIKA LOGIN) */}
      {currentUser && (
        <form action="/auth/signout" method="post" className="w-full pt-1">
          <button
            type="submit"
            className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50 transition-colors cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Keluar Akun</span>
          </button>
        </form>
      )}

      {/* Versi & Copyright */}
      <div className="text-center pt-1 text-[10px] text-outline">
        <p>Peta Kajian Indonesia &bull; Versi 2.1</p>
      </div>
    </>
  );

  // === TAMPILAN 1: DESKTOP (MODAL TENGAH) ===
  if (isDesktop) {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto font-geist flex items-center justify-center p-4 sm:p-6">
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          aria-hidden="true"
        />

        <div
          className="relative z-50 w-full max-w-lg lg:max-w-xl max-h-[85vh] bg-surface-container-lowest text-on-surface rounded-3xl border border-outline-variant/30 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Semua Menu & Fitur"
        >
          <div className="px-6 py-4 border-b border-outline-variant/25 flex items-center justify-between gap-3 shrink-0 bg-surface-container-lowest/90 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png?v=3"
                alt="Peta Kajian Logo"
                className="w-9 h-9 rounded-xl object-contain shrink-0"
              />
              <div>
                <span className="font-extrabold text-base text-on-surface">Semua Menu &amp; Fitur</span>
                <p className="text-[11px] text-on-surface-variant leading-none mt-0.5">Peta Kajian Indonesia</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
              aria-label="Tutup modal menu"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 overscroll-contain">
            {renderMenuContent()}
          </div>
        </div>
      </div>
    );
  }

  // === TAMPILAN 2: MOBILE (VAUL BOTTOM SHEET DARI BAWAH) ===
  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      dismissible={true}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300" />

        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[90dvh] bg-surface-container-lowest rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.2)] border-t border-outline-variant/30 focus:outline-none font-geist"
          aria-label="Menu Pilihan Lengkap"
        >
          <div className="w-full flex justify-center pt-3 pb-2 shrink-0 cursor-pointer touch-none">
            <Drawer.Handle className="w-12 h-1.5 rounded-full bg-outline/35 hover:bg-outline/60 transition-colors" />
          </div>

          <Drawer.Title className="sr-only">Semua Menu &amp; Fitur</Drawer.Title>
          <Drawer.Description className="sr-only">
            Eksplorasi amalan harian, buku saku, leaderboard, ajukan relawan, pusat bantuan, dan pengaturan tema.
          </Drawer.Description>

          <div className="px-5 pb-3 border-b border-outline-variant/25 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png?v=3"
                alt="Peta Kajian Logo"
                className="w-8 h-8 rounded-xl object-contain shrink-0"
              />
              <div>
                <span className="font-extrabold text-sm text-on-surface">Semua Menu &amp; Fitur</span>
                <p className="text-[10px] text-on-surface-variant leading-none">Peta Kajian Indonesia</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
              aria-label="Tutup menu"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain pb-[calc(40px+env(safe-area-inset-bottom,16px))]">
            {renderMenuContent()}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
