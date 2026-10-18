'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { setPendingStudySession, type PendingStudySession } from '@/utils/studyNotes';

interface StudyLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingSession: PendingStudySession | null;
}

export default function StudyLoginModal({
  isOpen,
  onClose,
  pendingSession,
}: StudyLoginModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !pendingSession) return null;

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      // Simpan session kajian yang ingin dibuka ke sessionStorage
      setPendingStudySession(pendingSession);

      const currentPath = window.location.pathname + window.location.search;
      if (currentPath && currentPath !== '/' && currentPath.startsWith('/') && !currentPath.startsWith('//')) {
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        document.cookie = `peta_kajian_auth_next=${encodeURIComponent(currentPath)}; path=/; max-age=600; SameSite=Lax${isHttps ? '; Secure' : ''}`;
        try {
          sessionStorage.setItem('peta_kajian_auth_next', currentPath);
          sessionStorage.setItem('peta_kajian_auth_in_progress', 'true');
        } catch {}
      }

      const supabase = createClient();
      // Callback URL bersih tanpa searchParams agar cocok 100% dengan whitelist redirect URL di Supabase Dashboard
      const callbackUrl = new URL('/auth/callback', window.location.origin);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        console.error('Login error:', error.message);
        try {
          sessionStorage.removeItem('peta_kajian_auth_in_progress');
        } catch {}
        setLoading(false);
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      try {
        sessionStorage.removeItem('peta_kajian_auth_in_progress');
      } catch {}
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-3xl bg-surface-container-lowest dark:bg-neutral-900 border border-surface-container-high/80 dark:border-neutral-800 p-6 sm:p-7 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tombol Tutup Silang */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
          title="Tutup dialog"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Ikon Header */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/20 ring-4 ring-emerald-500/10">
          <span className="material-symbols-outlined text-[32px]">edit_note</span>
        </div>

        {/* Hadits / Quote */}
        <p className="text-[11px] font-arabic text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
          قَيِّدُوا الْعِلْمَ بِالْكِتَابِ
        </p>
        <p className="text-[10px] text-outline italic mb-3">
          &ldquo;Ikatlah ilmu dengan menuliskannya&rdquo;
        </p>

        <h3 className="text-lg sm:text-xl font-extrabold text-on-surface tracking-tight">
          Buka Mode Belajar
        </h3>
        <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed max-w-xs mx-auto">
          Simak kajian sambil mencatat faidah penting langsung dalam satu layar terpadu tanpa distraksi.
        </p>

        {/* Info Kajian Target */}
        <div className="mt-4 p-3 rounded-2xl bg-surface-container-low dark:bg-neutral-800/60 border border-surface-container-high/60 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Kajian yang akan dipelajari:
          </span>
          <h4 className="text-xs font-bold text-on-surface line-clamp-1 mt-0.5">
            {pendingSession.title}
          </h4>
          {pendingSession.speakerName && (
            <p className="text-[11px] text-outline mt-0.5">{pendingSession.speakerName}</p>
          )}
        </div>

        {/* 3 Keuntungan Eksklusif Akun */}
        <div className="grid grid-cols-3 gap-2 mt-4 text-left">
          <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high/60">
            <span className="material-symbols-outlined text-[17px] text-emerald-600 mb-0.5 block">
              cloud_done
            </span>
            <strong className="text-[11px] text-on-surface block leading-tight">Auto-Save</strong>
            <span className="text-[9px] text-outline leading-tight block mt-0.5">Aman di cloud</span>
          </div>

          <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high/60">
            <span className="material-symbols-outlined text-[17px] text-amber-500 mb-0.5 block">
              schedule
            </span>
            <strong className="text-[11px] text-on-surface block leading-tight">Stempel Jam</strong>
            <span className="text-[9px] text-outline leading-tight block mt-0.5">Poin tertata</span>
          </div>

          <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high/60">
            <span className="material-symbols-outlined text-[17px] text-teal-600 mb-0.5 block">
              share
            </span>
            <strong className="text-[11px] text-on-surface block leading-tight">Format WA</strong>
            <span className="text-[9px] text-outline leading-tight block mt-0.5">Siap bagikan</span>
          </div>
        </div>

        {/* Tombol Login Google */}
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-neutral-800 text-slate-800 dark:text-white border border-slate-200 dark:border-neutral-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-neutral-700/80 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="text-xs">Menghubungkan ke Google...</span>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Masuk dengan Google</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2 text-xs font-semibold text-outline hover:text-on-surface transition-colors cursor-pointer"
          >
            Nanti Dulu
          </button>
        </div>
      </div>
    </div>
  );
}
