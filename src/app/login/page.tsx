'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  // Simpan tujuan return URL di cookie & sessionStorage saat halaman login dimuat
  useEffect(() => {
    if (next && next !== '/' && next.startsWith('/') && !next.startsWith('//')) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      document.cookie = `peta_kajian_auth_next=${encodeURIComponent(next)}; path=/; max-age=600; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      try {
        sessionStorage.setItem('peta_kajian_auth_next', next);
      } catch {}
    }
  }, [next]);

  const handleLogin = async () => {
    setLoading(true);
    const supabase = createClient();

    // Tandai proses login sedang berjalan dan pastikan return URL tersimpan
    if (next && next !== '/' && next.startsWith('/') && !next.startsWith('//')) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      document.cookie = `peta_kajian_auth_next=${encodeURIComponent(next)}; path=/; max-age=600; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      try {
        sessionStorage.setItem('peta_kajian_auth_next', next);
        sessionStorage.setItem('peta_kajian_auth_in_progress', 'true');
      } catch {}
    }

    // Callback URL bersih tanpa searchParams agar cocok 100% dengan whitelist redirect URL di Supabase Dashboard
    const callbackUrl = new URL('/auth/callback', window.location.origin);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      console.error('Error logging in:', error.message);
      try {
        sessionStorage.removeItem('peta_kajian_auth_in_progress');
      } catch {}
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface font-geist text-on-surface flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="max-w-md w-full bg-surface-container-lowest rounded-3xl p-6 sm:p-8 shadow-xl border border-surface-container-high/60 text-center relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Logo */}
        <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
          <img
            src="/logo.png?v=3"
            alt="Peta Kajian Logo"
            className="w-full h-full object-contain drop-shadow-sm"
          />
        </div>

        <h1 className="text-2xl font-bold text-on-surface mb-2 tracking-tight">
          Masuk ke Peta Kajian
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mb-5 leading-relaxed">
          Simpan jadwal kajian favorit Anda, tandai kehadiran di majelis ilmu, atau berkontribusi menyiarkan dakwah ke seluruh Indonesia.
        </p>

        {/* 3 Value Badges */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="p-2.5 rounded-2xl bg-surface-container-low/80 border border-surface-container-high/60 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-[20px] text-amber-500 mb-1">bookmark</span>
            <span className="text-[11px] font-bold text-on-surface leading-tight">Simpan Cloud</span>
            <span className="text-[9px] text-outline leading-tight mt-0.5">Jadwal anti hilang</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-surface-container-low/80 border border-surface-container-high/60 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-[20px] text-emerald-600 dark:text-emerald-400 mb-1">how_to_reg</span>
            <span className="text-[11px] font-bold text-on-surface leading-tight">Jejak Majelis</span>
            <span className="text-[9px] text-outline leading-tight mt-0.5">Riwayat kehadiran</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-surface-container-low/80 border border-surface-container-high/60 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-[20px] text-primary mb-1">notifications_active</span>
            <span className="text-[11px] font-bold text-on-surface leading-tight">Pengingat H-2</span>
            <span className="text-[9px] text-outline leading-tight mt-0.5">Alarm otomatis</span>
          </div>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full h-12 bg-surface-container flex items-center justify-center gap-3 rounded-full hover:bg-surface-container-high transition-all border border-outline-variant disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            className="w-5 h-5"
            alt="Google Logo"
          />
          <span className="font-semibold text-on-surface text-sm">
            {loading ? 'Menghubungkan ke Google...' : 'Lanjutkan dengan Google'}
          </span>
        </button>

        <p className="text-[11px] text-outline mt-6">
          Terbuka untuk seluruh jamaah dan relawan majelis ilmu di seluruh nusantara.
        </p>

        {/* Back Link */}
        <div className="pt-4 mt-6 border-t border-surface-container-high/50">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Kembali ke Peta Kajian</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
