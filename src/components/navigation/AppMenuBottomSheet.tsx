'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Drawer } from 'vaul';

export interface AppMenuUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  requestStatus?: string | null;
}

interface AppMenuBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: AppMenuUser | null;
  isAdmin?: boolean;
  onOpenRequestContributor?: () => void;
  onOpenProposeTelegram?: () => void;
}

export default function AppMenuBottomSheet({
  isOpen,
  onClose,
  currentUser,
  isAdmin = false,
  onOpenRequestContributor,
  onOpenProposeTelegram,
}: AppMenuBottomSheetProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const displayName =
    currentUser?.name ||
    currentUser?.email?.split('@')[0] ||
    'Tamu';

  const isContributorOrAdmin = isAdmin || currentUser?.role === 'kontributor';

  const handleCopyId = async () => {
    if (!currentUser?.id) return;
    try {
      await navigator.clipboard.writeText(currentUser.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      console.error('Gagal menyalin ID Pengguna');
    }
  };

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
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[88dvh] bg-surface-container-lowest rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.25)] border-t border-surface-container-high/80 focus:outline-none font-geist text-on-surface"
          aria-label="Menu Aplikasi & Navigasi"
        >
          {/* Drag Handle */}
          <div className="w-full flex justify-center pt-3 pb-2 shrink-0 cursor-pointer touch-none">
            <Drawer.Handle className="w-12 h-1.5 rounded-full bg-outline/40 hover:bg-outline/60 transition-colors" />
          </div>

          <Drawer.Title className="sr-only">Navigasi &amp; Pengaturan Menu</Drawer.Title>
          <Drawer.Description className="sr-only">
            Menu navigasi cepat, aksi kontributor dakwah, pusat bantuan, dan pengaturan akun.
          </Drawer.Description>

          {/* Header Bar */}
          <div className="px-5 pb-3.5 border-b border-surface-container-high/60 flex items-center justify-between gap-3 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  {currentUser?.avatarUrl && !avatarError ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/40"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-extrabold text-base">
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-extrabold text-sm text-on-surface truncate">
                      {displayName}
                    </h3>
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[11px]">shield_person</span>
                        Admin
                      </span>
                    ) : currentUser?.role === 'kontributor' ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[11px]">verified</span>
                        Relawan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-blue-700 dark:text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[11px]">person</span>
                        Jamaah
                      </span>
                    )}
                  </div>
                  {currentUser?.email && (
                    <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                      {currentUser.email}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src="/logo.png?v=3"
                  alt="Peta Kajian Logo"
                  className="w-9 h-9 rounded-xl object-contain shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-on-surface truncate">
                    Peta Kajian Indonesia
                  </h3>
                  <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                    Platform Jadwal Kajian &amp; Direktori Masjid
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer shrink-0"
              aria-label="Tutup menu"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Scrollable Menu Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain pb-[calc(24px+env(safe-area-inset-bottom,16px))]">
            {/* 1. SEKSI NAVIGASI UTAMA APLIKASI */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-outline px-1">
                Navigasi Utama
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/"
                  onClick={onClose}
                  className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-all group active:scale-98"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">home</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors block truncate">
                      Beranda
                    </span>
                    <span className="text-[10px] text-on-surface-variant block truncate">
                      Halaman Depan
                    </span>
                  </div>
                </Link>

                <Link
                  href="/peta"
                  onClick={onClose}
                  className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-all group active:scale-98"
                >
                  <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">map</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors block truncate">
                      Peta Kajian
                    </span>
                    <span className="text-[10px] text-on-surface-variant block truncate">
                      Jadwal &amp; Lokasi
                    </span>
                  </div>
                </Link>

                <Link
                  href="/masjid"
                  onClick={onClose}
                  className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-all group active:scale-98"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">mosque</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors block truncate">
                      Cari Masjid
                    </span>
                    <span className="text-[10px] text-on-surface-variant block truncate">
                      Direktori Masjid
                    </span>
                  </div>
                </Link>

                <Link
                  href="/live"
                  onClick={onClose}
                  className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-all group active:scale-98"
                >
                  <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">smart_display</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 block truncate">
                      Live Kajian
                    </span>
                    <span className="text-[10px] text-on-surface-variant block truncate">
                      Siaran Langsung
                    </span>
                  </div>
                </Link>
              </div>

              {/* Leaderboard */}
              <Link
                href="/leaderboard"
                onClick={onClose}
                className="flex items-center justify-between p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors group mt-1"
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
                      Peringkat kontributor &amp; relawan dakwah
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
                  chevron_right
                </span>
              </Link>
            </div>

            {/* 2. SEKSI AKSI KONTRIBUSI & DAKWAH */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-outline px-1">
                Kontribusi &amp; Relawan
              </span>

              {/* Portal Admin (Khusus Admin) */}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 truncate">
                        Portal Admin
                      </h4>
                      <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 truncate">
                        Moderasi kajian, kelola relawan &amp; scraper
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0">
                    chevron_right
                  </span>
                </Link>
              )}

              {/* Kirim Kajian (Jika Kontributor / Admin) */}
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
                        Dasbor publikasi &amp; jadwal majelis
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
                    onOpenRequestContributor?.();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors truncate">
                        Ajukan Jadi Kontributor
                      </h4>
                      <p className="text-[10px] text-on-surface-variant truncate">
                        Gabung relawan publikasi kajian dakwah
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
                    chevron_right
                  </span>
                </button>
              )}

              {/* Daftarkan Channel Telegram */}
              {onOpenProposeTelegram && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenProposeTelegram();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-[18px]">send</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-on-surface group-hover:text-emerald-600 transition-colors truncate">
                        Daftarkan Channel Telegram
                      </h4>
                      <p className="text-[10px] text-on-surface-variant truncate">
                        Usulkan kanal info kajian untuk otomatisasi bot
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
                    chevron_right
                  </span>
                </button>
              )}
            </div>

            {/* 3. SEKSI BANTUAN */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-outline px-1">
                Informasi &amp; Bantuan
              </span>
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
                      Panduan penggunaan, fitur &amp; kontak
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
                  chevron_right
                </span>
              </Link>
            </div>

            {/* 4. SEKSI AKUN & SESI */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-outline px-1">
                Akun &amp; Sesi
              </span>

              {currentUser ? (
                <>
                  {/* Salin ID Pengguna */}
                  {currentUser?.id && (
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors group cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">
                            {copiedId ? 'check' : 'content_copy'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-on-surface truncate">
                            {copiedId ? 'ID Pengguna Berhasil Disalin!' : 'Salin ID Pengguna'}
                          </h4>
                          <p className="text-[10px] font-mono text-on-surface-variant truncate">
                            {currentUser.id}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors shrink-0 ${
                          copiedId
                            ? 'bg-emerald-600 text-white'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {copiedId ? 'Tersalin' : 'Salin'}
                      </span>
                    </button>
                  )}

                  {/* Form Logout */}
                  <form action="/auth/signout" method="post" className="w-full pt-1">
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/25 text-red-600 dark:text-red-400 text-xs font-extrabold transition-all cursor-pointer active:scale-98"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      <span>Keluar Akun</span>
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-all shadow-xs active:scale-98"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  <span>Masuk / Login Akun</span>
                </Link>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
