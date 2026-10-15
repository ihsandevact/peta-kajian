'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
}

export default function MobileNavDrawer({
  isOpen,
  onClose,
  currentUser,
  isAdmin = false,
}: MobileNavDrawerProps) {
  const pathname = usePathname();
  const [avatarError, setAvatarError] = useState(false);

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
        { href: '/', label: 'Peta Kajian', icon: 'map', desc: 'Jelajahi peta persebaran kajian' },
        isContributorOrAdmin
          ? { href: '/kontributor/dashboard', label: 'Kirim Info Kajian', icon: 'add_circle', desc: 'Bagikan info kajian baru' }
          : { href: '/kontributor/profile', label: 'Ajukan Jadi Kontributor', icon: 'volunteer_activism', desc: 'Daftar sebagai relawan dakwah' },
        { href: '/leaderboard', label: 'Papan Peringkat', icon: 'workspace_premium', desc: 'Leaderboard kontributor dakwah' },
        { href: '/kontributor/profile', label: isContributorOrAdmin ? 'Profil Relawan' : 'Profil Saya', icon: 'account_circle', desc: 'Kelola akun & permohonan Anda' },
      ]
    : [
        { href: '/', label: 'Peta Kajian', icon: 'map', desc: 'Jelajahi peta persebaran kajian' },
        { href: '/leaderboard', label: 'Papan Peringkat', icon: 'workspace_premium', desc: 'Leaderboard kontributor dakwah' },
      ];

  const adminNavLinks = [
    { href: '/admin', label: 'Moderasi Kajian', icon: 'fact_check', desc: 'Tinjau & setujui kiriman kajian' },
    { href: '/admin/users', label: 'Kelola Relawan', icon: 'group', desc: 'Daftar pengguna & hak akses' },
  ];

  const displayName = currentUser?.name || currentUser?.email?.split('@')[0] || 'Relawan';

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
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-[20px]">mosque</span>
            </div>
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
              {currentUser.avatarUrl && !avatarError ? (
                <img
                  src={currentUser.avatarUrl}
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
                      key={item.href}
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
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
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
              <span className="material-symbols-outlined text-[16px]">login</span>
              <span>Masuk / Login</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
