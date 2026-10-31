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
        <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high/80 flex items-center gap-3">
          <div className="relative shrink-0">
            {userAvatar && !avatarError ? (
              <img
                src={userAvatar}
                alt=""
                className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500/40"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-sm border-2 border-emerald-500/40">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface-container-low ${
                isAdmin ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="font-extrabold text-xs text-on-surface truncate">{displayName}</h4>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold tracking-wide uppercase ${
                  isAdmin
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    : role === 'kontributor'
                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isAdmin ? 'Admin' : role === 'kontributor' ? 'Relawan' : 'Jamaah'}
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
              {currentUser?.email || 'Akun Terverifikasi'}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600/10 via-emerald-600/5 to-surface-container-low border border-emerald-500/20 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[18px]">account_circle</span>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-on-surface">Masuk ke Peta Kajian</h4>
              <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">
                Simpan kajian, catat faidah majelis, dan sinkronisasi di seluruh perangkat Anda.
              </p>
            </div>
          </div>

          <Link
            href={pathname && pathname !== '/' ? `/login?next=${encodeURIComponent(pathname)}` : '/login'}
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-xs active:scale-95"
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

      {/* 2. PENGATURAN TEMA (DARK MODE SWITCH) */}
      <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-container-high/60 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">
              dark_mode
            </span>
            <span className="text-xs font-bold text-on-surface">Mode Tampilan</span>
          </div>
          <span className="text-[10px] text-on-surface-variant font-medium">Tema Aplikasi</span>
        </div>
        <ThemeToggle variant="segmented" className="w-full" />
      </div>

      {/* 3. MENU FITUR PENUNTUT ILMU */}
      <div className="space-y-1.5 pt-0.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-outline px-1">
          Fitur Penuntut Ilmu
        </span>

        {/* Artikel & Faidah Islam */}
        <Link
          href="/artikel"
          onClick={onClose}
          className="flex items-center justify-between p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[18px]">article</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors truncate">
                  Artikel &amp; Faidah Islam
                </h4>
                <span className="px-1.5 py-0.2 rounded bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                  Sunnah
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant truncate">
                Bacaan dakwah dari Muslim.or.id, Rumaysho, &amp; portal sunnah
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
            chevron_right
          </span>
        </Link>

        {/* Buku Saku */}
        <Link
          href="/kontributor/profile"
          onClick={onClose}
          className="flex items-center justify-between p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[18px]">auto_stories</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors truncate">
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

        {/* Leaderboard */}
        <Link
          href="/leaderboard"
          onClick={onClose}
          className="flex items-center justify-between p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors truncate">
                Papan Peringkat (Leaderboard)
              </h4>
              <p className="text-[10px] text-on-surface-variant truncate">
                Peringkat kontributor &amp; relawan penyebar dakwah
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
            className="flex items-center justify-between p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors truncate">
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
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 truncate">
                Permohonan Relawan Dalam Proses
              </h4>
              <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 truncate">
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
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors group text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors truncate">
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
          className="flex items-center justify-between p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[18px]">help</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors truncate">
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

      {/* 4. MENU KHUSUS ADMIN (JIKA ADMIN) */}
      {isAdmin && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 px-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">security</span>
            Panel Khusus Admin
          </span>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/admin"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-on-surface flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-600">fact_check</span>
              <span className="truncate">Moderasi</span>
            </Link>

            <Link
              href="/admin/users"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-on-surface flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-600">group</span>
              <span className="truncate">Relawan</span>
            </Link>

            <Link
              href="/admin/telegram"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-on-surface flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-600">rss_feed</span>
              <span className="truncate">Telegram</span>
            </Link>

            <Link
              href="/admin/youtube"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-on-surface flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-600">smart_display</span>
              <span className="truncate">YouTube Live</span>
            </Link>

            <Link
              href="/admin/cron"
              onClick={onClose}
              className="col-span-2 p-2.5 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-on-surface flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-600">schedule</span>
              <span className="truncate">Status Otomatisasi (Cron Worker)</span>
            </Link>
          </div>
        </div>
      )}

      {/* 5. PASANG APLIKASI PWA (JIKA DIDUKUNG) */}
      {canInstall && !isInstalled && (
        <button
          type="button"
          onClick={() => {
            promptInstall();
            onClose();
          }}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-primary/10 border border-primary/25 hover:bg-primary/15 transition-all text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-primary">Pasang Aplikasi PWA</h4>
                <span className="px-1.5 py-0.2 rounded bg-primary text-white text-[9px] font-black">
                  PWA
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant">
                Akses cepat instan langsung dari layar utama HP Anda
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
            arrow_forward
          </span>
        </button>
      )}

      {/* 6. LOGOUT BUTTON (JIKA LOGIN) */}
      {currentUser && (
        <form action="/auth/signout" method="post" className="w-full pt-2">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 transition-colors shadow-2xs cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Keluar Akun</span>
          </button>
        </form>
      )}

      {/* Versi & Copyright */}
      <div className="text-center pt-2 text-[10px] text-outline">
        <p>Peta Kajian Indonesia &bull; Versi 2.0</p>
      </div>
    </>
  );

  // === TAMPILAN 1: DESKTOP (SIDEBAR DRAWER DARI KANAN) ===
  if (isDesktop) {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto font-geist flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop Gelap dengan Blur */}
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          aria-hidden="true"
        />

        {/* Modal Dialog di Tengah */}
        <div
          className="relative z-50 w-full max-w-lg lg:max-w-xl max-h-[85vh] bg-surface-container-lowest text-on-surface rounded-3xl border border-surface-container-high/80 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Menu & Fitur Lainnya"
        >
          {/* Header Bar Desktop */}
          <div className="px-6 py-4 border-b border-surface-container-high/60 flex items-center justify-between gap-3 shrink-0 bg-surface-container-lowest/90 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png?v=3"
                alt="Peta Kajian Logo"
                className="w-9 h-9 rounded-xl object-contain shrink-0"
              />
              <div>
                <span className="font-extrabold text-base text-on-surface">Menu &amp; Fitur Lainnya</span>
                <p className="text-[11px] text-on-surface-variant leading-none mt-0.5">Peta Kajian Indonesia</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer"
              aria-label="Tutup modal menu"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Scrollable Body Desktop */}
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
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[90dvh] bg-surface-container-lowest rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.2)] border-t border-surface-container-high/80 focus:outline-none font-geist"
          aria-label="Menu Pilihan Lengkap"
        >
          {/* Drag Handle */}
          <div className="w-full flex justify-center pt-3 pb-2 shrink-0 cursor-pointer touch-none">
            <Drawer.Handle className="w-12 h-1.5 rounded-full bg-outline/40 hover:bg-outline/60 transition-colors" />
          </div>

          <Drawer.Title className="sr-only">Menu Pilihan &amp; Pengaturan</Drawer.Title>
          <Drawer.Description className="sr-only">
            Eksplorasi fitur buku saku, leaderboard, ajukan relawan, pusat bantuan, dan pengaturan tema.
          </Drawer.Description>

          {/* Header Bar Mobile */}
          <div className="px-5 pb-3 border-b border-surface-container-high/60 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png?v=3"
                alt="Peta Kajian Logo"
                className="w-8 h-8 rounded-xl object-contain shrink-0"
              />
              <div>
                <span className="font-extrabold text-sm text-on-surface">Menu &amp; Fitur Lainnya</span>
                <p className="text-[10px] text-on-surface-variant leading-none">Peta Kajian Indonesia</p>
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

          {/* Scrollable Body Mobile */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain pb-[calc(40px+env(safe-area-inset-bottom,16px))]">
            {renderMenuContent()}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
