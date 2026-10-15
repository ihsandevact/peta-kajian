'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin', label: 'Moderasi Kajian', icon: 'fact_check' },
    { href: '/admin/users', label: 'Kelola Relawan', icon: 'group' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[22px]">shield</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm sm:text-base text-on-surface">Peta Kajian</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-300">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-outline hidden sm:block">Portal Kurasi & Moderasi</p>
            </div>
          </Link>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">map</span>
            <span className="hidden md:inline">Buka Peta</span>
          </Link>

          <Link
            href="/kontributor/profile"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">person</span>
            <span className="hidden md:inline">Profil</span>
          </Link>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="p-1.5 rounded-full text-xs font-semibold text-error hover:bg-error/10 transition-colors"
              title="Keluar"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
