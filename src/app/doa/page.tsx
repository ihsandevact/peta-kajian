'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DOA_ITEMS,
  DOA_CATEGORIES,
  type DoaItem,
  type DoaCategory,
} from '@/data/doaData';
import ThemeToggle from '@/components/ThemeToggle';

export default function DoaPage() {
  const router = useRouter();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'saved' | DoaCategory>('all');

  // Bookmarks state (syncs with localStorage)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // Typography & preference states
  const [arabicFontSize, setArabicFontSize] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [showLatin, setShowLatin] = useState(true);

  // User feedback states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Muat bookmark dan preferensi dari localStorage saat pertama kali dimuat
  useEffect(() => {
    try {
      const storedBookmarks = localStorage.getItem('doa_saved_bookmarks');
      if (storedBookmarks) {
        const parsed = JSON.parse(storedBookmarks);
        if (Array.isArray(parsed)) {
          setBookmarkedIds(new Set(parsed));
        }
      }

      const storedFontSize = localStorage.getItem('doa_font_size');
      if (storedFontSize === 'normal' || storedFontSize === 'large' || storedFontSize === 'xlarge') {
        setArabicFontSize(storedFontSize);
      }

      const storedShowLatin = localStorage.getItem('doa_show_latin');
      if (storedShowLatin !== null) {
        setShowLatin(storedShowLatin === 'true');
      }
    } catch {
      // Abaikan jika localStorage tidak dapat diakses
    }
  }, []);

  // Tampilkan toast sementara
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2500);
  }, []);

  // Simpan bookmark
  const toggleBookmark = useCallback(
    (id: string) => {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        const isCurrentlySaved = next.has(id);
        if (isCurrentlySaved) {
          next.delete(id);
          showToast('Dihapus dari doa tersimpan');
        } else {
          next.add(id);
          showToast('Doa disimpan ke favorit');
        }

        // Haptic feedback jika didukung perangkat
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(30);
          } catch {}
        }

        try {
          localStorage.setItem('doa_saved_bookmarks', JSON.stringify(Array.from(next)));
        } catch {}

        return next;
      });
    },
    [showToast]
  );

  // Ubah ukuran font Arab
  const handleFontSizeChange = useCallback((size: 'normal' | 'large' | 'xlarge') => {
    setArabicFontSize(size);
    try {
      localStorage.setItem('doa_font_size', size);
    } catch {}
  }, []);

  // Toggle transliterasi Latin
  const handleToggleLatin = useCallback(() => {
    setShowLatin((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('doa_show_latin', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Salin doa ke clipboard
  const handleCopyDoa = useCallback(
    async (item: DoaItem) => {
      const copyText = [
        item.title,
        '',
        item.arabic,
        '',
        item.transliteration ? `${item.transliteration}\n` : '',
        `Artinya:`,
        `"${item.translation}"`,
        '',
        `(${item.narrator})`,
        item.faedah ? `\nCatatan / Faedah:\n${item.faedah}` : '',
        '',
        'Sumber: Hisnul Muslim via Peta Kajian (petakajian.id/doa)',
      ]
        .filter(Boolean)
        .join('\n');

      try {
        await navigator.clipboard.writeText(copyText);
        setCopiedId(item.id);
        showToast('Doa berhasil disalin ke clipboard');
        setTimeout(() => {
          setCopiedId((curr) => (curr === item.id ? null : curr));
        }, 2000);
      } catch {
        showToast('Gagal menyalin doa');
      }
    },
    [showToast]
  );

  // Bagikan doa via Web Share API atau WhatsApp
  const handleShareDoa = useCallback(
    async (item: DoaItem) => {
      const shareText = `*${item.title}*\n\n${item.arabic}\n\n*Artinya:*\n"${item.translation}"\n\n_${item.narrator}_\n\nPelajari doa sunnah lainnya di Peta Kajian:\nhttps://petakajian.id/doa`;

      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: item.title,
            text: shareText,
            url: 'https://petakajian.id/doa',
          });
          return;
        } catch {
          // User membatalkan dialog share atau browser fallback
        }
      }

      // Fallback direct WhatsApp URL
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    },
    []
  );

  // Filter daftar doa berdasarkan kategori & query pencarian
  const filteredDoaItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return DOA_ITEMS.filter((item) => {
      // 1. Filter Kategori
      if (selectedCategory === 'saved') {
        if (!bookmarkedIds.has(item.id)) return false;
      } else if (selectedCategory !== 'all') {
        if (item.category !== selectedCategory) return false;
      }

      // 2. Filter Pencarian Teks
      if (!q) return true;

      const matchTitle = item.title.toLowerCase().includes(q);
      const matchTranslation = item.translation.toLowerCase().includes(q);
      const matchTransliteration = item.transliteration?.toLowerCase().includes(q);
      const matchNarrator = item.narrator.toLowerCase().includes(q);
      const matchFaedah = item.faedah?.toLowerCase().includes(q);
      const matchCategoryLabel = item.categoryLabel.toLowerCase().includes(q);

      return (
        matchTitle ||
        matchTranslation ||
        matchTransliteration ||
        matchNarrator ||
        matchFaedah ||
        matchCategoryLabel
      );
    });
  }, [searchQuery, selectedCategory, bookmarkedIds]);

  // Class ukuran teks Arab
  const arabicTextClass = useMemo(() => {
    switch (arabicFontSize) {
      case 'xlarge':
        return 'text-2xl sm:text-3xl leading-[2.6] sm:leading-[2.8]';
      case 'normal':
        return 'text-lg sm:text-xl leading-[2.1] sm:leading-[2.3]';
      case 'large':
      default:
        return 'text-xl sm:text-2xl leading-[2.3] sm:leading-[2.5]';
    }
  }, [arabicFontSize]);

  return (
    <div className="min-h-screen bg-background text-on-surface font-geist flex flex-col pb-[calc(76px+env(safe-area-inset-bottom,16px))] md:pb-12">
      {/* 1. TOP NAVBAR HEADER */}
      <header className="sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b border-outline-variant/40 transition-colors">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Tombol Kembali & Judul Halaman */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/');
                }
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 cursor-pointer transition-colors shrink-0"
              aria-label="Kembali"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-on-surface truncate">
                Doa Harian Sunnah
              </h1>
              <p className="text-[10px] sm:text-xs text-emerald-700 dark:text-emerald-400 font-bold leading-none truncate">
                Hisnul Muslim &amp; Dalil Shahih
              </p>
            </div>
          </div>

          {/* Action Toolbar Kanan */}
          <div className="flex items-center gap-2">
            <ThemeToggle variant="icon" size="sm" />
          </div>
        </div>
      </header>

      {/* 2. SEARCH BAR & QUICK FILTERS */}
      <section className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 pb-2 space-y-3">
        {/* Input Pencarian */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari doa, terjemahan, atau situasi..."
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-on-surface cursor-pointer"
              aria-label="Hapus pencarian"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Carousel Kategori Doa */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {DOA_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            const isSaved = cat.id === 'saved';
            const savedCount = bookmarkedIds.size;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface border-outline-variant/50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                <span>{cat.label}</span>
                {isSaved && savedCount > 0 && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {savedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. PENGATURAN TAMPILAN & JUMLAH HASIL */}
      <section className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 text-xs">
          {/* Info Jumlah Hasil */}
          <div className="flex items-center gap-1.5 text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">
              menu_book
            </span>
            <span>
              Menampilkan{' '}
              <strong className="text-on-surface font-extrabold">{filteredDoaItems.length}</strong>{' '}
              doa
            </span>
          </div>

          {/* Controls: Ukuran Font & Toggle Latin */}
          <div className="flex items-center gap-2">
            {/* Toggle Latin */}
            <button
              type="button"
              onClick={handleToggleLatin}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                showLatin
                  ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-surface-container text-on-surface-variant border-outline-variant/40 hover:text-on-surface'
              }`}
              title="Tampilkan / Sembunyikan transliterasi latin"
            >
              <span>Latin:</span>
              <span className="font-extrabold">{showLatin ? 'ON' : 'OFF'}</span>
            </button>

            {/* Font Size Selector */}
            <div className="inline-flex rounded-lg bg-surface-container border border-outline-variant/40 p-0.5">
              <button
                type="button"
                onClick={() => handleFontSizeChange('normal')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
                  arabicFontSize === 'normal'
                    ? 'bg-emerald-600 text-white shadow-xs'
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
                    ? 'bg-emerald-600 text-white shadow-xs'
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
                    ? 'bg-emerald-600 text-white shadow-xs'
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

      {/* 4. DAFTAR KARTU DOA */}
      <main className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-2 pb-6 space-y-4 flex-1">
        {filteredDoaItems.length === 0 ? (
          // Empty State
          <div className="py-14 px-4 text-center flex flex-col items-center justify-center space-y-3 rounded-3xl bg-surface border border-outline-variant/40">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px]">
                {selectedCategory === 'saved' ? 'bookmark_border' : 'search_off'}
              </span>
            </div>
            <div className="max-w-sm">
              <h3 className="font-extrabold text-base text-on-surface">
                {selectedCategory === 'saved'
                  ? 'Belum Ada Doa Tersimpan'
                  : 'Doa Tidak Ditemukan'}
              </h3>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                {selectedCategory === 'saved'
                  ? 'Simpan doa favorit Anda dengan mengetuk ikon bintang pada kartu doa agar dapat dibaca kembali dengan cepat.'
                  : `Tidak ada doa yang cocok dengan kata kunci "${searchQuery}". Coba kata kunci lain atau pilih kategori lain.`}
              </p>
            </div>
            {selectedCategory === 'saved' ? (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Jelajahi Semua Doa
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 text-xs font-bold transition-colors cursor-pointer"
              >
                Reset Pencarian
              </button>
            )}
          </div>
        ) : (
          filteredDoaItems.map((item, idx) => {
            const isSaved = bookmarkedIds.has(item.id);
            const isCopied = copiedId === item.id;

            return (
              <article
                key={item.id}
                id={item.id}
                className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-surface border border-outline-variant/60 shadow-xs hover:border-emerald-500/30 transition-all flex flex-col gap-4"
              >
                {/* Header Kartu: Kategori, Nomor, Judul & Action Buttons */}
                <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 pb-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold tracking-wide">
                        {item.categoryLabel}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-mono">
                        #{idx + 1}
                      </span>
                    </div>
                    <h2 className="font-extrabold text-sm sm:text-base text-on-surface">
                      {item.title}
                    </h2>
                  </div>

                  {/* Action Buttons: Bookmark, Copy, Share */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Bookmark Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleBookmark(item.id)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isSaved
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 scale-105'
                          : 'bg-surface-container text-on-surface-variant hover:text-amber-500 hover:bg-surface-container-high border border-outline-variant/40'
                      }`}
                      aria-label={isSaved ? 'Hapus dari tersimpan' : 'Simpan doa'}
                      title={isSaved ? 'Hapus dari tersimpan' : 'Simpan doa'}
                    >
                      <span
                        className={`material-symbols-outlined text-[18px] ${
                          isSaved ? 'fill-[1]' : ''
                        }`}
                      >
                        star
                      </span>
                    </button>

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyDoa(item)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-outline-variant/40'
                      }`}
                      aria-label="Salin doa"
                      title="Salin doa ke clipboard"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isCopied ? 'check' : 'content_copy'}
                      </span>
                    </button>

                    {/* WhatsApp Share Button */}
                    <button
                      type="button"
                      onClick={() => handleShareDoa(item)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center bg-surface-container text-on-surface-variant hover:text-emerald-600 hover:bg-surface-container-high border border-outline-variant/40 transition-all cursor-pointer"
                      aria-label="Bagikan doa"
                      title="Bagikan via WhatsApp"
                    >
                      <span className="material-symbols-outlined text-[18px]">share</span>
                    </button>
                  </div>
                </div>

                {/* Teks Bacaan Arab */}
                <div className="py-2 text-right" dir="rtl">
                  <p
                    className={`font-serif text-on-surface selection:bg-emerald-500/25 ${arabicTextClass}`}
                  >
                    {item.arabic}
                  </p>
                </div>

                {/* Transliterasi Latin (Jika Aktif & Tersedia) */}
                {showLatin && item.transliteration && (
                  <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant italic leading-relaxed">
                    {item.transliteration}
                  </div>
                )}

                {/* Terjemahan Bahasa Indonesia */}
                <div className="border-t border-outline-variant/30 pt-3">
                  <p className="text-xs sm:text-sm text-on-surface leading-relaxed font-medium">
                    {item.translation}
                  </p>
                </div>

                {/* Footnote Perawi / Dalil Hadits */}
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">
                    verified
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {item.narrator}
                  </span>
                </div>

                {/* Kotak Faedah & Keutamaan (Jika ada) */}
                {item.faedah && (
                  <div className="p-3 rounded-xl sm:rounded-2xl bg-emerald-600/5 dark:bg-emerald-950/40 border border-emerald-500/20 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      lightbulb
                    </span>
                    <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed">
                      <strong className="text-emerald-700 dark:text-emerald-300 font-bold">
                        Faedah Sunnah:{' '}
                      </strong>
                      {item.faedah}
                    </p>
                  </div>
                )}
              </article>
            );
          })
        )}
      </main>

      {/* 5. FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="px-4 py-2 rounded-full bg-slate-900/90 text-white dark:bg-white/90 dark:text-slate-900 shadow-xl backdrop-blur-md text-xs font-bold flex items-center gap-2 border border-white/10">
            <span className="material-symbols-outlined text-[16px] text-emerald-400 dark:text-emerald-600">
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
