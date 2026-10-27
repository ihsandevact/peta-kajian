'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  SIFAT_SHOLAT_STEPS,
  SIFAT_SHOLAT_CATEGORIES,
  RUKUN_SHOLAT_SUMMARY,
  KESALAHAN_UMUM_SHOLAT,
  type SifatSholatStep,
  type BacaanItem,
} from '@/data/sifatSholatData';
import ThemeToggle from '@/components/ThemeToggle';

export default function SifatSholatPage() {
  const router = useRouter();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  // User feedback states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tampilkan toast message
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2400);
  }, []);

  // Bookmarks state (syncs with localStorage)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // Typography & preferences
  const [arabicFontSize, setArabicFontSize] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [showLatin, setShowLatin] = useState<boolean>(true);

  // Muat bookmark dan preferensi dari localStorage
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const storedBookmarks = localStorage.getItem('sifat_sholat_bookmarks');
        if (storedBookmarks) {
          const parsed = JSON.parse(storedBookmarks);
          if (Array.isArray(parsed)) {
            setBookmarkedIds(new Set(parsed));
          }
        }

        const storedFontSize = localStorage.getItem('sifat_sholat_font_size');
        if (storedFontSize === 'normal' || storedFontSize === 'large' || storedFontSize === 'xlarge') {
          setArabicFontSize(storedFontSize);
        }

        const storedShowLatin = localStorage.getItem('sifat_sholat_show_latin');
        if (storedShowLatin !== null) {
          setShowLatin(storedShowLatin === 'true');
        }
      } catch {
        // Abaikan jika localStorage tidak tersedia
      }
    });
  }, []);

  // Simpan bookmark
  const toggleBookmark = useCallback((stepId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
        showToast('Dihapus dari daftar tersimpan');
      } else {
        next.add(stepId);
        showToast('Disimpan ke daftar tersimpan');
      }
      try {
        localStorage.setItem('sifat_sholat_bookmarks', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, [showToast]);

  // Pengaturan font size
  const handleFontSizeChange = useCallback((size: 'normal' | 'large' | 'xlarge') => {
    setArabicFontSize(size);
    try {
      localStorage.setItem('sifat_sholat_font_size', size);
    } catch {}
  }, []);

  // Pengaturan toggle latin
  const handleToggleLatin = useCallback(() => {
    setShowLatin((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sifat_sholat_show_latin', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Copy to clipboard
  const handleCopyBacaan = useCallback(
    (step: SifatSholatStep, bacaan?: BacaanItem) => {
      let text = '';
      if (bacaan) {
        text = `*${bacaan.title}* (${step.title})\n\n${bacaan.arabic}\n\n_${bacaan.transliteration || ''}_\n\nArtinya:\n"${bacaan.translation}"\n\n📌 Hadits: ${bacaan.narrator}\n\n(Dikutip dari Panduan Sifat Sholat Nabi - Peta Kajian Indonesia)`;
      } else {
        text = `*${step.title}* (${step.hukumLabel})\n\n${step.summary}\n\n📌 Hadits: ${step.hadithDalil.narrator}\n"${step.hadithDalil.translation}"\n\n(Dikutip dari Panduan Sifat Sholat Nabi - Peta Kajian Indonesia)`;
      }

      navigator.clipboard.writeText(text);
      const copyKey = bacaan ? `${step.id}-${bacaan.id}` : step.id;
      setCopiedId(copyKey);
      showToast('Teks berhasil disalin ke clipboard');
      setTimeout(() => {
        setCopiedId((current) => (current === copyKey ? null : current));
      }, 2000);
    },
    [showToast]
  );

  // Share to WhatsApp
  const handleShareWhatsApp = useCallback((step: SifatSholatStep, bacaan?: BacaanItem) => {
    let text = '';
    if (bacaan) {
      text = `*${bacaan.title}* (${step.title})\n\n${bacaan.arabic}\n\n_${bacaan.transliteration || ''}_\n\nArtinya:\n"${bacaan.translation}"\n\n📌 *Hadits*: ${bacaan.narrator}\n\nPelajari selengkapnya di:\nhttps://petakajian.id/sifat-sholat#${step.id}`;
    } else {
      text = `*Panduan Sholat Sesuai Sunnah: ${step.title}*\n\n${step.summary}\n\n📌 *Dalil*: ${step.hadithDalil.narrator}\n"${step.hadithDalil.translation}"\n\nPelajari selengkapnya di:\nhttps://petakajian.id/sifat-sholat#${step.id}`;
    }
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // Scroll ke step tertentu
  const scrollToStep = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setExpandedStepId(id);
    }
  };

  // Filter Data
  const filteredSteps = useMemo(() => {
    return SIFAT_SHOLAT_STEPS.filter((step) => {
      // 1. Kategori Filter
      if (activeCategory === 'saved') {
        if (!bookmarkedIds.has(step.id)) return false;
      } else if (activeCategory === 'rukun') {
        if (step.hukum !== 'rukun' && step.hukum !== 'wajib') return false;
      } else if (activeCategory === 'bacaan') {
        if (!step.bacaanList || step.bacaanList.length === 0) return false;
      }

      // 2. Query Pencarian
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchTitle = step.title.toLowerCase().includes(q);
      const matchSummary = step.summary.toLowerCase().includes(q);
      const matchMovement = step.movementDescription.some((m) => m.toLowerCase().includes(q));
      const matchHadith =
        step.hadithDalil.translation.toLowerCase().includes(q) ||
        step.hadithDalil.narrator.toLowerCase().includes(q);
      const matchBacaan = step.bacaanList?.some(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.translation.toLowerCase().includes(q) ||
          (b.transliteration && b.transliteration.toLowerCase().includes(q))
      );

      return matchTitle || matchSummary || matchMovement || matchHadith || Boolean(matchBacaan);
    });
  }, [activeCategory, bookmarkedIds, searchQuery]);

  // Typography class untuk teks Arab
  const arabicTextClass = useMemo(() => {
    switch (arabicFontSize) {
      case 'normal':
        return 'text-xl sm:text-2xl leading-[2.2]';
      case 'xlarge':
        return 'text-3xl sm:text-4xl leading-[2.5]';
      case 'large':
      default:
        return 'text-2xl sm:text-3xl leading-[2.3]';
    }
  }, [arabicFontSize]);

  return (
    <div className="min-h-screen bg-background text-on-surface font-geist flex flex-col pb-[calc(76px+env(safe-area-inset-bottom,16px))] md:pb-12">
      {/* TOAST NOTIFIKASI */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface px-4 py-2 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. HEADER STICKY */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-outline-variant/60 shadow-2xs">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0"
              aria-label="Kembali"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-on-surface truncate">
                  Panduan Sholat Nabi ﷺ
                </h1>
                <span className="px-1.5 py-0.2 rounded bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                  Shahih
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium leading-none truncate">
                Panduan tata cara &amp; bacaan sholat dari takbir hingga salam
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggle variant="icon" />
          </div>
        </div>
      </header>

      {/* 2. HERO HADITS BANNER */}
      <section className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-3.5 sm:pt-5 w-full">
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-linear-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white shadow-sm border border-indigo-500/20 relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold tracking-wide uppercase text-indigo-200">
                Landasan Utama Sunnah Sholat
              </span>
              <span className="text-[10px] text-indigo-200 font-mono">HR. Al-Bukhari no. 631</span>
            </div>

            <p className="text-right font-serif text-lg sm:text-xl text-amber-200 leading-relaxed" dir="rtl">
              «صَلُّوا كَمَا رَأَيْتُمُونِي أُصَلِّي»
            </p>

            <p className="text-xs sm:text-sm text-indigo-100 font-medium italic">
              &quot;Sholatlah kalian sebagaimana kalian melihat aku sholat.&quot;
            </p>
            <p className="text-[11px] text-indigo-200/80 leading-relaxed">
              Panduan ini disusun berdasarkan hadits-hadits shahih (sebagaimana dirangkum oleh para ulama kibar seperti Syaikh Muhammad Nashiruddin Al-Albani rahimahullah) mencakup rukun, wajib, tata cara gerakan thuma&apos;ninah, dan lafadz bacaan yang tsabit.
            </p>
          </div>
          <div className="absolute -right-6 -bottom-8 text-white/5 pointer-events-none select-none">
            <span className="material-symbols-outlined text-[140px]">accessibility_new</span>
          </div>
        </div>
      </section>

      {/* 3. CONTROLS: SEARCH & CATEGORY TABS */}
      <section className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-3 w-full space-y-2.5">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari gerakan atau bacaan (misal: istiftah, ruku', sujud, tasyahhud)..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-surface border border-outline-variant/60 focus:border-indigo-500 focus:outline-hidden text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant/70 shadow-2xs transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {SIFAT_SHOLAT_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-surface text-on-surface-variant hover:text-on-surface border-outline-variant/50 hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                <span>{cat.label}</span>
                {cat.id === 'saved' && bookmarkedIds.size > 0 && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-white text-indigo-700' : 'bg-indigo-600/15 text-indigo-600'
                    }`}
                  >
                    {bookmarkedIds.size}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Stepper Quick-Jump Bar (Muncul saat tab 'all') */}
        {activeCategory === 'all' && !searchQuery && (
          <div className="pt-0.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant mb-1 px-0.5 flex items-center justify-between">
              <span>Lompat Cepat ke Langkah Sholat:</span>
              <span>15 Langkah Berurutan</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {SIFAT_SHOLAT_STEPS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => scrollToStep(st.id)}
                  className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-container-high border border-outline-variant/50 text-[11px] font-bold text-on-surface-variant hover:text-indigo-600 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="w-4 h-4 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                    {st.stepNumber}
                  </span>
                  <span>{st.title.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Typography & Preferences Toolbar */}
        <div className="flex items-center justify-between pt-1 px-1 text-xs">
          <div className="flex items-center gap-1.5 text-on-surface-variant font-medium">
            <span className="text-[11px]">
              Menampilkan <strong className="text-on-surface">{filteredSteps.length}</strong> langkah sholat
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Latin Toggle */}
            <button
              type="button"
              onClick={handleToggleLatin}
              className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                showLatin
                  ? 'bg-surface-container text-indigo-700 dark:text-indigo-300 border-indigo-500/40'
                  : 'bg-surface text-on-surface-variant border-outline-variant/40 hover:text-on-surface'
              }`}
              title="Tampilkan / Sembunyikan Teks Latin"
            >
              Latin: {showLatin ? 'ON' : 'OFF'}
            </button>

            {/* Font Size Selector */}
            <div className="inline-flex rounded-lg bg-surface-container border border-outline-variant/40 p-0.5">
              <button
                type="button"
                onClick={() => handleFontSizeChange('normal')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
                  arabicFontSize === 'normal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Ukuran Arab: Sedang"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => handleFontSizeChange('large')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
                  arabicFontSize === 'large'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Ukuran Arab: Besar"
              >
                A+
              </button>
              <button
                type="button"
                onClick={() => handleFontSizeChange('xlarge')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
                  arabicFontSize === 'xlarge'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Ukuran Arab: Ekstra Besar"
              >
                A++
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. KONTEN UTAMA */}
      <main className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-2 pb-6 space-y-4 flex-1">
        {/* TAMPILAN KHUSUS TAB: KOREKSI KESALAHAN */}
        {activeCategory === 'kesalahan' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Larangan &amp; Kesalahan Fatal yang Sering Terjadi dalam Sholat</span>
              </div>
              <p className="text-[11px] opacity-90">
                Rasulullah ﷺ memberikan peringatan tegas terhadap beberapa kekeliruan berikut yang dapat mengurangi kesempurnaan atau bahkan membatalkan sholat.
              </p>
            </div>

            <div className="grid gap-3">
              {KESALAHAN_UMUM_SHOLAT.map((err, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-surface border border-outline-variant/60 space-y-2 shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <h3 className="font-extrabold text-xs sm:text-sm text-on-surface">{err.title}</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed pl-8">{err.desc}</p>
                  <div className="pl-8 pt-1">
                    <div className="p-2.5 rounded-xl bg-surface-container text-[11px] text-on-surface-variant italic border border-outline-variant/40">
                      📌 {err.dalil}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAMPILAN KHUSUS TAB: RUKUN & WAJIB CHECKLIST SUMMARY */}
        {activeCategory === 'rukun' && (
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-2.5 mb-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs sm:text-sm text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Daftar 17 Rukun Sholat (Wajib Dikerjakan Agar Sah)</span>
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {RUKUN_SHOLAT_SUMMARY.map((rk) => (
                <div
                  key={rk.no}
                  className="flex items-center gap-2 text-[11px] text-on-surface-variant p-1.5 rounded-lg bg-surface/80 border border-outline-variant/30"
                >
                  <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {rk.no}
                  </span>
                  <span className="truncate">{rk.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DAFTAR KARTU LANGKAH SHOLAT */}
        {filteredSteps.length === 0 ? (
          // Empty State
          <div className="py-14 px-4 text-center flex flex-col items-center justify-center space-y-3 rounded-3xl bg-surface border border-outline-variant/40">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px]">
                {activeCategory === 'saved' ? 'bookmark_border' : 'search_off'}
              </span>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-on-surface">
                {activeCategory === 'saved'
                  ? 'Belum ada langkah yang disimpan'
                  : 'Langkah sholat tidak ditemukan'}
              </h3>
              <p className="text-xs text-on-surface-variant max-w-sm">
                {activeCategory === 'saved'
                  ? 'Tandai langkah sholat atau bacaan dengan ikon bookmark untuk menyimpannya di sini.'
                  : `Tidak ada hasil yang sesuai dengan kata kunci "${searchQuery}". Coba gunakan kata kunci lain.`}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 text-xs font-bold transition-colors cursor-pointer"
              >
                Reset Pencarian
              </button>
            )}
          </div>
        ) : (
          filteredSteps.map((step) => {
            const isSaved = bookmarkedIds.has(step.id);
            const isExpanded = expandedStepId === step.id || activeCategory !== 'all';
            const isCopied = copiedId === step.id;

            // Warna badge berdasarkan hukum
            const hukumBadgeColor =
              step.hukum === 'rukun'
                ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : step.hukum === 'wajib'
                ? 'bg-amber-600/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-sky-600/10 text-sky-700 dark:text-sky-300 border-sky-500/30';

            return (
              <article
                key={step.id}
                id={step.id}
                className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-surface border border-outline-variant/60 shadow-2xs hover:border-indigo-500/30 transition-all flex flex-col gap-3.5 scroll-mt-20"
              >
                {/* Header Kartu: Nomor, Status Hukum, Judul & Actions */}
                <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 pb-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center justify-center shrink-0">
                        {step.stepNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${hukumBadgeColor}`}
                      >
                        {step.hukumLabel}
                      </span>
                    </div>
                    <h2 className="font-extrabold text-sm sm:text-base text-on-surface">
                      {step.title}
                    </h2>
                  </div>

                  {/* Action Buttons: Bookmark, Copy, Share WA */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Bookmark */}
                    <button
                      type="button"
                      onClick={() => toggleBookmark(step.id)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isSaved
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 scale-105'
                          : 'bg-surface-container text-on-surface-variant hover:text-amber-500 hover:bg-surface-container-high border border-outline-variant/40'
                      }`}
                      aria-label={isSaved ? 'Hapus bookmark' : 'Simpan langkah'}
                      title={isSaved ? 'Hapus dari tersimpan' : 'Simpan langkah sholat'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isSaved ? 'bookmark' : 'bookmark_border'}
                      </span>
                    </button>

                    {/* Copy */}
                    <button
                      type="button"
                      onClick={() => handleCopyBacaan(step)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-outline-variant/40'
                      }`}
                      aria-label="Salin ringkasan"
                      title="Salin ringkasan langkah sholat"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isCopied ? 'check' : 'content_copy'}
                      </span>
                    </button>

                    {/* WhatsApp */}
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(step)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center bg-surface-container text-on-surface-variant hover:text-emerald-600 hover:bg-surface-container-high border border-outline-variant/40 transition-all cursor-pointer"
                      aria-label="Bagikan WhatsApp"
                      title="Bagikan ke WhatsApp"
                    >
                      <span className="material-symbols-outlined text-[18px]">share</span>
                    </button>
                  </div>
                </div>

                {/* Ringkasan Langkah */}
                <p className="text-xs sm:text-sm text-on-surface font-medium leading-relaxed">
                  {step.summary}
                </p>

                {/* Deskripsi Gerakan Detail */}
                <div className="space-y-1.5 p-3 sm:p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">pan_tool</span>
                    <span>Tata Cara Gerakan Sesuai Sunnah:</span>
                  </h4>
                  <ul className="space-y-1 text-xs text-on-surface-variant list-disc list-inside">
                    {step.movementDescription.map((desc, i) => (
                      <li key={i} className="leading-relaxed">
                        {desc}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* KUMPULAN BACAAN / DOA SHOLAT (JIKA ADA) */}
                {step.bacaanList && step.bacaanList.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">
                        menu_book
                      </span>
                      <span>Lafadz Doa &amp; Bacaan Shahih:</span>
                    </div>

                    <div className="space-y-3">
                      {step.bacaanList.map((bacaan) => {
                        const bacaanKey = `${step.id}-${bacaan.id}`;
                        const isBacaanCopied = copiedId === bacaanKey;

                        return (
                          <div
                            key={bacaan.id}
                            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-surface-container border border-outline-variant/50 space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-2">
                              <h5 className="font-bold text-xs text-on-surface">{bacaan.title}</h5>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopyBacaan(step, bacaan)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                    isBacaanCopied
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-surface text-on-surface-variant hover:text-on-surface border border-outline-variant/40'
                                  }`}
                                  title="Salin lafadz bacaan"
                                >
                                  <span className="material-symbols-outlined text-[13px]">
                                    {isBacaanCopied ? 'check' : 'content_copy'}
                                  </span>
                                  <span>{isBacaanCopied ? 'Tersalin' : 'Salin'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleShareWhatsApp(step, bacaan)}
                                  className="w-7 h-7 rounded-lg bg-surface text-on-surface-variant hover:text-emerald-600 border border-outline-variant/40 flex items-center justify-center cursor-pointer transition-colors"
                                  title="Bagikan bacaan via WhatsApp"
                                >
                                  <span className="material-symbols-outlined text-[14px]">share</span>
                                </button>
                              </div>
                            </div>

                            {/* Teks Arab Berharakat */}
                            <div className="py-2 text-right" dir="rtl">
                              <p
                                className={`font-serif text-on-surface selection:bg-indigo-500/25 ${arabicTextClass}`}
                              >
                                {bacaan.arabic}
                              </p>
                            </div>

                            {/* Transliterasi Latin */}
                            {showLatin && bacaan.transliteration && (
                              <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/30 text-xs text-on-surface-variant italic leading-relaxed">
                                {bacaan.transliteration}
                              </div>
                            )}

                            {/* Terjemahan Bahasa Indonesia */}
                            <div className="text-xs text-on-surface font-medium leading-relaxed">
                              &quot;{bacaan.translation}&quot;
                            </div>

                            {/* Riwayat & Faedah */}
                            <div className="flex items-center justify-between flex-wrap gap-1 pt-1 text-[11px] text-on-surface-variant">
                              <span className="font-mono bg-surface px-2 py-0.5 rounded-md border border-outline-variant/40">
                                📌 {bacaan.narrator}
                              </span>
                              {bacaan.note && (
                                <span className="text-[10px] text-indigo-700 dark:text-indigo-400 italic">
                                  {bacaan.note}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* DALIL HADITS SHAHIH */}
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300 font-bold">
                    <span>📌 Dalil Shahih: {step.hadithDalil.narrator}</span>
                  </div>
                  {step.hadithDalil.matan && (
                    <p className="font-serif text-right text-sm text-on-surface pt-1" dir="rtl">
                      {step.hadithDalil.matan}
                    </p>
                  )}
                  <p className="text-[11px] text-on-surface-variant italic">
                    &quot;{step.hadithDalil.translation}&quot;
                  </p>
                </div>

                {/* KESALAHAN UMUM & TIPS SUNNAH (COLLAPSIBLE / ACCORDION) */}
                {(step.commonMistakes || step.sunnahTips) && (
                  <div className="border-t border-outline-variant/30 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedStepId((prev) => (prev === step.id ? null : step.id))
                      }
                      className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant hover:text-on-surface py-1 cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">
                          tips_and_updates
                        </span>
                        <span>Catatan Fiqih &amp; Hal yang Perlu Dihindari</span>
                      </span>
                      <span className="material-symbols-outlined text-[18px]">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="space-y-2.5 pt-2 animate-in fade-in duration-200">
                        {step.sunnahTips && (
                          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 dark:text-emerald-200 space-y-1">
                            <span className="font-bold flex items-center gap-1 text-[11px]">
                              <span className="material-symbols-outlined text-[14px]">check</span>
                              <span>Faidah Sunnah:</span>
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                              {step.sunnahTips.map((tip, i) => (
                                <li key={i}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {step.commonMistakes && (
                          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-950 dark:text-red-200 space-y-1">
                            <span className="font-bold flex items-center gap-1 text-[11px]">
                              <span className="material-symbols-outlined text-[14px]">close</span>
                              <span>Kesalahan yang Sering Terjadi:</span>
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                              {step.commonMistakes.map((mis, i) => (
                                <li key={i}>{mis}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </main>

      {/* 5. FOOTER SHORTCUT TO JADWAL & DZIKIR */}
      <footer className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-2 pb-6 w-full">
        <div className="p-4 rounded-2xl bg-surface border border-outline-variant/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="space-y-0.5">
            <h4 className="font-bold text-xs sm:text-sm text-on-surface">
              Lengkapi Ibadah dengan Dzikir Ba&apos;da Sholat
            </h4>
            <p className="text-[11px] text-on-surface-variant">
              Baca dzikir pagi petang dan doa perlindungan harian sesuai sunnah Rasulullah ﷺ.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dzikir"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Dzikir Harian
            </Link>
            <Link
              href="/sholat"
              className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 text-xs font-bold transition-colors cursor-pointer"
            >
              Jadwal Sholat
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
