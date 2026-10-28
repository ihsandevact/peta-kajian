'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DZIKIR_ITEMS } from '@/data/dzikirData';
import DzikirFocusCard from '@/components/dzikir/DzikirFocusCard';
import DzikirListView from '@/components/dzikir/DzikirListView';
import ThemeToggle from '@/components/ThemeToggle';
import { useConfirm } from '@/context/ConfirmDialogContext';

type DzikirTimeTab = 'pagi' | 'petang';
type DzikirTabCounts = {
  pagi: Record<string, number>;
  petang: Record<string, number>;
};

export default function DzikirPage() {
  const router = useRouter();
  const confirmDialog = useConfirm();

  // Smart time detection: Jika sebelum jam 15:00 default ke Pagi, jika 15:00 ke atas default ke Petang
  const initialTimeTab = useMemo<DzikirTimeTab>(() => {
    if (typeof window === 'undefined') return 'pagi';
    const hours = new Date().getHours();
    return hours < 15 ? 'pagi' : 'petang';
  }, []);

  const [activeTab, setActiveTab] = useState<DzikirTimeTab>(initialTimeTab);
  const [viewMode, setViewMode] = useState<'focus' | 'list'>('focus');
  const [arabicFontSize, setArabicFontSize] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [showLatin, setShowLatin] = useState<boolean>(true);
  const [focusIndex, setFocusIndex] = useState<number>(0);

  // Ref untuk timer auto-advance agar tidak bentrok atau terpanggil ganda
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer]);

  // Ambil data dzikir yang sesuai dengan tab saat ini
  const currentItems = useMemo(() => {
    return DZIKIR_ITEMS.filter(
      (item) => item.time === 'both' || item.time === activeTab
    );
  }, [activeTab]);

  // Kunci tanggal hari ini untuk reset otomatis setiap pergantian hari
  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }, []);

  // State penyimpanan progres hitungan per sesi waktu (pagi & petang terpisah)
  const [counts, setCounts] = useState<DzikirTabCounts>({
    pagi: {},
    petang: {},
  });

  // Helper mencari indeks dzikir pertama yang belum selesai pada suatu tab
  const findFirstIncompleteIndex = useCallback(
    (tab: DzikirTimeTab, tabCounts: Record<string, number>) => {
      const items = DZIKIR_ITEMS.filter((item) => item.time === 'both' || item.time === tab);
      const idx = items.findIndex((item) => (tabCounts[item.id] || 0) < item.targetCount);
      return idx >= 0 ? idx : 0;
    },
    []
  );

  // Muat data tersimpan dari localStorage saat halaman dibuka
  useEffect(() => {
    try {
      const storedDate = localStorage.getItem('dzikir_last_date');
      let loadedCounts: DzikirTabCounts = { pagi: {}, petang: {} };

      if (storedDate === todayKey) {
        const storedCounts = localStorage.getItem('dzikir_progress_counts');
        if (storedCounts) {
          const parsed = JSON.parse(storedCounts);
          if (
            parsed &&
            typeof parsed === 'object' &&
            ('pagi' in parsed || 'petang' in parsed)
          ) {
            loadedCounts = {
              pagi: parsed.pagi && typeof parsed.pagi === 'object' ? parsed.pagi : {},
              petang: parsed.petang && typeof parsed.petang === 'object' ? parsed.petang : {},
            };
          } else {
            // Format lama (flat): reset ke struktur per-tab agar tidak mencampur pagi & petang
            localStorage.setItem('dzikir_progress_counts', JSON.stringify(loadedCounts));
          }
        }
      } else {
        // Hari baru: reset hitungan
        localStorage.setItem('dzikir_last_date', todayKey);
        localStorage.setItem('dzikir_progress_counts', JSON.stringify(loadedCounts));
      }

      setCounts(loadedCounts);
      setFocusIndex(findFirstIncompleteIndex(initialTimeTab, loadedCounts[initialTimeTab]));
    } catch {}
  }, [todayKey, initialTimeTab, findFirstIncompleteIndex]);

  // Simpan progres ke localStorage
  const saveToStorage = useCallback(
    (newCounts: DzikirTabCounts) => {
      try {
        localStorage.setItem('dzikir_last_date', todayKey);
        localStorage.setItem('dzikir_progress_counts', JSON.stringify(newCounts));
      } catch {}
    },
    [todayKey]
  );

  const activeCounts = counts[activeTab] || {};

  // Trigger getaran haptic di perangkat mobile
  const triggerHaptic = useCallback((type: 'tap' | 'complete') => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'tap') {
          navigator.vibrate(35);
        } else if (type === 'complete') {
          navigator.vibrate([40, 50, 90]);
        }
      } catch {}
    }
  }, []);

  // Ganti tab Pagi / Petang dengan aman tanpa sisa timer auto-advance
  const handleSelectTab = useCallback(
    (tab: DzikirTimeTab) => {
      if (tab === activeTab) return;
      clearAutoAdvanceTimer();
      setActiveTab(tab);
      setFocusIndex(findFirstIncompleteIndex(tab, counts[tab] || {}));
    },
    [activeTab, clearAutoAdvanceTimer, counts, findFirstIncompleteIndex]
  );

  // Ganti mode Fokus / Daftar dengan aman
  const handleSelectViewMode = useCallback(
    (mode: 'focus' | 'list') => {
      clearAutoAdvanceTimer();
      setViewMode(mode);
    },
    [clearAutoAdvanceTimer]
  );

  // Increment hitungan suatu dzikir pada tab yang sedang aktif (murni di luar state updater)
  const handleIncrement = useCallback(
    (id: string, targetCount: number) => {
      const currentTabCounts = counts[activeTab] || {};
      const current = currentTabCounts[id] || 0;
      if (current >= targetCount) return;

      const next = current + 1;
      const updated: DzikirTabCounts = {
        ...counts,
        [activeTab]: {
          ...currentTabCounts,
          [id]: next,
        },
      };

      setCounts(updated);
      saveToStorage(updated);

      if (next >= targetCount) {
        triggerHaptic('complete');
        // Jika di Mode Fokus dan belum di kartu terakhir, jadwalkan auto-advance ke indeks berikutnya secara deterministik
        if (viewMode === 'focus') {
          clearAutoAdvanceTimer();
          const completedIdx = currentItems.findIndex((item) => item.id === id);
          if (completedIdx !== -1 && completedIdx < currentItems.length - 1) {
            const nextIdx = completedIdx + 1;
            autoAdvanceTimerRef.current = setTimeout(() => {
              autoAdvanceTimerRef.current = null;
              setFocusIndex(nextIdx);
            }, 350);
          }
        }
      } else {
        triggerHaptic('tap');
      }
    },
    [counts, activeTab, saveToStorage, triggerHaptic, viewMode, clearAutoAdvanceTimer, currentItems]
  );

  // Reset hitungan dzikir tertentu pada tab yang sedang aktif
  const handleResetItem = useCallback(
    (id: string) => {
      clearAutoAdvanceTimer();
      const currentTabCounts = counts[activeTab] || {};
      const updated: DzikirTabCounts = {
        ...counts,
        [activeTab]: {
          ...currentTabCounts,
          [id]: 0,
        },
      };
      setCounts(updated);
      saveToStorage(updated);
    },
    [clearAutoAdvanceTimer, counts, activeTab, saveToStorage]
  );

  // Reset seluruh hitungan khusus untuk tab dzikir yang sedang aktif
  const handleResetCurrentTab = useCallback(async () => {
    const label = activeTab === 'pagi' ? 'Dzikir Pagi' : 'Dzikir Petang';
    const confirmed = await confirmDialog({
      title: `Reset ${label}?`,
      description: `Seluruh progres hitungan ${label} pada sesi hari ini akan dikembalikan ke 0.`,
      confirmText: 'Ya, Reset',
      cancelText: 'Batal',
      variant: 'danger',
      icon: 'restart_alt',
    });
    if (confirmed) {
      clearAutoAdvanceTimer();
      const updated: DzikirTabCounts = {
        ...counts,
        [activeTab]: {},
      };
      setCounts(updated);
      saveToStorage(updated);
      setFocusIndex(0);
    }
  }, [activeTab, clearAutoAdvanceTimer, confirmDialog, counts, saveToStorage]);

  // Navigasi manual Sebelumnya & Selanjutnya di Mode Fokus
  const handlePrevCard = useCallback(() => {
    clearAutoAdvanceTimer();
    setFocusIndex((prev) => Math.max(0, prev - 1));
  }, [clearAutoAdvanceTimer]);

  const handleNextCard = useCallback(() => {
    clearAutoAdvanceTimer();
    setFocusIndex((prev) => Math.min(currentItems.length - 1, prev + 1));
  }, [clearAutoAdvanceTimer, currentItems.length]);

  // Tombol Kembali dengan fallback ke Beranda jika history kosong
  const handleBack = useCallback(() => {
    clearAutoAdvanceTimer();
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }, [clearAutoAdvanceTimer, router]);

  // Hitung jumlah dzikir yang sudah selesai di tab aktif
  const completedCount = useMemo(() => {
    return currentItems.filter((item) => (activeCounts[item.id] || 0) >= item.targetCount).length;
  }, [currentItems, activeCounts]);

  // Cek apakah ada progres bacaan (> 0) di tab aktif untuk menampilkan tombol reset
  const hasActiveTabProgress = useMemo(() => {
    return currentItems.some((item) => (activeCounts[item.id] || 0) > 0);
  }, [currentItems, activeCounts]);

  const safeFocusIndex = Math.min(focusIndex, Math.max(0, currentItems.length - 1));
  const currentFocusItem = currentItems[safeFocusIndex] || currentItems[0];
  const currentItemCount = currentFocusItem ? activeCounts[currentFocusItem.id] || 0 : 0;
  const isCurrentFocusCompleted = currentFocusItem
    ? currentItemCount >= currentFocusItem.targetCount
    : false;

  return (
    <div className="min-h-screen bg-background text-on-surface font-geist flex flex-col pb-[calc(76px+env(safe-area-inset-bottom,16px))] md:pb-12">
      {/* 1. TOP NAVBAR HEADER */}
      <header className="sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b border-outline-variant/40 transition-colors">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Tombol Kembali ke Beranda / Sebelumnya */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 cursor-pointer transition-colors"
              aria-label="Kembali"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-on-surface truncate">
                Dzikir Pagi &amp; Petang
              </h1>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold leading-none truncate">
                Sesuai Sunnah (Hisnul Muslim)
              </p>
            </div>
          </div>

          {/* Action Toolbar Kanan (Theme Toggle & Reset Per-Tab) */}
          <div className="flex items-center gap-1.5">
            {hasActiveTabProgress && (
              <button
                type="button"
                onClick={handleResetCurrentTab}
                className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-red-600 border border-outline-variant/60 transition-colors cursor-pointer"
                title={`Reset Hitungan ${activeTab === 'pagi' ? 'Dzikir Pagi' : 'Dzikir Petang'}`}
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              </button>
            )}
            <ThemeToggle variant="icon" size="sm" />
          </div>
        </div>
      </header>

      {/* 2. TAB SWITCHER (DZIKIR PAGI VS PETANG) */}
      <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 pb-2">
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-surface-container-low border border-outline-variant/40">
          <button
            type="button"
            onClick={() => handleSelectTab('pagi')}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'pagi'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">wb_sunny</span>
            <span>Dzikir Pagi</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('petang')}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'petang'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">nights_stay</span>
            <span>Dzikir Petang</span>
          </button>
        </div>

        {/* Status Bar Progres Keseluruhan */}
        <div className="mt-3 flex items-center justify-between text-xs font-bold text-on-surface-variant px-1">
          <span>
            Progres Selesai:{' '}
            <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
              {completedCount}
            </strong>{' '}
            / {currentItems.length}
          </span>
          <span className="font-mono text-[11px] text-outline">
            {Math.round((completedCount / (currentItems.length || 1)) * 100)}%
          </span>
        </div>

        {/* Progress Bar Line */}
        <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-1.5">
          <div
            className="h-full bg-emerald-600 transition-all duration-300 ease-out rounded-full"
            style={{
              width: `${(completedCount / (currentItems.length || 1)) * 100}%`,
            }}
          />
        </div>

        {/* Toolbar Kustomisasi (Mode Tampilan, Ukuran Font & Latin Toggle) */}
        <div className="mt-3 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1 text-xs">
          {/* Switch Mode: Fokus vs Daftar */}
          <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded-xl border border-outline-variant/40 shrink-0">
            <button
              type="button"
              onClick={() => handleSelectViewMode('focus')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'focus'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">view_carousel</span>
              <span>Fokus</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectViewMode('list')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">format_list_bulleted</span>
              <span>Daftar</span>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Toggle Transliterasi Latin */}
            <button
              type="button"
              onClick={() => setShowLatin((prev) => !prev)}
              className={`px-2 py-1 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
                showLatin
                  ? 'bg-emerald-600/10 border-emerald-600/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-surface-container border-outline-variant/60 text-on-surface-variant'
              }`}
              title="Tampilkan/Sembunyikan Teks Latin"
            >
              Latin: {showLatin ? 'ON' : 'OFF'}
            </button>

            {/* Toggle Ukuran Font Arab */}
            <button
              type="button"
              onClick={() => {
                setArabicFontSize((prev) =>
                  prev === 'normal' ? 'large' : prev === 'large' ? 'xlarge' : 'normal'
                );
              }}
              className="px-2 py-1 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-on-surface text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-0.5"
              title="Ubah Ukuran Huruf Arab"
            >
              <span className="material-symbols-outlined text-[14px]">format_size</span>
              <span className="capitalize">{arabicFontSize}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. KONTEN UTAMA DZIKIR */}
      <main className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-3 flex-1 flex flex-col justify-center">
        {viewMode === 'focus' && currentFocusItem ? (
          <DzikirFocusCard
            item={currentFocusItem}
            currentIndex={safeFocusIndex}
            totalItems={currentItems.length}
            currentCount={currentItemCount}
            isCompleted={isCurrentFocusCompleted}
            onIncrement={() => handleIncrement(currentFocusItem.id, currentFocusItem.targetCount)}
            onReset={() => handleResetItem(currentFocusItem.id)}
            onPrev={handlePrevCard}
            onNext={handleNextCard}
            arabicFontSize={arabicFontSize}
            showLatin={showLatin}
          />
        ) : (
          <DzikirListView
            items={currentItems}
            counts={activeCounts}
            onIncrement={handleIncrement}
            onReset={handleResetItem}
            arabicFontSize={arabicFontSize}
            showLatin={showLatin}
          />
        )}
      </main>
    </div>
  );
}
