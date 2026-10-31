'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getAdminArticleSourcesAction,
  createArticleSourceAction,
  updateArticleSourceAction,
  toggleArticleSourceAction,
  deleteArticleSourceAction,
  testRssFeedAction,
  inspectWebsitePortalAction,
  type AdminArticleSourceRow,
  type ArticleSourceFormInput,
  type InspectWebsiteResult,
} from '@/app/actions/articleSources';
import { useConfirm } from '@/context/ConfirmDialogContext';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

export default function AdminArticleSourcesTab({
  onRefreshSources,
}: {
  onRefreshSources?: () => void;
}) {
  const confirmDialog = useConfirm();
  const [sources, setSources] = useState<AdminArticleSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<AdminArticleSourceRow | null>(null);
  const [testingRss, setTestingRss] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [savingSource, setSavingSource] = useState(false);

  // Auto-Discovery State (Analisis Website Otomatis)
  const [inspectUrl, setInspectUrl] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState<InspectWebsiteResult | null>(null);

  const [form, setForm] = useState<ArticleSourceFormInput>({
    name: '',
    slug: '',
    website_url: '',
    rss_feed_url: '',
    organization: '',
    default_author: 'Asatidzah Ahlus Sunnah',
    is_active: true,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getAdminArticleSourcesAction();
    if (res.success) {
      setSources(res.sources);
    } else if (res.error) {
      showToast(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAdd = () => {
    setEditingSource(null);
    setTestResult(null);
    setInspectResult(null);
    setInspectUrl('');
    setForm({
      name: '',
      slug: '',
      website_url: '',
      rss_feed_url: '',
      organization: '',
      default_author: 'Asatidzah Ahlus Sunnah',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (src: AdminArticleSourceRow) => {
    setEditingSource(src);
    setTestResult(null);
    setInspectResult(null);
    setInspectUrl(src.website_url);
    setForm({
      name: src.name,
      slug: src.slug,
      website_url: src.website_url,
      rss_feed_url: src.rss_feed_url,
      organization: src.organization || '',
      default_author: src.default_author || 'Asatidzah Ahlus Sunnah',
      is_active: src.is_active,
    });
    setIsModalOpen(true);
  };

  // Handler: Analisis Otomatis via URL
  const handleInspectWebsite = async () => {
    if (!inspectUrl.trim()) {
      alert('Masukkan URL website portal terlebih dahulu (misal: bimbinganislam.com atau https://rumaysho.com)');
      return;
    }

    setIsInspecting(true);
    setInspectResult(null);
    setTestResult(null);

    try {
      const res = await inspectWebsitePortalAction(inspectUrl.trim());
      setIsInspecting(false);
      setInspectResult(res);

      if (res.success) {
        // Auto-fill form dengan hasil analisis
        setForm((prev) => ({
          ...prev,
          name: res.name || prev.name,
          slug: res.slug || prev.slug,
          website_url: res.website_url || prev.website_url,
          rss_feed_url: res.rss_feed_url || prev.rss_feed_url,
          organization: res.organization || prev.organization,
          default_author: res.default_author || prev.default_author,
          logo_url: res.logo_url || prev.logo_url,
        }));

        if (res.rss_feed_url && res.items_count && res.items_count > 0) {
          setTestResult({
            success: true,
            msg: `Koneksi Feed Terverifikasi! Ditemukan ${res.items_count} artikel dakwah.`,
          });
        }
      } else {
        alert(res.error || 'Gagal menganalisis website.');
      }
    } catch (err: any) {
      setIsInspecting(false);
      alert(err.message || 'Terjadi kesalahan saat menganalisis website.');
    }
  };

  const handleTestRss = async () => {
    if (!form.rss_feed_url?.trim()) {
      alert('Masukkan URL Feed RSS / WP-JSON terlebih dahulu.');
      return;
    }
    setTestingRss(true);
    setTestResult(null);
    const res = await testRssFeedAction(form.rss_feed_url.trim());
    setTestingRss(false);
    if (res.success) {
      setTestResult({
        success: true,
        msg: res.message || 'Koneksi feed portal berhasil!',
      });
    } else {
      setTestResult({
        success: false,
        msg: res.error || 'Gagal menghubungi feed portal.',
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.website_url.trim() || !form.rss_feed_url.trim()) {
      alert('Nama, Website URL, dan URL Feed wajib diisi.');
      return;
    }

    setSavingSource(true);
    try {
      if (editingSource) {
        const res = await updateArticleSourceAction(editingSource.id, form);
        if (res.success) {
          showToast(`Portal "${form.name}" berhasil diperbarui.`);
          setIsModalOpen(false);
          await loadData();
          if (onRefreshSources) onRefreshSources();
        } else {
          alert(res.error || 'Gagal memperbarui portal.');
        }
      } else {
        const res = await createArticleSourceAction(form);
        if (res.success) {
          showToast(`Portal baru "${form.name}" berhasil ditambahkan.`);
          setIsModalOpen(false);
          await loadData();
          if (onRefreshSources) onRefreshSources();
        } else {
          alert(res.error || 'Gagal menambahkan portal.');
        }
      }
    } finally {
      setSavingSource(false);
    }
  };

  const handleToggleActive = async (src: AdminArticleSourceRow) => {
    setProcessingId(src.id);
    const nextVal = !src.is_active;
    const res = await toggleArticleSourceAction(src.id, nextVal);
    setProcessingId(null);
    if (res.success) {
      showToast(
        nextVal
          ? `Portal "${src.name}" diaktifkan untuk sindikasi.`
          : `Portal "${src.name}" dinonaktifkan.`
      );
      setSources((prev) =>
        prev.map((s) => (s.id === src.id ? { ...s, is_active: nextVal } : s))
      );
      if (onRefreshSources) onRefreshSources();
    } else {
      alert(res.error || 'Gagal mengubah status aktif.');
    }
  };

  const handleDelete = async (src: AdminArticleSourceRow) => {
    const ok = await confirmDialog({
      title: `Hapus Portal "${src.name}"?`,
      description: `Portal ini memiliki ${src.articles_count || 0} artikel. Menghapus portal dapat menghapus atau melepaskan artikel yang terhubung.`,
      confirmText: 'Ya, Hapus Portal',
      cancelText: 'Batal',
      variant: 'danger',
      icon: 'delete_forever',
    });
    if (!ok) return;

    setProcessingId(src.id);
    const res = await deleteArticleSourceAction(src.id);
    setProcessingId(null);
    if (res.success) {
      showToast(`Portal "${src.name}" berhasil dihapus.`);
      await loadData();
      if (onRefreshSources) onRefreshSources();
    } else {
      alert(res.error || 'Gagal menghapus portal.');
    }
  };

  return (
    <div className="space-y-4 font-geist">
      {/* Toast Notifikasi */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Info Tab */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">hub</span>
            <span>Portal Rujukan Dakwah Sunnah Terverifikasi</span>
          </h2>
          <p className="text-xs text-outline mt-0.5">
            Kelola portal dan website rujukan dakwah Islam yang di-feed artikelnya secara berkala.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface border border-surface-container-high flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Segarkan</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            <span>Tambah Portal Islam</span>
          </button>
        </div>
      </div>

      {/* Tabel Portal Sumber */}
      {loading ? (
        <div className="p-12 text-center text-outline text-xs flex items-center justify-center gap-2">
          <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
          <span>Memuat data portal Islam...</span>
        </div>
      ) : sources.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface-container-lowest border border-surface-container-high">
          <span className="material-symbols-outlined text-[42px] text-outline/40 mb-2">rss_feed</span>
          <p className="text-sm font-bold text-on-surface">Belum ada portal sumber</p>
          <p className="text-xs text-outline mt-1 mb-4">Tambahkan portal dakwah pertama Anda untuk mulai menyinkronkan artikel.</p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            Tambah Portal Sekarang
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-container-lowest border border-surface-container-high overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-on-surface border-collapse">
              <thead>
                <tr className="border-b border-surface-container-high bg-surface-container-low/60 text-[11px] font-bold text-outline uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Portal & Lembaga</th>
                  <th className="py-3 px-4">Slug & URL Website</th>
                  <th className="py-3 px-4">URL Feed RSS / WP-JSON</th>
                  <th className="py-3 px-4 text-center">Artikel</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60">
                {sources.map((src) => (
                  <tr key={src.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-on-surface text-sm">{src.name}</div>
                      <p className="text-[11px] text-outline mt-0.5">{src.organization || 'Yayasan / Redaksi'}</p>
                      <p className="text-[10px] text-outline/70 mt-0.5">Penulis default: {src.default_author}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-outline">
                        {src.slug}
                      </span>
                      <div className="mt-1">
                        <a
                          href={src.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                        >
                          <span className="truncate max-w-[180px]">{src.website_url}</span>
                          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                        </a>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <a
                        href={src.rss_feed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-amber-600 dark:text-amber-400 font-mono hover:underline inline-flex items-center gap-1 max-w-[220px] truncate"
                        title={src.rss_feed_url}
                      >
                        <span className="material-symbols-outlined text-[13px] shrink-0">rss_feed</span>
                        <span className="truncate">{src.rss_feed_url}</span>
                      </a>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-surface-container text-xs font-bold text-on-surface">
                        {src.articles_count || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(src)}
                        disabled={processingId === src.id}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                          src.is_active
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-surface-container text-outline border border-surface-container-high'
                        }`}
                      >
                        {src.is_active ? '● Aktif' : '○ Nonaktif'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(src)}
                          className="p-1.5 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface cursor-pointer"
                          title="Sunting Portal"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(src)}
                          disabled={processingId === src.id}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-outline hover:text-red-500 cursor-pointer disabled:opacity-50"
                          title="Hapus Portal"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah / Sunting Portal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest border border-surface-container-high p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[22px]">
                  {editingSource ? 'edit_square' : 'add_circle'}
                </span>
                <h3 className="font-bold text-sm sm:text-base text-on-surface">
                  {editingSource ? 'Sunting Portal Rujukan Islam' : 'Tambah Portal Islam Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* FITUR PINTAR: ANALISIS CEPAT VIA URL WEBSITE (Hanya tampil saat mode tambah baru) */}
            {!editingSource && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/25 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">
                    auto_awesome
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-on-surface">Analisis Otomatis via URL</h4>
                    <p className="text-[10px] text-outline">
                      Ketik/tempel URL portal (misal: <code className="text-emerald-600 font-semibold">bimbinganislam.com</code> atau <code className="text-emerald-600 font-semibold">rumaysho.com</code>), sistem akan otomatis mendeteksi nama, slug, & feed artikelnya.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="https://contoh-portal-dakwah.com"
                    value={inspectUrl}
                    onChange={(e) => setInspectUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInspectWebsite();
                      }
                    }}
                    className="grow px-3 py-2 rounded-xl bg-surface-container-lowest border border-surface-container-high focus:outline-hidden focus:border-emerald-500 text-xs font-semibold text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={handleInspectWebsite}
                    disabled={isInspecting || !inspectUrl.trim()}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                  >
                    <span className={`material-symbols-outlined text-[15px] ${isInspecting ? 'animate-spin' : ''}`}>
                      {isInspecting ? 'sync' : 'travel_explore'}
                    </span>
                    <span>{isInspecting ? 'Menganalisis...' : 'Analisis Web'}</span>
                  </button>
                </div>

                {/* HASIL INSPECT PRATINJAU */}
                {inspectResult && (
                  <div
                    className={`p-2.5 rounded-xl text-xs space-y-1.5 animate-in fade-in duration-150 ${
                      inspectResult.success && inspectResult.rss_feed_url
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                        : inspectResult.success
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200'
                        : 'bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-[16px]">
                        {inspectResult.success ? 'check_circle' : 'error'}
                      </span>
                      <span>{inspectResult.message || (inspectResult.success ? 'Berhasil dianalisis' : 'Gagal')}</span>
                    </div>

                    {inspectResult.sample_titles && inspectResult.sample_titles.length > 0 && (
                      <div className="pl-5 text-[11px] space-y-0.5 opacity-90">
                        <span className="font-semibold block text-[10px] uppercase tracking-wider text-outline">
                          Sampel Artikel Terdeteksi:
                        </span>
                        {inspectResult.sample_titles.map((title, idx) => (
                          <div key={idx} className="flex items-center gap-1 truncate">
                            <span className="material-symbols-outlined text-[12px] shrink-0 text-emerald-600">article</span>
                            <span className="truncate">{title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!editingSource && (
              <div className="relative flex py-0.5 items-center">
                <div className="grow border-t border-surface-container-high"></div>
                <span className="shrink mx-2 text-[10px] uppercase font-bold text-outline">
                  Konfirmasi / Rincian Form Portal
                </span>
                <div className="grow border-t border-surface-container-high"></div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-on-surface mb-1">Nama Portal / Website *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: KonsultasiSyariah.com, Almanhaj.or.id"
                  value={form.name}
                  onChange={(e) => {
                    const nameVal = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      name: nameVal,
                      slug: editingSource ? prev.slug : slugify(nameVal),
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-hidden focus:border-emerald-500 font-semibold text-on-surface"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface mb-1">Slug Sistem (ID Unik)</label>
                  <input
                    type="text"
                    required
                    placeholder="misal: konsultasi-syariah"
                    value={form.slug || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-hidden focus:border-emerald-500 font-mono text-on-surface"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface mb-1">Penulis / Asatidzah Default</label>
                  <input
                    type="text"
                    placeholder="Misal: Asatidzah Ahlus Sunnah"
                    value={form.default_author || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, default_author: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-hidden focus:border-emerald-500 text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-on-surface mb-1">Lembaga / Yayasan Pengampu</label>
                <input
                  type="text"
                  placeholder="Misal: Yayasan Pendidikan Islam Al-Atsari / Dewan Fatwa"
                  value={form.organization || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, organization: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-hidden focus:border-emerald-500 text-on-surface"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface mb-1">URL Website Utama *</label>
                <input
                  type="url"
                  required
                  placeholder="https://konsultasisyariah.com"
                  value={form.website_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, website_url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-hidden focus:border-emerald-500 text-on-surface"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-on-surface">URL Feed RSS / WP-JSON *</label>
                  <button
                    type="button"
                    onClick={handleTestRss}
                    disabled={testingRss || !form.rss_feed_url}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-[13px] ${testingRss ? 'animate-spin' : ''}`}>
                      sync
                    </span>
                    <span>{testingRss ? 'Menguji Feed...' : 'Uji Koneksi Feed'}</span>
                  </button>
                </div>
                <input
                  type="url"
                  required
                  placeholder="https://konsultasisyariah.com/feed atau /wp-json/wp/v2/posts"
                  value={form.rss_feed_url}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, rss_feed_url: e.target.value }));
                    setTestResult(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-hidden focus:border-emerald-500 font-mono text-on-surface"
                />
                {testResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl text-[11px] flex items-start gap-1.5 ${
                      testResult.success
                        ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px] shrink-0">
                      {testResult.success ? 'check_circle' : 'error'}
                    </span>
                    <span>{testResult.msg}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSource}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingSource ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{editingSource ? 'Simpan Perubahan' : 'Tambahkan Portal'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
