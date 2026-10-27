'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ARTICLE_SOURCES,
  ARTICLE_CATEGORIES,
  type IslamicArticle,
} from '@/data/initialArticles';
import ThemeToggle from '@/components/ThemeToggle';
import { createClient } from '@/utils/supabase/client';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface DbArticleRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content_html: string | null;
  canonical_url: string;
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  author_name: string | null;
  category: string | null;
  tags: string[] | null;
  image_url: string | null;
  published_at: string | null;
  read_time_minutes: number | null;
  is_featured: boolean | null;
}

interface CatalogArticleCardProps {
  article: IslamicArticle;
  isSaved: boolean;
  onToggleBookmark: (id: string) => void;
  onShare: (art: IslamicArticle) => void;
}

/**
 * Kartu Daftar Artikel Katalog (Gaya B: Side Thumbnail)
 */
function CatalogArticleCard({
  article,
  isSaved,
  onToggleBookmark,
  onShare,
}: CatalogArticleCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <article className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-surface border border-outline-variant/60 shadow-2xs hover:border-emerald-500/40 hover:shadow-sm transition-all flex flex-col justify-between gap-3 group">
      <div className="space-y-2.5">
        {/* Header Kartu: Badge Portal & Action Bookmark/Share */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-500/20">
              {article.sourceName}
            </span>
            <span className="text-[10px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">schedule</span>
              <span>{article.readTimeMinutes} mnt baca</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Bookmark */}
            <button
              type="button"
              onClick={() => onToggleBookmark(article.id)}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isSaved
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'text-on-surface-variant hover:text-amber-500'
              }`}
              title={isSaved ? 'Hapus bookmark' : 'Simpan artikel'}
            >
              <span className="material-symbols-outlined text-[17px]">
                {isSaved ? 'bookmark' : 'bookmark_border'}
              </span>
            </button>

            {/* WhatsApp Share */}
            <button
              type="button"
              onClick={() => onShare(article)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-emerald-600 cursor-pointer transition-colors"
              title="Bagikan ke WhatsApp"
            >
              <span className="material-symbols-outlined text-[17px]">share</span>
            </button>
          </div>
        </div>

        {/* Baris Tengah: Teks di Kiri, Side Thumbnail di Kanan (Gaya B) */}
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 space-y-1.5">
            <Link href={`/artikel/${article.slug}`} className="block">
              <h2 className="font-extrabold text-xs sm:text-base text-on-surface group-hover:text-emerald-600 transition-colors leading-snug line-clamp-2">
                {article.title}
              </h2>
            </Link>
            <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed line-clamp-2 sm:line-clamp-3">
              {article.summary}
            </p>
          </div>

          {/* Side Thumbnail Box (Gaya B) */}
          <Link
            href={`/artikel/${article.slug}`}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden bg-surface-container-high shrink-0 relative block border border-outline-variant/40"
          >
            {!imgError && article.imageUrl ? (
              <img
                src={article.imageUrl}
                alt={article.title}
                loading="lazy"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-600/20 via-teal-600/10 to-surface-container-high flex flex-col items-center justify-center p-2 text-center">
                <span className="material-symbols-outlined text-xl text-emerald-600/60 dark:text-emerald-400/60">
                  auto_stories
                </span>
                <span className="text-[9px] font-bold text-emerald-700/80 dark:text-emerald-300/80 mt-1 line-clamp-1">
                  {article.sourceName}
                </span>
              </div>
            )}
          </Link>
        </div>
      </div>

      {/* Footer Kartu: Penulis & Tombol Baca */}
      <div className="border-t border-outline-variant/30 pt-2.5 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-sm text-on-surface-variant shrink-0">
            account_circle
          </span>
          <span className="text-[11px] text-on-surface-variant font-medium truncate max-w-[150px] sm:max-w-[200px]">
            {article.authorName}
          </span>
        </div>

        <Link
          href={`/artikel/${article.slug}`}
          className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors shrink-0"
        >
          <span>Baca</span>
          <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </Link>
      </div>
    </article>
  );
}

/**
 * Skeleton Loader Kartu Artikel (Identik dengan layout CatalogArticleCard)
 */
function CatalogArticleCardSkeleton() {
  return (
    <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-surface border border-outline-variant/60 shadow-2xs space-y-3 min-h-[175px] flex flex-col justify-between animate-pulse">
      <div className="space-y-3">
        {/* Header Kartu: Badge & Actions Placeholder */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 rounded-full bg-surface-container-high" />
            <div className="h-3 w-16 rounded-md bg-surface-container" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-surface-container" />
            <div className="w-7 h-7 rounded-lg bg-surface-container" />
          </div>
        </div>

        {/* Tengah: Teks di kiri, Thumbnail di kanan */}
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 rounded-md bg-surface-container-high w-full" />
            <div className="h-4 rounded-md bg-surface-container-high w-4/5" />
            <div className="h-3 rounded-md bg-surface-container w-full pt-1" />
            <div className="h-3 rounded-md bg-surface-container w-2/3" />
          </div>
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl bg-surface-container-high shrink-0" />
        </div>
      </div>

      {/* Footer Kartu */}
      <div className="border-t border-outline-variant/30 pt-2.5 flex items-center justify-between gap-2">
        <div className="h-3 w-28 rounded-md bg-surface-container" />
        <div className="h-3 w-12 rounded-md bg-surface-container-high" />
      </div>
    </div>
  );
}

export default function ArtikelIndexPage() {
  const router = useRouter();
  const PAGE_SIZE = 12;

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Articles & Pagination state
  const [articles, setArticles] = useState<IslamicArticle[]>([]);
  const [page, setPage] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Sentinel ref for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Bookmarks state (syncs with localStorage)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2400);
  }, []);

  // Muat bookmark dari localStorage saat client mount
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem('pk_saved_articles');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setBookmarkedIds(new Set(parsed));
          }
        }
      } catch {}
    });
  }, []);

  // Fungsi pengambilan artikel dengan paginasi dan filter server-side
  const fetchArticles = useCallback(
    async (pageToFetch: number, isInitial = false) => {
      try {
        if (isInitial) {
          setLoadingInitial(true);
        } else {
          setLoadingMore(true);
        }

        const supabase = createClient();
        let query = supabase
          .from('articles')
          .select('*', { count: 'exact' })
          .eq('is_published', true);

        // 1. Filter Bookmark
        if (selectedCategory === 'saved') {
          if (bookmarkedIds.size === 0) {
            setArticles([]);
            setTotalCount(0);
            setHasMore(false);
            setLoadingInitial(false);
            setLoadingMore(false);
            return;
          }
          query = query.in('id', Array.from(bookmarkedIds));
        } else if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        // 2. Filter Portal Sumber
        if (selectedSource !== 'all') {
          query = query.or(`source_slug.eq.${selectedSource},source_name.ilike.%${selectedSource}%`);
        }

        // 3. Search Query
        const q = debouncedSearch.trim();
        if (q) {
          query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,author_name.ilike.%${q}%`);
        }

        const from = pageToFetch * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        query = query.order('published_at', { ascending: false }).range(from, to);

        const { data, count, error } = await query;

        if (!error && data) {
          const typedData = data as unknown as (DbArticleRow & { source_slug?: string | null })[];
          const mapped: IslamicArticle[] = typedData.map((d) => ({
            id: d.id,
            title: d.title,
            slug: d.slug,
            summary: d.summary || '',
            contentHtml: d.content_html || '',
            canonicalUrl: d.canonical_url,
            sourceId: d.source_slug || d.source_id || 'portal',
            sourceName: d.source_name || 'Portal Sunnah',
            sourceUrl: d.source_url || d.canonical_url,
            authorName: d.author_name || 'Asatidzah Ahlus Sunnah',
            category: d.category || 'umum',
            tags: d.tags || [],
            imageUrl: d.image_url || undefined,
            publishedAt: d.published_at || new Date().toISOString(),
            readTimeMinutes: d.read_time_minutes || 3,
            isFeatured: d.is_featured || false,
          }));

          if (isInitial) {
            setArticles(mapped);
          } else {
            setArticles((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const fresh = mapped.filter((m) => !existingIds.has(m.id));
              return [...prev, ...fresh];
            });
          }

          setTotalCount(count ?? 0);
          setPage(pageToFetch);
          const reachedEnd = mapped.length < PAGE_SIZE || (from + mapped.length) >= (count ?? 0);
          setHasMore(!reachedEnd);
        } else {
          if (isInitial) {
            setArticles([]);
            setTotalCount(0);
          }
          setHasMore(false);
        }
      } catch {
        if (isInitial) {
          setArticles([]);
          setTotalCount(0);
        }
        setHasMore(false);
      } finally {
        setLoadingInitial(false);
        setLoadingMore(false);
      }
    },
    [selectedCategory, selectedSource, debouncedSearch, bookmarkedIds]
  );

  // Reset dan muat ulang halaman pertama saat filter atau query pencarian berubah
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchArticles(0, true);
  }, [fetchArticles]);

  // Load more trigger
  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || loadingInitial) return;
    fetchArticles(page + 1, false);
  }, [hasMore, loadingMore, loadingInitial, page, fetchArticles]);

  // IntersectionObserver untuk Infinite Scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  // Toggle bookmark
  const toggleBookmark = useCallback(
    (articleId: string) => {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (next.has(articleId)) {
          next.delete(articleId);
          showToast('Artikel dihapus dari tersimpan');
        } else {
          next.add(articleId);
          showToast('Artikel disimpan untuk dibaca nanti');
        }
        try {
          localStorage.setItem('pk_saved_articles', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    },
    [showToast]
  );

  // Share artikel ke WhatsApp
  const handleShareWhatsApp = useCallback((article: IslamicArticle) => {
    const text = `*${article.title}*\nOleh: ${article.authorName} (${article.sourceName})\n\n"${article.summary}"\n\n📖 Baca selengkapnya di:\nhttps://petakajian.id/artikel/${article.slug}\n\n📌 Sumber rujukan asli:\n${article.canonicalUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-surface font-geist flex flex-col pb-[calc(76px+env(safe-area-inset-bottom,16px))] md:pb-12">
      {/* TOAST ALERT */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface px-4 py-2 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. STICKY HEADER */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-outline-variant/60 shadow-2xs">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
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
                  Artikel &amp; Faidah Islam
                </h1>
                <span className="px-1.5 py-0.2 rounded bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  Sunnah
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium leading-none truncate">
                Disindikasikan resmi dari portal dakwah Ahlus Sunnah terpercaya
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggle variant="icon" />
          </div>
        </div>
      </header>

      {/* 2. HERO BANNER: AMANAH ILMIAH */}
      <section className="max-w-5xl mx-auto px-3.5 sm:px-6 pt-3.5 sm:pt-5 w-full">
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-linear-to-br from-emerald-950 via-teal-900 to-slate-900 text-white shadow-sm border border-emerald-500/20 relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold tracking-wide uppercase text-emerald-200">
                Amanah Ilmiah &amp; Rujukan Shahih
              </span>
              <span className="text-[10px] text-emerald-200 font-mono">Muqaddimah Shahih Muslim</span>
            </div>

            <p className="text-right font-serif text-base sm:text-lg text-amber-200 leading-relaxed" dir="rtl">
              «إِنَّ هَذَا الْعِلْمَ دِينٌ فَانْظُرُوا عَمَّنْ تَأْخُذُونَ دِينَكُمْ»
            </p>

            <p className="text-xs sm:text-sm text-emerald-100 font-medium italic">
              &quot;Sesungguhnya ilmu ini adalah agama, maka perhatikanlah dari siapa kalian mengambil agama kalian.&quot;
            </p>
            <p className="text-[11px] text-emerald-200/80 leading-relaxed">
              Seluruh artikel disindikasikan dari portal dakwah Ahlus Sunnah bermanhaj salaf (Muslim.or.id, Rumaysho, Konsultasi Syariah, Almanhaj) dengan tetap menyertakan nama asatidzah penulis dan tautan naskah asli (*canonical link*).
            </p>
          </div>
          <div className="absolute -right-6 -bottom-8 text-white/5 pointer-events-none select-none">
            <span className="material-symbols-outlined text-[140px]">auto_stories</span>
          </div>
        </div>
      </section>

      {/* 3. CONTROLS: SEARCH, PORTAL FILTER & TOPIC FILTER */}
      <section className="max-w-5xl mx-auto px-3.5 sm:px-6 pt-3.5 w-full space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul artikel, topik fiqih, atau nama ustadz..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-surface border border-outline-variant/60 focus:border-emerald-500 focus:outline-hidden text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant/70 shadow-2xs transition-colors"
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

        {/* Portal Sumber Filter */}
        <div className="space-y-1">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant px-0.5 flex items-center justify-between">
            <span>Pilih Portal Sumber:</span>
            <span>{ARTICLE_SOURCES.length} Portal Terverifikasi</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedSource('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                selectedSource === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-surface text-on-surface-variant hover:text-on-surface border-outline-variant/50 hover:bg-surface-container'
              }`}
            >
              Semua Portal
            </button>
            {ARTICLE_SOURCES.map((src) => {
              const isSelected = selectedSource === src.id;
              return (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setSelectedSource(src.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-surface text-on-surface-variant hover:text-on-surface border-outline-variant/50 hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{src.icon}</span>
                  <span>{src.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Topik Tematik Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {ARTICLE_CATEGORIES.map((cat) => {
            const isCatActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                  isCatActive
                    ? 'bg-surface-container text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                    : 'bg-surface text-on-surface-variant hover:text-on-surface border-outline-variant/40'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
                <span>{cat.label}</span>
                {cat.id === 'saved' && bookmarkedIds.size > 0 && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.1 rounded-full bg-emerald-600 text-white">
                    {bookmarkedIds.size}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Counter Info */}
        <div className="flex items-center justify-between text-[11px] text-on-surface-variant px-0.5">
          <span>
            {loadingInitial ? (
              <span className="italic text-emerald-600 animate-pulse">Memuat data artikel...</span>
            ) : totalCount !== null ? (
              <>
                Menampilkan <strong className="text-on-surface">{articles.length}</strong>
                {totalCount > articles.length && (
                  <> dari <strong className="text-on-surface">{totalCount}</strong></>
                )}{' '}
                artikel &amp; faidah
              </>
            ) : (
              <>Menampilkan <strong className="text-on-surface">{articles.length}</strong> artikel &amp; faidah</>
            )}
          </span>
          {loadingMore && (
            <span className="italic text-emerald-600 animate-pulse flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Memuat berikutnya...</span>
            </span>
          )}
        </div>
      </section>

      {/* 4. DAFTAR KARTU ARTIKEL DENGAN INFINITE SCROLL */}
      <main className="w-full max-w-5xl mx-auto px-3.5 sm:px-6 pt-2 pb-6 space-y-3.5 flex-1">
        {loadingInitial ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <CatalogArticleCardSkeleton key={n} />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="py-14 px-4 text-center flex flex-col items-center justify-center space-y-3 rounded-3xl bg-surface border border-outline-variant/40">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px]">
                {selectedCategory === 'saved' ? 'bookmark_border' : 'menu_book'}
              </span>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-on-surface">
                {selectedCategory === 'saved'
                  ? 'Belum ada artikel yang disimpan'
                  : 'Artikel tidak ditemukan'}
              </h3>
              <p className="text-xs text-on-surface-variant max-w-sm">
                {selectedCategory === 'saved'
                  ? 'Tandai artikel dengan ikon bookmark untuk menyimpannya di daftar bacaan offline.'
                  : debouncedSearch
                  ? `Tidak ada artikel yang cocok dengan pencarian "${debouncedSearch}". Coba gunakan kata kunci lain.`
                  : 'Data artikel di database kosong. Jalankan sinkronisasi dari dashboard cron admin untuk memuat artikel terbaru.'}
              </p>
            </div>
            {(searchQuery || selectedSource !== 'all' || selectedCategory !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSource('all');
                  setSelectedCategory('all');
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 text-xs font-bold transition-colors cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {articles.map((article) => (
                <CatalogArticleCard
                  key={article.id}
                  article={article}
                  isSaved={bookmarkedIds.has(article.id)}
                  onToggleBookmark={toggleBookmark}
                  onShare={handleShareWhatsApp}
                />
              ))}

              {/* Skeleton cards saat pengguna scroll ke bawah untuk memuat batch selanjutnya */}
              {loadingMore && (
                <>
                  <CatalogArticleCardSkeleton />
                  <CatalogArticleCardSkeleton />
                </>
              )}
            </div>

            {/* Sentinel invisible element untuk IntersectionObserver */}
            <div ref={sentinelRef} className="h-4 w-full pointer-events-none" />

            {/* Indikator Akhir Halaman */}
            {!hasMore && articles.length > 0 && (
              <div className="py-6 text-center text-xs text-on-surface-variant/70 border-t border-outline-variant/30 flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">
                  check_circle
                </span>
                <span>Semua artikel telah dimuat ({totalCount ?? articles.length} artikel)</span>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
