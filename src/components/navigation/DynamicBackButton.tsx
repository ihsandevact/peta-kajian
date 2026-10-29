'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface DynamicBackButtonProps {
  className?: string;
  fallbackHref?: string;
  defaultLabel?: string;
}

export default function DynamicBackButton({
  className = '',
  fallbackHref = '/',
  defaultLabel = 'Beranda',
}: DynamicBackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('pk_prev_pathname');
      if (stored && stored !== pathname) {
        setPrevPath(stored);
      }
    } catch {
      // Abaikan jika storage dibatasi
    }
  }, [pathname]);

  const getTargetLabels = () => {
    if (!prevPath || prevPath === '/') {
      return { desktop: 'Kembali ke Beranda', mobile: 'Beranda' };
    }
    if (prevPath.startsWith('/peta')) {
      return { desktop: 'Kembali ke Peta Kajian', mobile: 'Peta' };
    }
    if (prevPath.startsWith('/masjid')) {
      return { desktop: 'Kembali ke Direktori Masjid', mobile: 'Masjid' };
    }
    if (prevPath.startsWith('/live')) {
      return { desktop: 'Kembali ke Live Kajian', mobile: 'Live' };
    }
    if (prevPath.startsWith('/leaderboard')) {
      return { desktop: 'Kembali ke Leaderboard', mobile: 'Peringkat' };
    }
    if (prevPath.startsWith('/kontributor/profile')) {
      return { desktop: 'Kembali ke Profil', mobile: 'Profil' };
    }
    if (prevPath.startsWith('/kontributor/dashboard')) {
      return { desktop: 'Kembali ke Dasbor', mobile: 'Dasbor' };
    }
    if (prevPath.startsWith('/artikel')) {
      return { desktop: 'Kembali ke Artikel', mobile: 'Artikel' };
    }
    if (prevPath.startsWith('/doa')) {
      return { desktop: 'Kembali ke Doa Harian', mobile: 'Doa' };
    }
    if (prevPath.startsWith('/dzikir')) {
      return { desktop: 'Kembali ke Dzikir', mobile: 'Dzikir' };
    }
    if (prevPath.startsWith('/kalender')) {
      return { desktop: 'Kembali ke Kalender Hijriyah', mobile: 'Kalender' };
    }
    if (prevPath.startsWith('/sholat')) {
      return { desktop: 'Kembali ke Jadwal Sholat', mobile: 'Sholat' };
    }
    if (prevPath.startsWith('/sifat-sholat')) {
      return { desktop: 'Kembali ke Sifat Sholat', mobile: 'Sifat Sholat' };
    }
    if (prevPath.startsWith('/faq')) {
      return { desktop: 'Kembali ke Pusat Bantuan', mobile: 'FAQ' };
    }
    if (prevPath.startsWith('/admin')) {
      return { desktop: 'Kembali ke Dashboard Admin', mobile: 'Admin' };
    }
    return { desktop: `Kembali ke ${defaultLabel}`, mobile: defaultLabel };
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(prevPath || fallbackHref);
    }
  };

  const { desktop, mobile } = getTargetLabels();

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors py-1.5 px-2 rounded-lg hover:bg-surface-container shrink-0 cursor-pointer active:scale-95 ${className}`}
      title={desktop}
      aria-label={desktop}
    >
      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
      <span className="hidden sm:inline">{desktop}</span>
      <span className="sm:hidden text-[11px]">{mobile}</span>
    </button>
  );
}
