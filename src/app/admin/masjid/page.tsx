'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { checkIsAdmin } from '@/lib/services/admin';
import {
  fetchAllMosques,
  matchCityFilter,
  type MosqueVenue,
} from '@/lib/services/venues';
import {
  getMosqueCatalogStatsAction,
  searchMosqueCandidatesAction,
  promoteCandidatesAction,
  bulkPromoteByFilterAction,
  type MosqueCandidate,
} from '@/app/actions/mosques';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const CANDIDATE_PAGE_SIZE = 30;
const CONFIDENCE_OPTIONS = [
  { label: 'Semua (≥ 50%)', value: 0.5 },
  { label: '≥ 75%', value: 0.75 },
  { label: '⭐ ≥ 85% (Rekomendasi)', value: 0.85 },
  { label: '≥ 90%', value: 0.9 },
  { label: '≥ 95%', value: 0.95 },
];
const QUICK_CATALOG_CITIES = [
  'Jakarta Selatan',
  'Jakarta Timur',
  'Jakarta Barat',
  'Jakarta Pusat',
  'Jakarta Utara',
  'Bekasi',
  'Depok',
  'Tangerang Selatan',
  'Tangerang',
  'Bogor',
  'Bandung',
  'Yogyakarta',
  'Sleman',
  'Surabaya',
  'Makassar',
  'Medan',
  'Palembang',
  'Semarang',
  'Malang',
];

const ADMIN_CITIES = [
  'Semua',
  'Jakarta',
  'Bekasi',
  'Depok',
  'Tangerang',
  'Bogor',
  'Bandung',
  'Yogyakarta',
  'Surabaya',
  'Makassar',
  'Palembang',
  'Medan',
  'Semarang',
  'Solo',
];

export default function AdminMosquePage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mosques, setMosques] = useState<MosqueVenue[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('Semua');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'with_sessions' | 'no_sessions'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'sessions_desc' | 'newest'>('name_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Katalog Overture (mosque_candidates) Modal State
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const debouncedCatalogQuery = useDebouncedValue(catalogQuery, 300);
  const [minConfidence, setMinConfidence] = useState<number>(0.85);
  const [matchingCount, setMatchingCount] = useState<number>(0);
  const [catalogStats, setCatalogStats] = useState<{ total: number; unpromoted: number; release: string | null } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [candidates, setCandidates] = useState<MosqueCandidate[]>([]);
  const [hasMoreCandidates, setHasMoreCandidates] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isBulkPromoting, setIsBulkPromoting] = useState(false);
  const searchRequestId = useRef(0);

  // Cek admin saat mount
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const adminStatus = await checkIsAdmin(user);
      setIsAdmin(adminStatus);
      if (adminStatus) {
        await loadMosques();
      }
      setLoading(false);
    }
    init();
  }, []);

  const loadMosques = async () => {
    try {
      const data = await fetchAllMosques({ limit: 50000 });
      setMosques(data);
    } catch (err) {
      console.error('Error load mosques:', err);
    }
  };

  const refreshCatalogStats = useCallback(async () => {
    const res = await getMosqueCatalogStatsAction();
    if (res.success) {
      setCatalogStats({ total: res.total, unpromoted: res.unpromoted, release: res.release });
    } else {
      setCatalogStats(null);
      setCatalogError(res.error);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter & Sort daftar masjid (debounced 300ms)
  const filteredMosques = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = mosques.filter((m) => {
      // 1. Filter Kota
      if (selectedCity !== 'Semua' && !matchCityFilter(m, selectedCity)) {
        return false;
      }
      // 2. Filter Kajian Aktif
      const activeCount = m.active_sessions_count || 0;
      if (sessionFilter === 'with_sessions' && activeCount === 0) {
        return false;
      }
      if (sessionFilter === 'no_sessions' && activeCount > 0) {
        return false;
      }
      // 3. Filter Pencarian Teks
      if (q) {
        const matchText =
          m.name.toLowerCase().includes(q) ||
          (m.address && m.address.toLowerCase().includes(q)) ||
          (m.city && m.city.toLowerCase().includes(q));
        if (!matchText) return false;
      }
      return true;
    });

    // 4. Urutan (Sort)
    return [...filtered].sort((a, b) => {
      if (sortBy === 'sessions_desc') {
        const diff = (b.active_sessions_count || 0) - (a.active_sessions_count || 0);
        if (diff !== 0) return diff;
      } else if (sortBy === 'newest') {
        const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (tB !== tA) return tB - tA;
      }
      return a.name.localeCompare(b.name, 'id');
    });
  }, [mosques, debouncedSearch, selectedCity, sessionFilter, sortBy]);

  // Reset halaman ke 1 saat filter/sort/pageSize berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCity, sessionFilter, sortBy, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredMosques.length / pageSize));
  const paginatedMosques = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMosques.slice(start, start + pageSize);
  }, [filteredMosques, currentPage, pageSize]);

  // Hitung nomor halaman yang ditampilkan di footer
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  // Cari kandidat di katalog lokal (mosque_candidates). Request lama diabaikan via requestId.
  const searchCatalog = useCallback(async (q: string, minConf: number, offset: number) => {
    const requestId = ++searchRequestId.current;
    setIsSearchingCatalog(true);
    setCatalogError(null);
    try {
      const res = await searchMosqueCandidatesAction({
        q,
        minConfidence: minConf,
        limit: CANDIDATE_PAGE_SIZE,
        offset,
      });
      if (requestId !== searchRequestId.current) return;
      if (res.success) {
        setCandidates((prev) => (offset === 0 ? res.data : [...prev, ...res.data]));
        setHasMoreCandidates(res.hasMore);
        setMatchingCount(res.matchingCount);
      } else {
        setCatalogError(res.error);
        if (offset === 0) {
          setCandidates([]);
          setMatchingCount(0);
        }
      }
    } catch (err: any) {
      if (requestId === searchRequestId.current) {
        setCatalogError(err.message || 'Terjadi kesalahan saat mencari katalog.');
      }
    } finally {
      if (requestId === searchRequestId.current) setIsSearchingCatalog(false);
    }
  }, []);

  // Muat statistik katalog saat modal dibuka
  useEffect(() => {
    if (!isImporterOpen) return;
    refreshCatalogStats();
  }, [isImporterOpen, refreshCatalogStats]);

  // Pencarian otomatis (debounced) saat modal terbuka / query / minConfidence berubah
  useEffect(() => {
    if (!isImporterOpen) return;
    setSelectedCandidateIds([]);
    searchCatalog(debouncedCatalogQuery.trim(), minConfidence, 0);
  }, [isImporterOpen, debouncedCatalogQuery, minConfidence, searchCatalog]);

  const closeImporter = () => {
    searchRequestId.current++;
    setIsImporterOpen(false);
    setIsSearchingCatalog(false);
    setCandidates([]);
    setSelectedCandidateIds([]);
    setCatalogError(null);
  };

  // Handler Promosikan Terpilih (Checklist Manual) ke venues
  const handleImportSelected = async (force = false) => {
    if (selectedCandidateIds.length === 0) {
      alert('Pilih minimal 1 masjid untuk ditambahkan.');
      return;
    }

    setIsImporting(true);
    setCatalogError(null);
    try {
      const res = await promoteCandidatesAction(selectedCandidateIds, { force });
      if (res.success) {
        showToast(res.message || 'Berhasil menambahkan masjid.');
        setSelectedCandidateIds([]);
        await Promise.all([
          loadMosques(),
          refreshCatalogStats(),
          searchCatalog(debouncedCatalogQuery.trim(), minConfidence, 0),
        ]);
      } else {
        setCatalogError(res.error);
      }
    } catch (err: any) {
      setCatalogError(err.message || 'Terjadi kesalahan saat menambahkan masjid.');
    } finally {
      setIsImporting(false);
    }
  };

  // Handler Promosikan Massal 1-Klik seluruh kandidat yang cocok dengan filter aktif
  const handleBulkPromote = async () => {
    if (matchingCount === 0) return;
    const batchCount = Math.min(matchingCount, 1000);
    const filterDesc = debouncedCatalogQuery.trim()
      ? `"${debouncedCatalogQuery.trim()}" (keyakinan ≥ ${Math.round(minConfidence * 100)}%)`
      : `seluruh Indonesia dengan keyakinan ≥ ${Math.round(minConfidence * 100)}%`;

    setIsBulkPromoting(true);
    setCatalogError(null);
    try {
      const res = await bulkPromoteByFilterAction({
        q: debouncedCatalogQuery.trim(),
        minConfidence,
        maxCount: batchCount,
      });
      if (res.success) {
        showToast(res.message || `Berhasil mempromosikan masjid (${filterDesc}).`);
        setSelectedCandidateIds([]);
        await Promise.all([
          loadMosques(),
          refreshCatalogStats(),
          searchCatalog(debouncedCatalogQuery.trim(), minConfidence, 0),
        ]);
      } else {
        setCatalogError(res.error);
      }
    } catch (err: any) {
      setCatalogError(err.message || 'Terjadi kesalahan saat promosi massal.');
    } finally {
      setIsBulkPromoting(false);
    }
  };

  // Toggle checklist
  const toggleSelectAll = () => {
    if (selectedCandidateIds.length === candidates.length) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(candidates.map((m) => m.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectedDuplicateCount = candidates.filter(
    (c) => selectedCandidateIds.includes(c.id) && c.possibleDuplicateOf
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant">
        <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
        <span>Memeriksa hak akses admin...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <span className="material-symbols-outlined text-[48px] text-red-500 mb-2">lock</span>
        <h1 className="text-xl font-bold text-on-surface">Akses Ditolak</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Halaman ini khusus untuk administrator Peta Kajian.
        </p>
        <Link
          href="/"
          className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold"
        >
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full font-geist text-on-surface">
      {/* TOAST (z-[100] agar selalu tampil di atas modal z-50) */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[100] bg-emerald-600 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl shadow-2xl border border-emerald-400/40 flex items-center gap-2.5 animate-bounce">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-1 opacity-80 hover:opacity-100 flex items-center"
            aria-label="Tutup notifikasi"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
        {/* HEADER & ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-container-high/60 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">mosque</span>
              <span>Database Masjid Terdaftar</span>
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Total {mosques.length.toLocaleString('id-ID')} masjid terverifikasi dalam database Peta Kajian
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/masjid"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-on-surface bg-surface-container hover:bg-surface-container-high rounded-xl border border-outline-variant/60 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span>Lihat Halaman Publik</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsImporterOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">travel_explore</span>
              <span>Cari Katalog Masjid</span>
            </button>
          </div>
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-outline-variant/50 shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari berdasarkan nama masjid, kota, atau alamat..."
                className="w-full pl-9 pr-8 py-2 bg-surface-container-low text-xs sm:text-sm border border-outline-variant/60 rounded-xl focus:outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                  title="Bersihkan pencarian"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Filter Kota */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                aria-label="Filter Kota"
                className="px-3 py-2 bg-surface-container-low text-xs sm:text-sm border border-outline-variant/60 rounded-xl focus:outline-none focus:border-emerald-500 text-on-surface font-medium"
              >
                {ADMIN_CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city === 'Semua' ? '📍 Semua Kota' : `📍 ${city}`}
                  </option>
                ))}
              </select>

              {/* Filter Status Kajian */}
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value as 'all' | 'with_sessions' | 'no_sessions')}
                aria-label="Filter Status Kajian"
                className="px-3 py-2 bg-surface-container-low text-xs sm:text-sm border border-outline-variant/60 rounded-xl focus:outline-none focus:border-emerald-500 text-on-surface font-medium"
              >
                <option value="all">🎙️ Semua Status Kajian</option>
                <option value="with_sessions">✅ Ada Kajian Aktif</option>
                <option value="no_sessions">⚪ Belum Ada Kajian</option>
              </select>

              {/* Sortir */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name_asc' | 'sessions_desc' | 'newest')}
                aria-label="Urutkan"
                className="px-3 py-2 bg-surface-container-low text-xs sm:text-sm border border-outline-variant/60 rounded-xl focus:outline-none focus:border-emerald-500 text-on-surface font-medium"
              >
                <option value="name_asc">🔤 Nama (A–Z)</option>
                <option value="sessions_desc">🔥 Kajian Terbanyak</option>
                <option value="newest">🆕 Terbaru Ditambahkan</option>
              </select>
            </div>
          </div>

          {/* Info Ringkas Filter Aktif */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-on-surface-variant">
            <div className="flex flex-wrap items-center gap-1.5">
              <span>
                Menampilkan <strong className="text-on-surface">{filteredMosques.length.toLocaleString('id-ID')}</strong> dari{' '}
                <strong className="text-on-surface">{mosques.length.toLocaleString('id-ID')}</strong> masjid
              </span>
              {(selectedCity !== 'Semua' || sessionFilter !== 'all' || debouncedSearch.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCity('Semua');
                    setSessionFilter('all');
                    setSortBy('name_asc');
                  }}
                  className="ml-1 inline-flex items-center gap-0.5 text-emerald-600 hover:underline font-semibold"
                >
                  <span className="material-symbols-outlined text-[13px]">restart_alt</span>
                  Reset Filter
                </button>
              )}
            </div>
            <span>
              Halaman <strong className="text-on-surface">{currentPage}</strong> dari{' '}
              <strong className="text-on-surface">{totalPages}</strong>
            </span>
          </div>
        </div>

        {/* TABEL DAFTAR MASJID */}
        <div className="bg-surface rounded-2xl border border-outline-variant/50 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface-container-low text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-4">Nama Masjid</th>
                  <th className="py-3 px-4">Kota / Alamat</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Kajian Aktif</th>
                  <th className="py-3 px-4">Fasilitas</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {paginatedMosques.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-on-surface-variant">
                      Tidak ada masjid yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedMosques.map((m, idx) => {
                    const fac = m.facilities || {};
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    const hasAnyFacility =
                      fac.parking_car || fac.kids_friendly || fac.wheelchair_accessible || fac.air_conditioned;
                    return (
                      <tr key={m.id} className="hover:bg-surface-container/50 transition-colors">
                        <td className="py-3 px-3 text-center text-[11px] font-mono text-outline">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-4 font-bold text-on-surface max-w-[220px] sm:max-w-[280px]">
                          <Link
                            href={`/masjid/${m.slug || m.id}`}
                            target="_blank"
                            title={m.name}
                            className="hover:text-emerald-600 hover:underline flex items-center gap-1 group"
                          >
                            <span className="truncate">{m.name}</span>
                            <span className="material-symbols-outlined text-[13px] opacity-50 group-hover:opacity-100 shrink-0">
                              open_in_new
                            </span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-on-surface-variant max-w-[240px] sm:max-w-[320px]">
                          <span className="inline-flex items-center gap-1 font-semibold text-on-surface text-xs">
                            <span className="material-symbols-outlined text-[13px] text-emerald-600">location_on</span>
                            {m.city || 'Indonesia'}
                          </span>
                          <p className="text-[11px] text-outline line-clamp-1 mt-0.5" title={m.address}>
                            {m.address || '-'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {m.active_sessions_count && m.active_sessions_count > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              {m.active_sessions_count} Kajian
                            </span>
                          ) : (
                            <span className="text-outline text-[11px]">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {hasAnyFacility ? (
                            <div className="flex flex-wrap gap-1">
                              {fac.parking_car && (
                                <span className="px-1.5 py-0.5 bg-surface-container rounded text-[10px] text-on-surface-variant whitespace-nowrap">
                                  🅿️ Mobil
                                </span>
                              )}
                              {fac.kids_friendly && (
                                <span className="px-1.5 py-0.5 bg-surface-container rounded text-[10px] text-on-surface-variant whitespace-nowrap">
                                  🍼 Laktasi
                                </span>
                              )}
                              {fac.wheelchair_accessible && (
                                <span className="px-1.5 py-0.5 bg-surface-container rounded text-[10px] text-on-surface-variant whitespace-nowrap">
                                  ♿ Kursi Roda
                                </span>
                              )}
                              {fac.air_conditioned && (
                                <span className="px-1.5 py-0.5 bg-surface-container rounded text-[10px] text-on-surface-variant whitespace-nowrap">
                                  ❄️ AC
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-outline/70 italic">Belum diatur</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            <Link
                              href={`/masjid/${m.slug || m.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors"
                            >
                              <span>Profil</span>
                            </Link>
                            {m.lat && m.lng && (
                              <a
                                href={`https://www.google.com/maps?q=${m.lat},${m.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Buka lokasi di Google Maps"
                                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-medium bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors"
                              >
                                <span className="material-symbols-outlined text-[13px]">map</span>
                                <span>Maps</span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINASI */}
          {filteredMosques.length > 0 && (
            <div className="px-4 py-3 border-t border-outline-variant/40 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              {/* Info Range & Pilihan Baris per Halaman */}
              <div className="flex flex-wrap items-center gap-3 text-on-surface-variant">
                <span>
                  Menampilkan{' '}
                  <strong className="text-on-surface">
                    {((currentPage - 1) * pageSize + 1).toLocaleString('id-ID')}–
                    {Math.min(currentPage * pageSize, filteredMosques.length).toLocaleString('id-ID')}
                  </strong>{' '}
                  dari <strong className="text-on-surface">{filteredMosques.length.toLocaleString('id-ID')}</strong> masjid
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px]">Baris:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    aria-label="Jumlah baris per halaman"
                    className="px-2 py-1 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-emerald-500"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Tombol Navigasi Halaman */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="Halaman Pertama"
                  className="px-2 py-1 rounded-lg border border-outline-variant/50 bg-surface hover:bg-surface-container disabled:opacity-40 disabled:pointer-events-none text-on-surface font-semibold"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  title="Halaman Sebelumnya"
                  className="px-2.5 py-1 rounded-lg border border-outline-variant/50 bg-surface hover:bg-surface-container disabled:opacity-40 disabled:pointer-events-none text-on-surface font-semibold"
                >
                  ‹ Prev
                </button>

                <div className="hidden sm:flex items-center gap-1 mx-1">
                  {pageNumbers.map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-outline">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        className={`min-w-[28px] px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                          currentPage === item
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'border border-outline-variant/50 bg-surface hover:bg-surface-container text-on-surface'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  title="Halaman Berikutnya"
                  className="px-2.5 py-1 rounded-lg border border-outline-variant/50 bg-surface hover:bg-surface-container disabled:opacity-40 disabled:pointer-events-none text-on-surface font-semibold"
                >
                  Next ›
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Halaman Terakhir"
                  className="px-2 py-1 rounded-lg border border-outline-variant/50 bg-surface hover:bg-surface-container disabled:opacity-40 disabled:pointer-events-none text-on-surface font-semibold"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL CARI KATALOG MASJID (OVERTURE MAPS STAGING) */}
      {isImporterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-2xl rounded-2xl border border-outline-variant/60 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-outline-variant/40 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[24px]">travel_explore</span>
                  <h3 className="font-extrabold text-base sm:text-lg text-on-surface">
                    Katalog Masjid Indonesia (Overture Maps)
                  </h3>
                </div>
                {catalogStats && (
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Katalog: <span className="font-bold text-on-surface">{catalogStats.unpromoted.toLocaleString('id-ID')}</span> kandidat belum dipromosikan (total {catalogStats.total.toLocaleString('id-ID')})
                    {catalogStats.release ? ` · Rilis Overture ${catalogStats.release}` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeImporter}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              {/* Input Pencarian dengan Debounce 300ms */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="Ketik nama masjid, kota, atau provinsi (misal: Istiqlal, Sleman, Jakarta Selatan)..."
                  className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm bg-surface-container-low border border-outline-variant/60 rounded-xl focus:outline-none focus:border-emerald-500"
                />
                {catalogQuery && (
                  <button
                    type="button"
                    onClick={() => setCatalogQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* Quick suggestions (Kota) */}
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant overflow-x-auto pb-1">
                <span className="font-semibold shrink-0">Kota:</span>
                {QUICK_CATALOG_CITIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCatalogQuery(catalogQuery === c ? '' : c)}
                    className={`px-2 py-0.5 rounded-md text-[11px] shrink-0 transition-colors ${
                      catalogQuery === c
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'bg-surface-container hover:bg-surface-container-high'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Filter Skor Keyakinan (Confidence) */}
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant overflow-x-auto pb-1">
                <span className="font-semibold shrink-0">Skor Keyakinan:</span>
                {CONFIDENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMinConfidence(opt.value)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] shrink-0 transition-colors ${
                      minConfidence === opt.value
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : 'bg-surface-container hover:bg-surface-container-high'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* BANNER PROMOSIKAN MASSAL 1-KLIK */}
              {!isSearchingCatalog && matchingCount > 0 && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="text-xs space-y-0.5">
                    <p className="font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">bolt</span>
                      <span>
                        Ditemukan {matchingCount.toLocaleString('id-ID')} kandidat
                        {debouncedCatalogQuery.trim() ? ` untuk "${debouncedCatalogQuery.trim()}"` : ' di seluruh Indonesia'}
                        {` (keyakinan ≥ ${Math.round(minConfidence * 100)}%)`}
                      </span>
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      Promosikan sekaligus tanpa perlu mencentang satu per satu. Duplikat otomatis dilewati.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isBulkPromoting || isImporting || (!debouncedCatalogQuery.trim() && minConfidence < 0.75)}
                    onClick={handleBulkPromote}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shrink-0 shadow-xs transition-colors"
                    title={
                      !debouncedCatalogQuery.trim() && minConfidence < 0.75
                        ? 'Pilih kota terlebih dahulu atau gunakan keyakinan ≥ 75%'
                        : 'Promosikan semua kandidat yang cocok sekaligus'
                    }
                  >
                    {isBulkPromoting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Mempromosikan...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">bolt</span>
                        <span>
                          Promosikan Semua ({Math.min(matchingCount, 1000).toLocaleString('id-ID')} Masjid)
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Notifikasi Sukses di dalam Modal */}
              {toastMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px] shrink-0">
                      check_circle
                    </span>
                    <span>{toastMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToastMessage(null)}
                    className="text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}

              {/* Error / Instruksi */}
              {catalogError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                    <span>{catalogError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => searchCatalog(debouncedCatalogQuery.trim(), minConfidence, 0)}
                    className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] shrink-0 hover:bg-red-700"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}

              {/* State Katalog Kosong (Belum Impor) */}
              {!isSearchingCatalog && !catalogError && catalogStats && catalogStats.total === 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
                  <p className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    <span>Katalog kandidat masjid masih kosong</span>
                  </p>
                  <p className="text-on-surface-variant">
                    Jalankan perintah berikut di terminal lokal untuk mengimpor data masjid Indonesia dari Overture Maps:
                  </p>
                  <code className="block px-3 py-2 rounded-lg bg-surface-container font-mono text-[11px] text-on-surface">
                    npm run import:mosques
                  </code>
                </div>
              )}

              {/* Loading Indicator */}
              {isSearchingCatalog && candidates.length === 0 && (
                <div className="py-10 flex flex-col items-center justify-center text-on-surface-variant gap-2">
                  <span className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Mencari di katalog masjid...</span>
                </div>
              )}

              {/* Daftar Kandidat */}
              {candidates.length > 0 && (
                <div className="space-y-2 border-t border-outline-variant/40 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-on-surface">
                      Menampilkan {candidates.length} dari {matchingCount.toLocaleString('id-ID')} kandidat
                      {debouncedCatalogQuery.trim() ? ` untuk "${debouncedCatalogQuery.trim()}"` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-emerald-600 font-bold hover:underline"
                    >
                      {selectedCandidateIds.length === candidates.length ? 'Batal Pilih Halaman Ini' : 'Pilih Halaman Ini'}
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 border border-outline-variant/50 rounded-xl p-2 bg-surface-container-low/50">
                    {candidates.map((item) => {
                      const isChecked = selectedCandidateIds.includes(item.id);
                      const confPct =
                        typeof item.confidence === 'number'
                          ? `${Math.round(item.confidence * 100)}%`
                          : null;
                      const locationLabel = [item.city, item.province].filter(Boolean).join(', ');
                      return (
                        <label
                          key={item.id}
                          className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface cursor-pointer text-xs transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(item.id)}
                            className="mt-0.5 rounded border-outline text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-on-surface">{item.name}</span>
                              {locationLabel && (
                                <span className="px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-semibold text-on-surface-variant">
                                  {locationLabel}
                                </span>
                              )}
                              {confPct && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold"
                                  title="Skor keyakinan Overture Maps"
                                >
                                  {confPct}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-on-surface-variant truncate">
                              {item.address || `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`}
                            </p>
                            {item.possibleDuplicateOf && (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                ⚠️ Mungkin duplikat dengan &ldquo;{item.possibleDuplicateOf.name}&rdquo; ({item.possibleDuplicateOf.distanceM} m)
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {hasMoreCandidates && (
                    <button
                      type="button"
                      disabled={isSearchingCatalog}
                      onClick={() => searchCatalog(debouncedCatalogQuery.trim(), minConfidence, candidates.length)}
                      className="w-full py-2 text-xs font-bold text-emerald-600 hover:bg-surface-container rounded-xl border border-outline-variant/50 transition-colors"
                    >
                      {isSearchingCatalog ? 'Memuat...' : 'Muat Lebih Banyak'}
                    </button>
                  )}
                </div>
              )}

              {/* Hasil 0 tapi bukan error & katalog terisi */}
              {!isSearchingCatalog &&
                !catalogError &&
                candidates.length === 0 &&
                catalogStats &&
                catalogStats.total > 0 && (
                  <p className="py-8 text-center text-xs text-on-surface-variant">
                    Tidak ada kandidat masjid yang cocok dengan pencarian ini.
                  </p>
                )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 bg-surface">
              <div className="text-xs text-on-surface-variant">
                <span className="font-semibold text-on-surface">{selectedCandidateIds.length}</span> kandidat terpilih
                {selectedDuplicateCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 ml-1.5">
                    ({selectedDuplicateCount} terdeteksi mirip venue yang ada)
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeImporter}
                  className="px-3.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container rounded-xl"
                >
                  Tutup
                </button>
                {selectedDuplicateCount > 0 && (
                  <button
                    type="button"
                    disabled={isImporting || selectedCandidateIds.length === 0}
                    onClick={() => handleImportSelected(true)}
                    className="px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-50 rounded-xl transition-colors"
                    title="Promosikan semua termasuk yang mirip dengan venue terdaftar"
                  >
                    Paksa Semua
                  </button>
                )}
                <button
                  type="button"
                  disabled={isImporting || selectedCandidateIds.length === 0}
                  onClick={() => handleImportSelected(false)}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  {isImporting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      <span>Promosikan ke Direktori</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
