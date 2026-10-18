'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export interface LoginNudgeEventDetail {
  type: 'bookmark' | 'attendance' | 'pip';
  title?: string;
}

export const TRIGGER_LOGIN_NUDGE_EVENT = 'peta-kajian-trigger-login-nudge';

/**
 * Helper untuk memicu notifikasi ajakan login dari komponen mana pun
 */
export function triggerLoginNudge(detail: LoginNudgeEventDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TRIGGER_LOGIN_NUDGE_EVENT, { detail })
    );
  }
}

interface LoginNudgePromptProps {
  currentUser?: any;
}

export default function LoginNudgePrompt({ currentUser: propUser }: LoginNudgePromptProps) {
  const [currentUser, setCurrentUser] = useState<any>(propUser || null);
  const [toastData, setToastData] = useState<{ title?: string } | null>(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceSessionTitle, setAttendanceSessionTitle] = useState<string>('');
  const [isPipModalOpen, setIsPipModalOpen] = useState(false);
  const [pipSessionTitle, setPipSessionTitle] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Pantau status login secara mandiri jika propUser tidak dioper (misal saat dipasang global di layout.tsx)
  useEffect(() => {
    if (propUser !== undefined) {
      setCurrentUser(propUser);
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser(data.user);
      } else {
        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user) {
            setCurrentUser(sess.session.user);
          } else {
            setCurrentUser(null);
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [propUser]);

  const pathname = usePathname();

  // Tutup semua dialog & toast saat berpindah halaman
  useEffect(() => {
    setIsPipModalOpen(false);
    setIsAttendanceModalOpen(false);
    setToastData(null);
  }, [pathname]);

  useEffect(() => {
    const handleEvent = (e: CustomEvent<LoginNudgeEventDetail>) => {
      // Jika pengguna sudah login atau sedang di halaman auth, jangan tampilkan ajakan login
      if (currentUser) return;
      if (pathname === '/login' || pathname === '/kontributor/login' || pathname?.startsWith('/auth') || pathname === '/live/pip' || pathname?.startsWith('/live/pip')) return;

      const detail = e.detail;
      if (!detail) return;

      if (detail.type === 'bookmark') {
        // Cek frekuensi toast agar tidak terlalu sering mengganggu
        setToastData({ title: detail.title });
        if (toastTimerRef.current) {
          clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = setTimeout(() => {
          setToastData(null);
        }, 7000);
      } else if (detail.type === 'attendance') {
        setAttendanceSessionTitle(detail.title || '');
        setIsAttendanceModalOpen(true);
      } else if (detail.type === 'pip') {
        setPipSessionTitle(detail.title || '');
        setIsPipModalOpen(true);
      }
    };

    window.addEventListener(TRIGGER_LOGIN_NUDGE_EVENT as any, handleEvent);
    return () => {
      window.removeEventListener(TRIGGER_LOGIN_NUDGE_EVENT as any, handleEvent);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [currentUser, pathname]);

  const isAuthPage = pathname === '/login' || pathname === '/kontributor/login' || pathname?.startsWith('/auth');
  const isPipRoute = pathname === '/live/pip' || pathname?.startsWith('/live/pip');

  // Jangan render apa-apa jika sudah login, di halaman auth, atau di dalam jendela PiP OS
  if (currentUser || isAuthPage || isPipRoute) return null;

  // Handler Login 1-Klik Google langsung dari modal/toast
  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : (pathname || '/');
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      
      document.cookie = `peta_kajian_auth_next=${encodeURIComponent(currentPath)}; path=/; max-age=600; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      try {
        sessionStorage.setItem('peta_kajian_auth_next', currentPath);
        sessionStorage.setItem('peta_kajian_auth_in_progress', 'true');
      } catch {}

      const supabase = createClient();
      const callbackUrl = new URL('/auth/callback', window.location.origin);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        console.error('Login error from nudge prompt:', error.message);
        setIsLoggingIn(false);
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      {/* 1. TOAST NUDGE (UNTUK AKSI BOOKMARK) */}
      {toastData && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-6 md:right-6 md:left-auto md:translate-x-0 z-[100] w-[calc(100vw-24px)] max-w-[360px] md:max-w-[380px] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="p-3.5 rounded-2xl bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md border border-amber-500/30 dark:border-amber-500/40 shadow-2xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[18px]">bookmark_added</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-bold text-on-surface">Kajian Berhasil Disimpan</h4>
                <button
                  type="button"
                  onClick={() => setToastData(null)}
                  className="w-5 h-5 rounded-full hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                  title="Tutup pesan"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>

              <p className="text-[11px] text-on-surface-variant leading-relaxed mt-1">
                Jadwal ini baru tersimpan di memori browser ini. <strong>Masuk akun Google</strong> agar tidak hilang saat ganti perangkat.
              </p>

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-all shadow-2xs active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <>
                      <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                      <span>Menghubungkan...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[14px]">login</span>
                      <span>Masuk 1-Klik Google</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setToastData(null)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-medium text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Nanti Saja
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL NUDGE (UNTUK AKSI RSVP 'INSYA ALLAH HADIR') */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm rounded-3xl bg-surface-container-lowest dark:bg-neutral-900 border border-surface-container-high/80 dark:border-neutral-800 p-5 sm:p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ikon Header */}
            <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[28px]">how_to_reg</span>
            </div>

            <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-2 border border-emerald-300 dark:border-emerald-800">
              Presensi Tercatat
            </span>

            <h3 className="text-base sm:text-lg font-bold text-on-surface tracking-tight leading-snug">
              Jejak Majelis Ilmu Anda
            </h3>

            <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
              Masya Allah, niat kehadiran Anda di kajian <strong>{attendanceSessionTitle || 'ini'}</strong> telah dihitung di sistem.
            </p>

            <div className="p-3 my-3.5 rounded-2xl bg-surface-container-low/70 dark:bg-neutral-800/60 border border-surface-container-high/60 text-left space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] text-on-surface">
                <span className="material-symbols-outlined text-[15px] text-primary">auto_stories</span>
                <span>Tersimpan di <strong>Buku Saku Jamaah</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-on-surface">
                <span className="material-symbols-outlined text-[15px] text-amber-500">notifications_active</span>
                <span>Pengingat H-2 jam sebelum acara dimulai</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-on-surface">
                <span className="material-symbols-outlined text-[15px] text-emerald-600">sync</span>
                <span>Sinkron otomatis di semua perangkat Anda</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 flex items-center justify-center gap-2 transition-all shadow-xs active:scale-98 cursor-pointer disabled:opacity-60"
              >
                {isLoggingIn ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : (
                  <img
                    src="https://www.svgrepo.com/show/475656/google-color.svg"
                    className="w-4 h-4 bg-white rounded-full p-0.5"
                    alt="Google"
                  />
                )}
                <span>{isLoggingIn ? 'Menghubungkan...' : 'Lanjutkan dengan Google (1-Klik)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAttendanceModalOpen(false)}
                className="w-full py-2 px-4 rounded-xl text-xs font-medium text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Nanti Saja (Tetap Anonim)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL AJAKAN LOGIN: PICTURE-IN-PICTURE (OS-LEVEL) */}
      {isPipModalOpen && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsPipModalOpen(false)}
        >
          <div 
            className="w-full max-w-sm rounded-3xl bg-surface-container-lowest dark:bg-neutral-900 border border-surface-container-high/80 dark:border-neutral-800 p-5 sm:p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ikon Header */}
            <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[28px]">picture_in_picture_alt</span>
            </div>

            <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-2 border border-indigo-300 dark:border-indigo-800">
              Fitur Eksklusif Masuk Akun
            </span>

            <h3 className="text-base sm:text-lg font-bold text-on-surface tracking-tight leading-snug">
              Putar Melayang di Luar Browser
            </h3>

            <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
              Ingin menyimak siaran <strong>{pipSessionTitle || 'kajian'}</strong> sambil multitasking membuka aplikasi lain di komputer Anda (Word, Excel, Notion, atau kerjaan)?
            </p>

            <div className="p-3 my-3.5 rounded-2xl bg-surface-container-low/70 dark:bg-neutral-800/60 border border-surface-container-high/60 text-left space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] text-on-surface">
                <span className="material-symbols-outlined text-[15px] text-primary">layers</span>
                <span>Jendela video selalu berada di paling depan (*Always on Top*)</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-on-surface">
                <span className="material-symbols-outlined text-[15px] text-amber-500">desktop_windows</span>
                <span>Tetap terlihat walau browser diminimize atau buka tab lain</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-on-surface">
                <span className="material-symbols-outlined text-[15px] text-indigo-600">volunteer_activism</span>
                <span>100% Gratis untuk seluruh jamaah terdaftar</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 flex items-center justify-center gap-2 transition-all shadow-xs active:scale-98 cursor-pointer disabled:opacity-60"
              >
                {isLoggingIn ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : (
                  <img
                    src="https://www.svgrepo.com/show/475656/google-color.svg"
                    className="w-4 h-4 bg-white rounded-full p-0.5"
                    alt="Google"
                  />
                )}
                <span>{isLoggingIn ? 'Menghubungkan...' : 'Masuk Sekarang untuk Mengaktifkan'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPipModalOpen(false)}
                className="w-full py-2 px-4 rounded-xl text-xs font-medium text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Nanti Saja (Putar di Dalam Web)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
