'use client';

import React, { useState, useEffect } from 'react';

// Global reference for install prompt across components
declare global {
  interface Window {
    __pwaDeferredPrompt?: any;
    triggerPwaInstall?: () => Promise<boolean>;
    isPwaInstalled?: boolean;
  }
}

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already in standalone / installed mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      window.isPwaInstalled = true;
      return;
    }

    // Check iOS
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // Capture beforeinstallprompt for Android / Chrome / Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__pwaDeferredPrompt = e;
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      window.__pwaDeferredPrompt = null;
      window.isPwaInstalled = true;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.__pwaDeferredPrompt) {
      setCanInstall(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    if (isIos) {
      setShowIosGuide(true);
      return false;
    }

    const promptEvent = window.__pwaDeferredPrompt;
    if (!promptEvent) {
      // If no event (e.g. desktop non-supported or already installed), open guide or inform user
      if (isIos) {
        setShowIosGuide(true);
      } else {
        alert('Untuk meng-install Peta Kajian, gunakan menu browser Anda dan pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".');
      }
      return false;
    }

    try {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setCanInstall(false);
        window.__pwaDeferredPrompt = null;
        return true;
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
    return false;
  };

  return {
    canInstall: canInstall || (isIos && !isInstalled),
    isInstalled,
    isIos,
    showIosGuide,
    setShowIosGuide,
    promptInstall,
  };
}

export default function PWAInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const { canInstall, isInstalled, isIos, showIosGuide, setShowIosGuide, promptInstall } = usePWAInstall();

  // Register Service Worker safely
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('PWA Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('Service Worker registration failed:', err);
        });
    }

    // Check if dismissed previously
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (!dismissed) {
      // Delay prompt banner to not disturb initial page view
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pwa-install-dismissed', 'true');
    }
  };

  const handleInstallClick = async () => {
    setShowBanner(false);
    await promptInstall();
  };

  return (
    <>
      {/* Floating Bottom Banner (Only shown if can install and not yet dismissed) */}
      {showBanner && !isInstalled && canInstall && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-surface-container-lowest border border-primary/20 shadow-xl rounded-2xl p-4 flex items-center justify-between gap-3 text-on-surface">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png?v=3"
                alt="Peta Kajian"
                className="w-10 h-10 object-contain rounded-xl bg-primary/5 p-1 shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">Pasang Peta Kajian</span>
                <span className="text-[11px] text-outline leading-tight">
                  Akses jadwal kajian lebih cepat langsung dari layar utama HP Anda.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleInstallClick}
                className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 text-outline hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                title="Tutup"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Install Instruction Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png?v=3" alt="Peta Kajian" className="w-8 h-8 object-contain" />
                <h3 className="text-sm font-bold text-on-surface">Pasang di iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="p-1 text-outline hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Untuk meng-install Peta Kajian di iOS Safari tanpa App Store:
            </p>

            <ol className="space-y-2.5 text-xs text-on-surface">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <span>
                  Ketuk tombol <strong>Bagikan</strong> (ikon kotak dengan panah ke atas{' '}
                  <span className="material-symbols-outlined text-[14px] align-middle text-primary">
                    ios_share
                  </span>
                  ) di bilah navigasi Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <span>
                  Gulir ke bawah pada menu, lalu pilih <strong>Tambah ke Layar Utama</strong> (
                  <em>Add to Home Screen</em> ⊞).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <span>
                  Ketuk <strong>Tambah</strong> di pojok kanan atas. Aplikasi Peta Kajian siap digunakan!
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
