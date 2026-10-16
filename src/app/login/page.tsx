'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const handleLogin = async () => {
    setLoading(true);
    const supabase = createClient();

    // Callback URL dengan parameter 'next'
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (next && next !== '/') {
      callbackUrl.searchParams.set('next', next);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      console.error('Error logging in:', error.message);
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
        <p className="text-xs sm:text-sm text-on-surface-variant mb-8 leading-relaxed">
          Simpan jadwal kajian favorit Anda, tandai kehadiran di majelis ilmu, atau berkontribusi menyiarkan dakwah ke seluruh Indonesia.
        </p>

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
