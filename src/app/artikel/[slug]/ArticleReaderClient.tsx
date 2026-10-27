'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { IslamicArticle } from '@/data/initialArticles';
import ThemeToggle from '@/components/ThemeToggle';

interface ArticleReaderClientProps {
  article: IslamicArticle;
  relatedArticles: IslamicArticle[];
}

type FontSize = 'normal' | 'large' | 'xlarge';

export default function ArticleReaderClient({
  article,
  relatedArticles,
}: ArticleReaderClientProps) {
  const router = useRouter();

  // Font size setting (persisted)
  const [fontSize, setFontSize] = useState<FontSize>('normal');

  // Bookmark state (persisted)
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  // Cover image error fallback
  const [coverImgError, setCoverImgError] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Read progress bar percentage
  const [readProgress, setReadProgress] = useState<number>(0);

  // Show toast notification
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2400);
  }, []);

  // Load user preferences from localStorage
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const savedFontSize = localStorage.getItem('pk_article_font_size') as FontSize | null;
        if (savedFontSize && ['normal', 'large', 'xlarge'].includes(savedFontSize)) {
          setFontSize(savedFontSize);
        }

        const stored = localStorage.getItem('pk_saved_articles');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.includes(article.id)) {
            setIsBookmarked(true);
          }
        }
      } catch {}
    });
  }, [article.id]);

  // Track scroll reading progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100));
        setReadProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Change font size
  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    try {
      localStorage.setItem('pk_article_font_size', size);
    } catch {}
    showToast(`Ukuran teks: ${size === 'normal' ? 'Normal' : size === 'large' ? 'Sedang' : 'Besar'}`);
  };

  // Toggle bookmark
  const toggleBookmark = () => {
    try {
      const stored = localStorage.getItem('pk_saved_articles');
      let ids: string[] = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(ids)) ids = [];

      let nextSaved = false;
      if (ids.includes(article.id)) {
        ids = ids.filter((id) => id !== article.id);
        nextSaved = false;
        showToast('Artikel dihapus dari bookmark');
      } else {
        ids.push(article.id);
        nextSaved = true;
        showToast('Artikel disimpan di bookmark');
      }

      setIsBookmarked(nextSaved);
      localStorage.setItem('pk_saved_articles', JSON.stringify(ids));
    } catch {
      showToast('Gagal memperbarui bookmark');
    }
  };

  // Share to WhatsApp
  const handleShareWhatsApp = () => {
    const text = `*${article.title}*\n\nPenulis: ${article.authorName}\nSumber: ${article.sourceName}\n\nBaca artikel selengkapnya di:\n${article.canonicalUrl}\n\n_Disindikasikan melalui Peta Kajian_`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Copy link
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      showToast('Tautan artikel disalin!');
    }
  };

  // Format Indonesian date
  const formattedDate = new Date(article.publishedAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Typography scale classes
  const contentTextSizeClasses = {
    normal: 'text-base sm:text-[17px] leading-relaxed sm:leading-[1.85]',
    large: 'text-lg sm:text-[19px] leading-loose sm:leading-[2.0]',
    xlarge: 'text-xl sm:text-[22px] leading-loose sm:leading-[2.15]',
  }[fontSize];

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface pb-24 transition-colors">
      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-outline-variant/30">
        <div
          className="h-full bg-emerald-600 transition-all duration-150 ease-out"
          style={{ width: `${readProgress}%` }}
        />
      </div>

      {/* Floating Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface px-4 py-2 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* STICKY TOP APP BAR */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/40 px-3 sm:px-4 py-2.5 transition-colors">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          {/* Back button & Title snippet */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/artikel');
                }
              }}
              className="p-1.5 sm:p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              aria-label="Kembali ke daftar artikel"
            >
              <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
            </button>

            <div className="min-w-0 hidden sm:block">
              <p className="text-xs font-bold text-on-surface truncate max-w-xs md:max-w-md">
                {article.title}
              </p>
              <p className="text-[10px] text-on-surface-variant">{article.sourceName}</p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Font Size Selector Pills */}
            <div className="flex items-center bg-surface-container rounded-xl p-0.5 border border-outline-variant/50 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => handleFontSizeChange('normal')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  fontSize === 'normal'
                    ? 'bg-surface text-emerald-600 dark:text-emerald-400 shadow-2xs font-extrabold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Ukuran teks normal (16px)"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => handleFontSizeChange('large')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                  fontSize === 'large'
                    ? 'bg-surface text-emerald-600 dark:text-emerald-400 shadow-2xs font-extrabold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Ukuran teks sedang (18px)"
              >
                A+
              </button>
              <button
                type="button"
                onClick={() => handleFontSizeChange('xlarge')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-sm ${
                  fontSize === 'xlarge'
                    ? 'bg-surface text-emerald-600 dark:text-emerald-400 shadow-2xs font-extrabold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Ukuran teks besar (20px)"
              >
                A++
              </button>
            </div>

            {/* Bookmark button */}
            <button
              type="button"
              onClick={toggleBookmark}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isBookmarked
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'text-on-surface-variant hover:text-amber-500 hover:bg-surface-container'
              }`}
              title={isBookmarked ? 'Hapus bookmark' : 'Simpan artikel'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isBookmarked ? 'bookmark' : 'bookmark_border'}
              </span>
            </button>

            {/* WhatsApp Share button */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="p-2 rounded-xl text-on-surface-variant hover:text-emerald-600 hover:bg-surface-container transition-colors cursor-pointer"
              title="Bagikan ke WhatsApp"
            >
              <span className="material-symbols-outlined text-[20px]">share</span>
            </button>

            {/* Theme Toggle */}
            <ThemeToggle variant="icon" />
          </div>
        </div>
      </header>

      {/* ARTICLE CONTENT CONTAINER */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-on-surface-variant mb-4 flex-wrap">
          <Link href="/" className="hover:text-emerald-600 transition-colors">
            Beranda
          </Link>
          <span>/</span>
          <Link href="/artikel" className="hover:text-emerald-600 transition-colors">
            Artikel Islam
          </Link>
          <span>/</span>
          <span className="text-on-surface font-semibold capitalize">{article.category}</span>
        </nav>

        {/* Article Header Meta */}
        <div className="space-y-4 pb-6 border-b border-outline-variant/40">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-500/30">
              {article.sourceName}
            </span>
            <span className="text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">event</span>
              {formattedDate}
            </span>
            <span className="text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">schedule</span>
              {article.readTimeMinutes} menit baca
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight leading-snug sm:leading-tight">
            {article.title}
          </h1>

          {/* Author attribution info */}
          <div className="flex items-center gap-3 pt-2">
            <div className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-emerald-600 shrink-0">
              <span className="material-symbols-outlined text-xl">account_circle</span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">{article.authorName}</p>
              <p className="text-xs text-on-surface-variant">
                Redaksi <span className="font-semibold">{article.sourceName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* HERO COVER IMAGE (Gaya C: Hero Image pada Mode Baca) */}
        {article.imageUrl && !coverImgError && (
          <div className="mt-6 rounded-2xl sm:rounded-3xl overflow-hidden border border-outline-variant/50 bg-surface-container-high shadow-xs relative aspect-[16/9] max-h-[400px] w-full">
            <img
              src={article.imageUrl}
              alt={article.title}
              onError={() => setCoverImgError(true)}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* AMANAH ILMIAH NOTICE BANNER */}
        <div className="my-6 p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl shrink-0 mt-0.5">
              verified
            </span>
            <div className="space-y-1">
              <p className="text-xs font-bold tracking-wide uppercase text-amber-800 dark:text-amber-300">
                Amanah Ilmiah & Hak Cipta Dakwah
              </p>
              <p className="text-xs leading-relaxed text-amber-950 dark:text-amber-100">
                Artikel ini disindikasikan secara berkala dari portal dakwah{' '}
                <strong className="underline underline-offset-2">{article.sourceName}</strong>{' '}
                untuk kemaslahatan menuntut ilmu syar&apos;i kaum muslimin. Seluruh hak cipta, sanad
                keilmuan, dan naskah asli berada penuh pada penulis ustadz dan dewan redaksi penerbit.
              </p>
            </div>
          </div>
        </div>

        {/* ARTICLE BODY */}
        <article
          className={`article-prose prose prose-emerald dark:prose-invert max-w-none text-on-surface ${contentTextSizeClasses}`}
        >
          <div
            dangerouslySetInnerHTML={{ __html: article.contentHtml }}
            className="space-y-5 leading-relaxed"
          />
        </article>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-10 pt-6 border-t border-outline-variant/40 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">local_offer</span>
              Topik:
            </span>
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-xl bg-surface-container text-xs text-on-surface-variant font-medium border border-outline-variant/40"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* PROMINENT CANONICAL LINK CARD (Amanah Ilmiah & Original Link) */}
        <div className="mt-10 p-5 sm:p-6 rounded-3xl bg-surface-container border-2 border-emerald-500/30 shadow-xs space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/15 text-emerald-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">menu_book</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-on-surface">
                Rujukan Naskah Asli di {article.sourceName}
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                Ingin membaca artikel asli dengan catatan kaki kitab lengkap, bertanya fiqih langsung kepada asatidzah, atau menyimak bahasan ilmiah lainnya? Kunjungi situs resmi penerbit.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
            <a
              href={article.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              <span>Buka Naskah Asli di {article.sourceName}</span>
              <span className="material-symbols-outlined text-base">open_in_new</span>
            </a>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-surface hover:bg-surface-container-high border border-outline-variant/60 text-on-surface font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">link</span>
              <span>Salin Link</span>
            </button>
          </div>
        </div>

        {/* RELATED ARTICLES */}
        {relatedArticles.length > 0 && (
          <section className="mt-12 pt-8 border-t border-outline-variant/40 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">auto_stories</span>
                Faidah Islam Terkait
              </h2>
              <Link
                href="/artikel"
                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-0.5"
              >
                <span>Lihat Semua</span>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {relatedArticles.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/artikel/${rel.slug}`}
                  className="p-3 sm:p-4 rounded-2xl bg-surface border border-outline-variant/60 hover:border-emerald-500/40 hover:shadow-xs transition-all flex items-start gap-3 group"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-emerald-600">{rel.sourceName}</span>
                      <span className="text-on-surface-variant">{rel.readTimeMinutes} mnt baca</span>
                    </div>
                    <h3 className="font-bold text-xs sm:text-sm text-on-surface group-hover:text-emerald-600 transition-colors line-clamp-2 leading-snug">
                      {rel.title}
                    </h3>
                    <p className="text-[11px] text-on-surface-variant line-clamp-2">
                      {rel.summary}
                    </p>
                  </div>

                  {rel.imageUrl && (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-surface-container-high shrink-0 relative border border-outline-variant/30">
                      <img
                        src={rel.imageUrl}
                        alt={rel.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Floating Back to Top Button */}
      {readProgress > 30 && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-30 p-3 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-all cursor-pointer"
          aria-label="Kembali ke atas"
        >
          <span className="material-symbols-outlined text-xl">arrow_upward</span>
        </button>
      )}
    </div>
  );
}
