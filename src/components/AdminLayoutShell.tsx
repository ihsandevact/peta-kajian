'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MobileNavDrawer from '@/components/MobileNavDrawer';

interface AdminLayoutShellProps {
  children: React.ReactNode;
}

interface NavGroup {
  title: string;
  items: {
    href: string;
    label: string;
    icon: string;
    exact?: boolean;
  }[];
}

export default function AdminLayoutShell({ children }: AdminLayoutShellProps) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser({
          name: data.user.user_metadata?.full_name || null,
          email: data.user.email || null,
          avatarUrl: data.user.user_metadata?.avatar_url || null,
        });
      }
    });
  }, []);

  const navGroups: NavGroup[] = [
    {
      title: 'KURASI & KONTEN',
      items: [
        { href: '/admin', label: 'Moderasi Kajian', icon: 'fact_check', exact: true },
        { href: '/admin/masjid', label: 'Database Masjid', icon: 'mosque' },
        { href: '/admin/youtube', label: 'YouTube Live', icon: 'smart_display' },
        { href: '/admin/telegram', label: 'Channel Telegram', icon: 'rss_feed' },
      ],
    },
    {
      title: 'SISTEM & PENGGUNA',
      items: [
        { href: '/admin/users', label: 'Kelola Relawan', icon: 'group' },
        { href: '/admin/cron', label: 'Status Cron', icon: 'schedule' },
      ],
    },
  ];

  const displayName = currentUser?.name || currentUser?.email?.split('@')[0] || 'Administrator';
  const displayEmail = currentUser?.email || 'admin@petakajian.my.id';
  const initial = displayName.charAt(0).toUpperCase();

  const isLinkActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-surface font-geist text-on-surface flex flex-col md:flex-row">
      {/* ================= DESKTOP FIXED SIDEBAR (md: dan ke atas) ================= */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 bg-surface-container-lowest border-r border-surface-container-high/80 z-30 select-none">
        {/* Brand & Logo Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-surface-container-high/60 shrink-0">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png?v=3"
              alt="Peta Kajian Logo"
              className="w-9 h-9 rounded-xl object-contain shrink-0 group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-on-surface leading-none">Peta Kajian</span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-300">
                  Admin
                </span>
              </div>
              <span className="text-[10px] text-outline mt-0.5 leading-none">Portal Kurasi & Moderasi</span>
            </div>
          </Link>
        </div>

        {/* Scrollable Navigation Menu List */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6 no-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <span className="px-3 text-[10px] font-bold text-outline uppercase tracking-wider block">
                {group.title}
              </span>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const active = isLinkActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                      title={item.label}
                    >
                      <span className={`material-symbols-outlined text-[19px] shrink-0 ${active ? 'text-white' : 'text-outline group-hover:text-on-surface'}`}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}

          {/* Pintasan Cepat Web */}
          <div className="space-y-1.5 pt-2 border-t border-surface-container-high/50">
            <span className="px-3 text-[10px] font-bold text-outline uppercase tracking-wider block">
              PINTASAN APLIKASI
            </span>
            <nav className="space-y-1">
              <Link
                href="/"
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all group"
                title="Buka Peta Publik di Tab Saat Ini"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[19px] text-outline group-hover:text-primary">
                    map
                  </span>
                  <span>Peta Publik</span>
                </div>
                <span className="material-symbols-outlined text-[14px] text-outline opacity-70 group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              </Link>

              <Link
                href="/kontributor/profile"
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all group"
                title="Buka Profil Relawan"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[19px] text-outline">
                    person
                  </span>
                  <span>Profil Saya</span>
                </div>
                <span className="material-symbols-outlined text-[14px] text-outline opacity-70">
                  chevron_right
                </span>
              </Link>
            </nav>
          </div>
        </div>

        {/* Sidebar Footer: User Profile & Sign Out */}
        <div className="p-3 border-t border-surface-container-high/60 bg-surface-container-low/40 shrink-0">
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-surface-container-lowest border border-surface-container-high/60 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-surface-container-high"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-300 dark:border-purple-800">
                  {initial}
                </div>
              )}
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-xs font-bold text-on-surface truncate" title={displayName}>
                  {displayName}
                </span>
                <span className="text-[10px] text-outline truncate" title={displayEmail}>
                  {displayEmail}
                </span>
              </div>
            </div>

            <form action="/auth/signout" method="post" className="shrink-0">
              <button
                type="submit"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                title="Keluar (Sign Out)"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ================= MOBILE STICKY TOPBAR (< md:) ================= */}
      <header className="md:hidden sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60 h-14 flex items-center justify-between px-3 sm:px-4">
        <Link href="/admin" className="flex items-center gap-2">
          <img
            src="/logo.png?v=3"
            alt="Peta Kajian Logo"
            className="w-8 h-8 rounded-lg object-contain shrink-0"
          />
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-on-surface">Peta Kajian</span>
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-300">
              Admin
            </span>
          </div>
        </Link>

        {/* Hamburger Menu Mobile */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="w-9 h-9 rounded-xl bg-surface-container border border-surface-container-high flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer active:scale-95"
          aria-label="Buka Menu Navigasi"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
      </header>

      {/* ================= MAIN CONTENT WRAPPER ================= */}
      <div className="flex-1 min-w-0 md:pl-64 lg:pl-72 flex flex-col bg-surface">
        {children}
      </div>

      {/* Mobile Slide-over Drawer */}
      <MobileNavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={currentUser}
        isAdmin={true}
      />
    </div>
  );
}
