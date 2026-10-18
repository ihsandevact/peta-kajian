'use client';

import React, { useEffect, useState } from 'react';
import { useTheme, type Theme } from '@/context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'icon' | 'segmented';
  className?: string;
}

export default function ThemeToggle({
  variant = 'icon',
  className = '',
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (variant === 'segmented') {
      return (
        <div className={`flex items-center p-1 rounded-xl bg-surface-container border border-surface-container-high/60 ${className}`}>
          <div className="flex-1 py-1 px-2 text-center text-xs opacity-50 font-medium">Terang</div>
          <div className="flex-1 py-1 px-2 text-center text-xs opacity-50 font-medium">Gelap</div>
          <div className="flex-1 py-1 px-2 text-center text-xs opacity-50 font-medium">Sistem</div>
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled
        className={`w-8 h-8 rounded-xl flex items-center justify-center text-outline opacity-50 ${className}`}
        aria-label="Memuat tema..."
      >
        <span className="material-symbols-outlined text-[18px]">routine</span>
      </button>
    );
  }

  // 1. Varian Segmented: 3 Pilihan Tombol (Terang, Gelap, Sistem)
  if (variant === 'segmented') {
    const options: { id: Theme; label: string; icon: string }[] = [
      { id: 'light', label: 'Terang', icon: 'light_mode' },
      { id: 'dark', label: 'Gelap', icon: 'dark_mode' },
      { id: 'system', label: 'Sistem', icon: 'settings_brightness' },
    ];

    return (
      <div
        className={`flex items-center p-1 rounded-xl bg-surface-container border border-surface-container-high/60 ${className}`}
        role="group"
        aria-label="Pilih Mode Tema"
      >
        {options.map((opt) => {
          const isActive = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-surface-container-lowest text-primary dark:text-emerald-400 shadow-2xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // 2. Varian Ikon: Tombol Putar Halus (Matahari <-> Bulan)
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative w-8 h-8 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-transparent hover:border-surface-container-high/60 transition-all cursor-pointer active:scale-95 group ${className}`}
      title={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
      aria-label={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
    >
      <span
        className={`material-symbols-outlined text-[19px] transition-transform duration-300 ${
          isDark
            ? 'text-amber-400 group-hover:rotate-45'
            : 'text-indigo-600 dark:text-indigo-400 group-hover:-rotate-12'
        }`}
      >
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
}
