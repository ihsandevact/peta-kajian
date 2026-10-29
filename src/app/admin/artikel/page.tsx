'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { checkIsAdmin } from '@/lib/services/admin';
import { ARTICLE_SOURCES } from '@/data/initialArticles';
import {
  getAdminArticlesAction,
  createArticleAction,
  updateArticleAction,
  toggleArticlePublishAction,
  toggleArticleFeaturedAction,
  deleteArticleAction,
  syncArticlesRssAction,
  type AdminArticleRow,
  type AdminArticlesStats,
  type ArticleFormInput,
} from '@/app/actions/articles';
import type { SyncArticlesReport } from '@/lib/services/articleSync';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useConfirm } from '@/context/ConfirmDialogContext';

const ADMIN_CATEGORIES = [
  { id: 'aqidah', label: 'Aqidah & Tauhid' },
  { id: 'ibadah', label: 'Fiqih & Ibadah' },
  { id: 'akhlak', label: 'Akhlak & Hati' },
  { id: 'muamalah', label: 'Muamalah & Fiqih' },
  { id: 'keluarga', label: 'Keluarga & Adab' },
  { id: 'umum', label: 'Umum / Lainnya' },
] as const;

const SOURCE_PRESETS = [
  {
    slug: 'peta-kajian',
    name: 'Redaksi Peta Kajian',
    url: 'https://petakajian.id',
    defaultAuthor: 'Redaksi Peta Kajian',
  },
  ...ARTICLE_SOURCES.map((s) => ({
    slug: s.slug,
    name: s.name,
    url: s.websiteUrl,
    defaultAuthor: s.defaultAuthor,
  })),
];

function slugifyTitle(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 85);
}

export default function AdminArticlesPage() {
  const confirmDialog = useConfirm();
  const PAGE_SIZE = 15;

  // Auth & Loading State
  const [authChecking, setAuthChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // Articles Data & Stats
  const [articles, setArticles] = useState<AdminArticleRow[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [stats, setStats] = useState<AdminArticlesStats>({
    totalCount: 0,
    publishedCount: 0,
    draftCount: 0,
    featuredCount: 0,
  });

  // Filters & Pagination
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'featured'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Toast & Processing
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // RSS Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncArticlesReport | null>(null);

  // Create / Edit Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<AdminArticleRow | null>(null);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    slug: string;
    summary: string;
    content_html: string;
    category: string;
    author_name: string;
    source_slug: string;
    source_name: string;
    source_url: string;
    canonical_url: string;
    image_url: string;
    tags_text: string;
    read_time_minutes: number;
    is_published: boolean;
    is_featured: boolean;
  }>({
    title: '',
    slug: '',
    summary: '',
    content_html: '',
    category: 'aqidah',
    author_name: 'Redaksi Peta Kajian',
    source_slug: 'peta-kajian',
    source_name: 'Redaksi Peta Kajian',
    source_url: 'https://petakajian.id',
    canonical_url: '',
    image_url: '',
    tags_text: '',
    read_time_minutes: 4,
    is_published: true,
    is_featured: false,
  });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  // Load articles list
  const loadArticles = useCallback(
    async (targetPage: number) => {
      setLoadingList(true);
      const res = await getAdminArticlesAction({
        page: targetPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        category: categoryFilter,
        source: sourceFilter,
        status: statusFilter,
      });

      if (res.success) {
        setArticles(res.articles);
        setFilteredTotal(res.filteredTotal);
        setStats(res.stats);
      } else if (res.error) {
        showToast(res.error);
      }
      setLoadingList(false);
    },
    [PAGE_SIZE, debouncedSearch, categoryFilter, sourceFilter, statusFilter, showToast]
  );

  // Check Admin Auth on Mount
  useEffect(() => {
    async function initAuth() {
      setAuthChecking(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAuthChecking(false);
        return;
      }

      const admin = await checkIsAdmin(user);
      setIsAdmin(admin);
      setAuthChecking(false);
    }
    initAuth();
  }, []);

  // Reset page to 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, categoryFilter, sourceFilter]);

  // Fetch when page or filters change
  useEffect(() => {
    if (isAdmin) {
      loadArticles(page);
    }
  }, [isAdmin, page, loadArticles]);

  // Open Modal for Creating New Article
  const handleOpenCreateModal = () => {
    setEditingArticle(null);
    setSlugManuallyEdited(false);
    setEditorTab('write');
    setFormError(null);
    setFormData({
      title: '',
      slug: '',
      summary: '',
      content_html:
        '<p>Tuliskan pembukaan artikel di sini...</p>\n\n<h3>Subjudul Pembahasan</h3>\n<p>Jelaskan poin pembahasan beserta dalilnya:</p>\n<blockquote><p>مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ</p><p><em>"Barangsiapa menempuh suatu jalan untuk mencari ilmu (agama), niscaya Allah akan memudahkan baginya jalan menuju surga."</em> (HR. Muslim no. 2699)</p></blockquote>',
      category: 'aqidah',
      author_name: 'Asatidzah Pembina',
      source_slug: 'peta-kajian',
      source_name: 'Redaksi Peta Kajian',
      source_url: 'https://petakajian.id',
      canonical_url: '',
      image_url: '',
      tags_text: 'Ilmu Syar\'i, Faidah, Sunnah',
      read_time_minutes: 4,
      is_published: true,
      is_featured: false,
    });
    setIsEditorOpen(true);
  };

  // Open Modal for Editing Existing Article
  const handleOpenEditModal = (article: AdminArticleRow) => {
    setEditingArticle(article);
    setSlugManuallyEdited(true);
    setEditorTab('write');
    setFormError(null);
    setFormData({
      title: article.title || '',
      slug: article.slug || '',
      summary: article.summary || '',
      content_html: article.content_html || '',
      category: article.category || 'umum',
      author_name: article.author_name || 'Asatidzah',
      source_slug: article.source_slug || 'peta-kajian',
      source_name: article.source_name || 'Redaksi Peta Kajian',
      source_url: article.source_url || 'https://petakajian.id',
      canonical_url: article.canonical_url || '',
      image_url: article.image_url || '',
      tags_text: Array.isArray(article.tags) ? article.tags.join(', ') : '',
      read_time_minutes: article.read_time_minutes || 4,
      is_published: article.is_published ?? true,
      is_featured: Boolean(article.is_featured),
    });
    setIsEditorOpen(true);
  };

  // Handle Source Preset Change in Modal
  const handleSourceChange = (selectedSlug: string) => {
    const preset = SOURCE_PRESETS.find((s) => s.slug === selectedSlug);
    if (preset) {
      setFormData((prev) => ({
        ...prev,
        source_slug: preset.slug,
        source_name: preset.name,
        source_url: preset.url,
        author_name:
          !prev.author_name || prev.author_name === 'Redaksi Peta Kajian'
            ? preset.defaultAuthor
            : prev.author_name,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        source_slug: selectedSlug,
      }));
    }
  };

  // Helper to Insert/Wrap HTML Tag in Content Textarea
  const insertHtmlSnippet = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = formData.content_html;
    const selected = current.substring(start, end);
    const inner = selected || placeholder;
    const replacement = `${before}${inner}${after}`;

    const nextHtml = current.substring(0, start) + replacement + current.substring(end);
    setFormData((prev) => ({ ...prev, content_html: nextHtml }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + inner.length);
    }, 15);
  };

  // Handle Save (Create or Update)
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingForm(true);
    setFormError(null);

    const tagsArray = formData.tags_text
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: ArticleFormInput = {
      title: formData.title,
      slug: formData.slug,
      summary: formData.summary,
      content_html: formData.content_html,
      category: formData.category,
      author_name: formData.author_name,
      source_slug: formData.source_slug,
      source_name: formData.source_name,
      source_url: formData.source_url,
      canonical_url: formData.canonical_url,
      image_url: formData.image_url || null,
      tags: tagsArray,
      read_time_minutes: Number(formData.read_time_minutes) || 4,
      is_published: formData.is_published,
      is_featured: formData.is_featured,
    };

    try {
      if (editingArticle) {
        const res = await updateArticleAction(editingArticle.id, payload);
        if (res.success) {
          setIsEditorOpen(false);
          showToast(`Artikel "${formData.title.slice(0, 35)}..." berhasil diperbarui!`);
          await loadArticles(page);
        } else {
          setFormError(res.error || 'Gagal memperbarui artikel.');
        }
      } else {
        const res = await createArticleAction(payload);
        if (res.success) {
          setIsEditorOpen(false);
          showToast(`Artikel baru "${formData.title.slice(0, 35)}..." berhasil diterbitkan!`);
          setPage(0);
          await loadArticles(0);
        } else {
          setFormError(res.error || 'Gagal menyimpan artikel baru.');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan saat menyimpan artikel.');
    } finally {
      setSavingForm(false);
    }
  };

  // Handle Quick Toggle Publish
  const handleTogglePublish = async (article: AdminArticleRow) => {
    setProcessingId(article.id);
    const nextState = !article.is_published;
    const res = await toggleArticlePublishAction(article.id, nextState);
    if (res.success) {
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, is_published: nextState } : a))
      );
      setStats((prev) => ({
        ...prev,
        publishedCount: nextState ? prev.publishedCount + 1 : Math.max(0, prev.publishedCount - 1),
        draftCount: nextState ? Math.max(0, prev.draftCount - 1) : prev.draftCount + 1,
      }));
      showToast(
        nextState
          ? `Artikel "${article.title.slice(0, 30)}..." kini TAYANG ke publik.`
          : `Artikel "${article.title.slice(0, 30)}..." disimpan sebagai DRAFT.`
      );
    } else {
      showToast(res.error || 'Gagal mengubah status publikasi.');
    }
    setProcessingId(null);
  };

  // Handle Quick Toggle Featured
  const handleToggleFeatured = async (article: AdminArticleRow) => {
    setProcessingId(article.id);
    const nextState = !article.is_featured;
    const res = await toggleArticleFeaturedAction(article.id, nextState);
    if (res.success) {
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, is_featured: nextState } : a))
      );
      setStats((prev) => ({
        ...prev,
        featuredCount: nextState ? prev.featuredCount + 1 : Math.max(0, prev.featuredCount - 1),
      }));
      showToast(
        nextState
          ? `Artikel ditandai sebagai Artikel Pilihan (Featured ⭐).`
          : `Status Artikel Pilihan dilepas.`
      );
    } else {
      showToast(res.error || 'Gagal mengubah status featured.');
    }
    setProcessingId(null);
  };

  // Handle Delete Article
  const handleDeleteArticle = async (article: AdminArticleRow) => {
    const confirmed = await confirmDialog({
      title: 'Hapus Artikel Islam?',
      description: `Apakah Anda yakin ingin menghapus artikel "${article.title}" (${article.source_name || 'Portal'}) secara permanen dari database?`,
      confirmText: 'Ya, Hapus Permanen',
      cancelText: 'Batal',
      variant: 'danger',
      icon: 'delete',
    });
    if (!confirmed) return;

    setProcessingId(article.id);
    const res = await deleteArticleAction(article.id);
    if (res.success) {
      showToast(`Artikel "${article.title.slice(0, 32)}..." berhasil dihapus.`);
      await loadArticles(page);
    } else {
      showToast(res.error || 'Gagal menghapus artikel.');
    }
    setProcessingId(null);
  };

  // Handle Manual RSS Sync
  const handleSyncRss = async () => {
    setIsSyncing(true);
    setSyncReport(null);
    try {
      const res = await syncArticlesRssAction();
      if (res.success && res.report) {
        setSyncReport(res.report);
        showToast(
          `Sinkronisasi selesai! ${res.report.totalInserted} artikel berhasil diperbarui/disimpan dari ${res.report.totalSources} portal.`
        );
        await loadArticles(0);
      } else {
        showToast(res.error || 'Gagal menyinkronkan feed artikel.');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan saat sinkronisasi RSS.');
    } finally {
      setIsSyncing(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  if (authChecking) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-outline">
          <span className="material-symbols-outlined animate-spin text-[24px]">sync</span>
          <span className="text-sm">Memeriksa hak akses administrator...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 min-h-[50vh]">
        <div className="max-w-md w-full p-6 rounded-2xl bg-surface-container-lowest border border-surface-container-high text-center">
          <span className="material-symbols-outlined text-[48px] text-red-500 mb-2">lock</span>
          <h2 className="text-lg font-bold text-on-surface">Akses Dibatasi</h2>
          <p className="text-xs text-outline mt-1 mb-4">
            Halaman pengelolaan Artikel Islam hanya dapat diakses oleh administrator resmi Peta Kajian.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col font-geist text-on-surface pb-14">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-md">
          <span className="material-symbols-outlined text-[18px] text-emerald-400 shrink-0">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-surface-container-lowest border-b border-surface-container-high/60 py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[26px]">
                article
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                Kelola Artikel & Faidah Islam
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <p className="text-xs text-outline">
                Tulis artikel dakwah baru, sunting konten, atur status tayang, atau sinkronkan sindikasi RSS.
              </p>
              <span className="text-outline/40 hidden sm:inline">•</span>
              <Link
                href="/artikel"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                <span>Lihat Katalog Publik</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSyncRss}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-high text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Tarik artikel terbaru dari Muslim.or.id, Rumaysho, KonsultasiSyariah, & Almanhaj"
            >
              <span
                className={`material-symbols-outlined text-[16px] text-amber-600 ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              >
                rss_feed
              </span>
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan RSS'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[17px]">add_circle</span>
              <span>Tulis Artikel Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT BODY */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* BANNER LAPORAN SINKRONISASI RSS (Jika baru dijalankan) */}
        {syncReport && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                  task_alt
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-on-surface">
                  Laporan Sinkronisasi Portal Artikel Sunnah
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSyncReport(null)}
                className="text-outline hover:text-on-surface p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {syncReport.results.map((r) => (
                <div
                  key={r.sourceName}
                  className="p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">{r.sourceName}</p>
                    <p className="text-[10px] text-outline">
                      {r.error ? (
                        <span className="text-red-500">{r.error}</span>
                      ) : (
                        `${r.newInserted} disimpan dari ${r.itemsFound} feed`
                      )}
                    </p>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      r.error ? 'text-red-500' : 'text-emerald-600'
                    }`}
                  >
                    {r.error ? 'error' : 'check_circle'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 1. KARTU STATISTIK RINGKAS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-xs'
                : 'bg-surface-container-lowest border-surface-container-high hover:border-emerald-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider">
                Total Artikel
              </span>
              <span className="material-symbols-outlined text-[18px] text-emerald-600">
                library_books
              </span>
            </div>
            <p className="text-2xl font-black text-on-surface mt-1">{stats.totalCount}</p>
            <p className="text-[10px] text-outline mt-0.5">Seluruh artikel di database</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('published')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'published'
                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-xs'
                : 'bg-surface-container-lowest border-surface-container-high hover:border-emerald-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider">
                Tayang (Publik)
              </span>
              <span className="material-symbols-outlined text-[18px] text-emerald-600">
                public
              </span>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.publishedCount}
            </p>
            <p className="text-[10px] text-outline mt-0.5">Tampil di halaman /artikel</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'draft'
                ? 'bg-amber-500/10 border-amber-500/50 shadow-xs'
                : 'bg-surface-container-lowest border-surface-container-high hover:border-amber-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider">
                Draft / Arsip
              </span>
              <span className="material-symbols-outlined text-[18px] text-amber-500">
                visibility_off
              </span>
            </div>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {stats.draftCount}
            </p>
            <p className="text-[10px] text-outline mt-0.5">Disembunyikan dari publik</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('featured')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'featured'
                ? 'bg-purple-500/10 border-purple-500/50 shadow-xs'
                : 'bg-surface-container-lowest border-surface-container-high hover:border-purple-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider">
                Artikel Pilihan
              </span>
              <span className="material-symbols-outlined text-[18px] text-amber-500">star</span>
            </div>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {stats.featuredCount}
            </p>
            <p className="text-[10px] text-outline mt-0.5">Ditandai sebagai featured</p>
          </button>
        </div>

        {/* 2. BARIS PENCARIAN & FILTER */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Input Pencarian */}
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul artikel, kata kunci ringkasan, atau nama ustadz/penulis..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface placeholder:text-outline focus:outline-hidden focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Dropdown Filter Kategori & Sumber */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold text-on-surface focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="published">Tayang (Published)</option>
              <option value="draft">Draft / Nonaktif</option>
              <option value="featured">Artikel Pilihan ⭐</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold text-on-surface focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Topik</option>
              {ADMIN_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold text-on-surface focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Sumber</option>
              {SOURCE_PRESETS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. TABEL / DAFTAR ARTIKEL */}
        <div className="rounded-2xl bg-surface-container-lowest border border-surface-container-high overflow-hidden shadow-2xs">
          {loadingList ? (
            <div className="p-12 flex flex-col items-center justify-center gap-2 text-outline">
              <span className="material-symbols-outlined animate-spin text-[28px] text-emerald-600">
                sync
              </span>
              <span className="text-xs font-medium">Memuat daftar artikel...</span>
            </div>
          ) : articles.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <span className="material-symbols-outlined text-[42px] text-outline/50">
                article
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-on-surface">Belum Ada Artikel Ditemukan</h3>
                <p className="text-xs text-outline max-w-md mx-auto">
                  Tidak ada artikel yang cocok dengan filter saat ini, atau klik tombol di bawah untuk menulis artikel baru.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>Tulis Artikel Pertama</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-surface-container-high/60">
              {articles.map((art) => {
                const isBusy = processingId === art.id;
                const formattedDate = art.published_at
                  ? new Date(art.published_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '-';

                return (
                  <div
                    key={art.id}
                    className={`p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface-container-low/40 transition-colors ${
                      !art.is_published ? 'opacity-75 bg-surface-container-low/20' : ''
                    }`}
                  >
                    {/* Kiri: Thumbnail + Info Artikel */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-surface-container shrink-0 border border-surface-container-high flex items-center justify-center">
                        {art.image_url ? (
                          <img
                            src={art.image_url}
                            alt={art.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-2xl text-emerald-600/50">
                            auto_stories
                          </span>
                        )}
                      </div>

                      {/* Teks Detail */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-bold">
                            {art.source_name || 'Portal Sunnah'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-semibold capitalize">
                            {art.category || 'umum'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              art.is_published
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {art.is_published ? '● Tayang' : '○ Draft'}
                          </span>
                          {art.is_featured && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">star</span>
                              Pilihan
                            </span>
                          )}
                        </div>

                        <div className="flex items-start gap-1.5">
                          <Link
                            href={`/artikel/${art.slug}`}
                            target="_blank"
                            className="text-xs sm:text-sm font-bold text-on-surface hover:text-emerald-600 transition-colors line-clamp-1"
                            title="Buka halaman baca artikel di tab baru"
                          >
                            {art.title}
                          </Link>
                          <Link
                            href={`/artikel/${art.slug}`}
                            target="_blank"
                            className="text-outline hover:text-emerald-600 shrink-0 mt-0.5"
                            title="Lihat di halaman publik"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              open_in_new
                            </span>
                          </Link>
                        </div>

                        <p className="text-[11px] text-outline line-clamp-1">
                          {art.summary || 'Tidak ada ringkasan'}
                        </p>

                        <div className="flex items-center gap-3 text-[10px] text-outline pt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 font-medium text-on-surface-variant">
                            <span className="material-symbols-outlined text-[13px]">person</span>
                            {art.author_name || 'Asatidzah'}
                          </span>
                          <span>•</span>
                          <span>{formattedDate}</span>
                          <span>•</span>
                          <span>{art.read_time_minutes || 4} mnt baca</span>
                        </div>
                      </div>
                    </div>

                    {/* Kanan: Aksi Cepat (Featured, Publish Toggle, Edit, Delete) */}
                    <div className="flex items-center justify-end gap-1.5 shrink-0 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-surface-container-high/50">
                      {/* Tombol Star Featured */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleFeatured(art)}
                        className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                          art.is_featured
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                            : 'bg-surface-container-low border-surface-container-high text-outline hover:text-amber-500'
                        }`}
                        title={
                          art.is_featured
                            ? 'Hapus dari Artikel Pilihan'
                            : 'Jadikan Artikel Pilihan (Featured)'
                        }
                      >
                        <span className="material-symbols-outlined text-[17px]">
                          {art.is_featured ? 'star' : 'star_outline'}
                        </span>
                      </button>

                      {/* Tombol Toggle Tayang / Draft */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleTogglePublish(art)}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          art.is_published
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-amber-500/15 hover:text-amber-700 hover:border-amber-500/30'
                            : 'bg-surface-container border-surface-container-high text-outline hover:bg-emerald-500/15 hover:text-emerald-700'
                        }`}
                        title={
                          art.is_published
                            ? 'Klik untuk menyembunyikan (Simpan ke Draft)'
                            : 'Klik untuk menayangkan ke publik'
                        }
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {art.is_published ? 'visibility' : 'visibility_off'}
                        </span>
                        <span>{art.is_published ? 'Tayang' : 'Draft'}</span>
                      </button>

                      {/* Tombol Edit */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleOpenEditModal(art)}
                        className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-high text-on-surface text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Sunting Artikel"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                        <span>Edit</span>
                      </button>

                      {/* Tombol Hapus */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteArticle(art)}
                        className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                        title="Hapus Artikel"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* FOOTER PAGINASI */}
          {!loadingList && filteredTotal > PAGE_SIZE && (
            <div className="px-4 py-3 bg-surface-container-low/50 border-t border-surface-container-high flex items-center justify-between text-xs">
              <span className="text-outline">
                Menampilkan <strong>{page * PAGE_SIZE + 1}</strong>–
                <strong>{Math.min((page + 1) * PAGE_SIZE, filteredTotal)}</strong> dari{' '}
                <strong>{filteredTotal}</strong> artikel
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-surface-container border border-surface-container-high font-semibold disabled:opacity-40 cursor-pointer hover:bg-surface-container-high"
                >
                  Sebelumnya
                </button>
                <span className="px-2 font-bold text-on-surface">
                  Hal {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container border border-surface-container-high font-semibold disabled:opacity-40 cursor-pointer hover:bg-surface-container-high"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================
          MODAL EDITOR ARTIKEL (TAMBAH BARU & EDIT + LIVE PREVIEW)
          ================================================================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-surface-container-lowest border border-surface-container-high rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[22px]">
                  {editingArticle ? 'edit_document' : 'post_add'}
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-on-surface">
                    {editingArticle ? 'Sunting Artikel Islam' : 'Tulis Artikel Islam Baru'}
                  </h2>
                  <p className="text-[10px] text-outline">
                    {editingArticle
                      ? `ID: ${editingArticle.id} • Slug: ${editingArticle.slug}`
                      : 'Artikel akan langsung tampil di katalog publik jika status Tayang diaktifkan.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body Form (Scrollable) */}
            <form
              onSubmit={handleSaveArticle}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5"
            >
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Baris 1: Judul & Slug */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7 space-y-1">
                  <label className="text-xs font-bold text-on-surface block">
                    Judul Artikel <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => {
                      const nextTitle = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        title: nextTitle,
                        slug: slugManuallyEdited ? prev.slug : slugifyTitle(nextTitle),
                      }));
                    }}
                    placeholder="Contoh: Keutamaan Menuntut Ilmu Syar'i dan Mengikhlaskan Niat"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs sm:text-sm font-semibold text-on-surface focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-5 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-on-surface">Slug URL</label>
                    <button
                      type="button"
                      onClick={() => {
                        setSlugManuallyEdited(false);
                        setFormData((prev) => ({
                          ...prev,
                          slug: slugifyTitle(prev.title),
                        }));
                      }}
                      className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                    >
                      Buat Otomatis
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => {
                      setSlugManuallyEdited(true);
                      setFormData((prev) => ({ ...prev, slug: slugifyTitle(e.target.value) }));
                    }}
                    placeholder="keutamaan-menuntut-ilmu-syari"
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono text-on-surface-variant focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Baris 2: Kategori, Sumber Portal, & Nama Penulis/Ustadz */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface block">Kategori Topik</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold text-on-surface focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    {ADMIN_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface block">Sumber Artikel</label>
                  <select
                    value={formData.source_slug}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold text-on-surface focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    {SOURCE_PRESETS.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface block">
                    Penulis / Pemateri
                  </label>
                  <input
                    type="text"
                    value={formData.author_name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, author_name: e.target.value }))
                    }
                    placeholder="Contoh: Ust. Muhammad Abduh Tuasikal, M.Sc."
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Baris 3: Gambar Sampul, Tag, & Estimasi Waktu Baca */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                <div className="sm:col-span-6 space-y-1">
                  <label className="text-xs font-bold text-on-surface block">
                    URL Gambar Sampul (Thumbnail)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={formData.image_url}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, image_url: e.target.value }))
                      }
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-hidden focus:border-emerald-500"
                    />
                    {formData.image_url && (
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        className="w-9 h-9 rounded-lg object-cover border border-surface-container-high shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs font-bold text-on-surface block">
                    Tag Topik (Pisahkan dengan koma)
                  </label>
                  <input
                    type="text"
                    value={formData.tags_text}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, tags_text: e.target.value }))
                    }
                    placeholder="Tauhid, Sholat, Fiqih Ibadah"
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-on-surface block">
                    Waktu Baca (Mnt)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formData.read_time_minutes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        read_time_minutes: parseInt(e.target.value, 10) || 4,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Baris 4: Ringkasan Singkat (Summary) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface block">
                  Ringkasan Singkat (Ditampilkan pada kartu katalog & SEO)
                </label>
                <textarea
                  rows={2}
                  value={formData.summary}
                  onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
                  placeholder="Biarkan kosong jika ingin dibuatkan otomatis dari paragraf pertama artikel..."
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-hidden focus:border-emerald-500 resize-y"
                />
              </div>

              {/* Baris 5: Editor Konten Artikel (HTML + Toolbar Format Cepat + Tab Pratinjau) */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-on-surface">
                    Isi Naskah Artikel <span className="text-red-500">*</span>
                  </label>

                  {/* Switcher Editor vs Pratinjau */}
                  <div className="flex items-center gap-1 bg-surface-container p-0.5 rounded-xl border border-surface-container-high">
                    <button
                      type="button"
                      onClick={() => setEditorTab('write')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                        editorTab === 'write'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-outline hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">edit_note</span>
                      <span>Editor Naskah</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab('preview')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                        editorTab === 'preview'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-outline hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">visibility</span>
                      <span>Pratinjau Tampilan</span>
                    </button>
                  </div>
                </div>

                {editorTab === 'write' ? (
                  <div className="rounded-2xl border border-surface-container-high overflow-hidden bg-surface-container-low">
                    {/* Toolbar Format Cepat */}
                    <div className="px-3 py-1.5 bg-surface-container border-b border-surface-container-high flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => insertHtmlSnippet('<p>', '</p>', 'Paragraf baru...')}
                        className="px-2 py-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-[11px] font-bold text-on-surface border border-surface-container-high cursor-pointer"
                        title="Sisipkan Paragraf (<p>)"
                      >
                        Paragraf
                      </button>
                      <button
                        type="button"
                        onClick={() => insertHtmlSnippet('<h3>', '</h3>', 'Subjudul Pembahasan')}
                        className="px-2 py-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-[11px] font-bold text-on-surface border border-surface-container-high cursor-pointer"
                        title="Sisipkan Subjudul (<h3>)"
                      >
                        H3 Subjudul
                      </button>
                      <button
                        type="button"
                        onClick={() => insertHtmlSnippet('<strong>', '</strong>', 'teks tebal')}
                        className="px-2 py-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-[11px] font-extrabold text-on-surface border border-surface-container-high cursor-pointer"
                        title="Teks Tebal (<strong>)"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => insertHtmlSnippet('<em>', '</em>', 'teks miring')}
                        className="px-2 py-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-[11px] italic font-serif font-bold text-on-surface border border-surface-container-high cursor-pointer"
                        title="Teks Miring (<em>)"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertHtmlSnippet(
                            '<blockquote><p>',
                            '</p><p><em>"Terjemahan dalil/hadits..."</em> (HR. Muslim)</p></blockquote>',
                            'تَكَاتَبُوا الْعِلْمَ'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-500/30 cursor-pointer flex items-center gap-1"
                        title="Sisipkan Kotak Kutipan Ayat / Hadits (<blockquote>)"
                      >
                        <span>📖 Kutipan Dalil</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertHtmlSnippet(
                            '<ul>\n  <li>',
                            '</li>\n  <li>Poin kedua</li>\n</ul>',
                            'Poin pertama'
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-[11px] font-bold text-on-surface border border-surface-container-high cursor-pointer"
                        title="Sisipkan Daftar Poin (<ul>)"
                      >
                        • List Poin
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertHtmlSnippet(
                            '<ol>\n  <li>',
                            '</li>\n  <li>Langkah kedua</li>\n</ol>',
                            'Langkah pertama'
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-[11px] font-bold text-on-surface border border-surface-container-high cursor-pointer"
                        title="Sisipkan Daftar Nomor (<ol>)"
                      >
                        1. List Nomor
                      </button>
                    </div>

                    <textarea
                      ref={contentTextareaRef}
                      required
                      rows={12}
                      value={formData.content_html}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, content_html: e.target.value }))
                      }
                      placeholder="Tuliskan isi naskah artikel (mendukung format HTML seperti <p>, <h3>, <blockquote>, <ul>, <ol>)..."
                      className="w-full p-4 bg-transparent text-xs sm:text-sm font-mono leading-relaxed text-on-surface focus:outline-hidden resize-y"
                    />
                  </div>
                ) : (
                  /* Panel Pratinjau Bacaan */
                  <div className="p-5 sm:p-6 rounded-2xl border border-surface-container-high bg-surface min-h-[280px] max-h-[420px] overflow-y-auto space-y-4">
                    <div className="border-b border-surface-container-high pb-3 space-y-1">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        {formData.source_name}
                      </span>
                      <h3 className="text-base sm:text-lg font-extrabold text-on-surface">
                        {formData.title || 'Judul Artikel Anda'}
                      </h3>
                      <p className="text-[11px] text-outline">
                        Oleh {formData.author_name || 'Asatidzah'} • {formData.read_time_minutes} mnt baca
                      </p>
                    </div>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-on-surface leading-relaxed space-y-3 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-4 [&_blockquote]:p-3.5 [&_blockquote]:rounded-xl [&_blockquote]:bg-emerald-500/5 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-600"
                      dangerouslySetInnerHTML={{
                        __html:
                          formData.content_html ||
                          '<p class="text-outline italic">Belum ada konten untuk ditampilkan.</p>',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Baris 6: Opsi Publikasi & Canonical URL */}
              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-5">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.is_published}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, is_published: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-on-surface">
                      Langsung Tayangkan ke Publik (Published)
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.is_featured}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, is_featured: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-on-surface">
                      Jadikan Artikel Pilihan (Featured ⭐)
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingForm}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {savingForm ? 'sync' : 'save'}
                    </span>
                    <span>
                      {savingForm
                        ? 'Menyimpan...'
                        : editingArticle
                        ? 'Simpan Perubahan'
                        : 'Terbitkan Artikel'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
