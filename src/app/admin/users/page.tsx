'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  toggleUserRole,
  toggleUserTrusted,
  approveContributorRequest,
  rejectContributorRequest,
} from '@/app/actions/admin';
import { ADMIN_EMAILS, type AppUserRole, type ContributorRequestStatus } from '@/lib/services/admin';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface ContributorItem {
  userId?: string;
  name: string;
  count: number;
  role: AppUserRole;
  isTrusted: boolean;
  email?: string | null;
  requestStatus?: ContributorRequestStatus;
  communityName?: string | null;
  whatsappNumber?: string | null;
  requestNote?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
}

type FilterTab = 'all' | 'pending' | 'kontributor' | 'admin' | 'user';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ContributorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Rejection modal state
  const [rejectingItem, setRejectingItem] = useState<ContributorItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      // 1. Ambil semua study_sessions untuk menghitung kontribusi per nama & user_id
      const { data: sessionRows } = await supabase
        .from('study_sessions')
        .select('created_by, contributor_name');

      // 2. Ambil data role dan permohonan dari user_roles
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('*');

      // Hitung sesi per user_id & nama
      const sessionCountByUserId: Record<string, number> = {};
      const sessionNameByUserId: Record<string, string> = {};

      (sessionRows || []).forEach((s) => {
        if (s.created_by) {
          sessionCountByUserId[s.created_by] = (sessionCountByUserId[s.created_by] || 0) + 1;
          if (s.contributor_name && !sessionNameByUserId[s.created_by]) {
            sessionNameByUserId[s.created_by] = s.contributor_name;
          }
        }
      });

      const userMap: Record<string, ContributorItem> = {};

      // 3. Masukkan semua user dari user_roles
      (roleRows || []).forEach((r) => {
        const uid = r.user_id;
        const count = sessionCountByUserId[uid] || 0;
        const fallbackName =
          r.community_name ||
          sessionNameByUserId[uid] ||
          (r.email ? r.email.split('@')[0] : 'Pengguna ' + uid.slice(0, 6));

        userMap[uid] = {
          userId: uid,
          name: fallbackName,
          count,
          role: (r.role as AppUserRole) || 'user',
          isTrusted: r.is_trusted || false,
          email: r.email || null,
          requestStatus: (r.request_status as ContributorRequestStatus) || 'none',
          communityName: r.community_name || null,
          whatsappNumber: r.whatsapp_number || null,
          requestNote: r.request_note || null,
          requestedAt: r.requested_at || null,
          reviewedAt: r.reviewed_at || null,
        };
      });

      // 4. Tambahkan sesi lama yang tidak memiliki created_by atau belum ada di user_roles
      const legacyMap: Record<string, number> = {};
      (sessionRows || []).forEach((s) => {
        if (s.created_by && !userMap[s.created_by]) {
          const uid = s.created_by;
          userMap[uid] = {
            userId: uid,
            name: s.contributor_name || 'Relawan Dakwah',
            count: 1,
            role: 'kontributor',
            isTrusted: false,
            requestStatus: 'none',
          };
        } else if (!s.created_by && s.contributor_name) {
          legacyMap[s.contributor_name] = (legacyMap[s.contributor_name] || 0) + 1;
        }
      });

      Object.entries(legacyMap).forEach(([name, count]) => {
        userMap[`legacy_${name}`] = {
          name,
          count,
          role: 'kontributor',
          isTrusted: false,
          requestStatus: 'none',
        };
      });

      // Pastikan email whitelist admin dikenali sebagai admin jika cocok
      ADMIN_EMAILS.forEach((email) => {
        Object.values(userMap).forEach((u) => {
          if (u.email && u.email.toLowerCase().trim() === email.toLowerCase().trim()) {
            u.role = 'admin';
            u.isTrusted = true;
          }
        });
      });

      const list = Object.values(userMap);
      // Prioritaskan status pending di atas, lalu urutkan berdasarkan jumlah kajian terbanyak
      list.sort((a, b) => {
        if (a.requestStatus === 'pending' && b.requestStatus !== 'pending') return -1;
        if (b.requestStatus === 'pending' && a.requestStatus !== 'pending') return 1;
        return b.count - a.count;
      });

      setUsers(list);
    } catch (err) {
      console.error('Error loading contributors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Hitung jumlah untuk masing-masing tab
  const counts = useMemo(() => {
    let pending = 0;
    let kontributor = 0;
    let admin = 0;
    let user = 0;

    users.forEach((u) => {
      if (u.requestStatus === 'pending') pending++;
      if (u.role === 'kontributor') kontributor++;
      if (u.role === 'admin') admin++;
      if (u.role === 'user') user++;
    });

    return { all: users.length, pending, kontributor, admin, user };
  }, [users]);

  // Filter daftar pengguna berdasarkan tab dan pencarian
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Filter Tab
      if (activeTab === 'pending' && u.requestStatus !== 'pending') return false;
      if (activeTab === 'kontributor' && u.role !== 'kontributor') return false;
      if (activeTab === 'admin' && u.role !== 'admin') return false;
      if (activeTab === 'user' && u.role !== 'user') return false;

      // Filter Pencarian (debounced 300ms)
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase().trim();
        const matchName = u.name.toLowerCase().includes(query);
        const matchEmail = u.email ? u.email.toLowerCase().includes(query) : false;
        const matchCommunity = u.communityName ? u.communityName.toLowerCase().includes(query) : false;
        const matchPhone = u.whatsappNumber ? u.whatsappNumber.includes(query) : false;
        return matchName || matchEmail || matchCommunity || matchPhone;
      }

      return true;
    });
  }, [users, activeTab, debouncedSearchQuery]);

  const handleToggleTrusted = async (userItem: ContributorItem) => {
    if (!userItem.userId) {
      alert('Relawan ini belum memiliki User ID tertaut di database.');
      return;
    }

    setProcessingId(userItem.userId);
    try {
      const newStatus = !userItem.isTrusted;
      const res = await toggleUserTrusted(userItem.userId, newStatus);
      if (res.success) {
        setToastMessage(`Status terpercaya untuk ${userItem.name} berhasil diubah.`);
        await loadUsers();
      } else {
        alert(res.error || 'Gagal mengubah status.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleChangeRole = async (userItem: ContributorItem, newRole: AppUserRole) => {
    if (!userItem.userId) {
      alert('Relawan ini belum memiliki User ID tertaut di database.');
      return;
    }

    if (userItem.role === newRole) return;

    const confirmChange = window.confirm(
      `Apakah Anda yakin ingin mengubah peran ${userItem.name} menjadi ${newRole.toUpperCase()}?`
    );
    if (!confirmChange) return;

    setProcessingId(userItem.userId);
    try {
      const res = await toggleUserRole(userItem.userId, newRole);
      if (res.success) {
        setToastMessage(`Peran ${userItem.name} berhasil diubah menjadi ${newRole.toUpperCase()}.`);
        await loadUsers();
      } else {
        alert(res.error || 'Gagal mengubah peran pengguna.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (userItem: ContributorItem) => {
    if (!userItem.userId) return;

    setProcessingId(userItem.userId);
    try {
      const res = await approveContributorRequest(userItem.userId);
      if (res.success) {
        setToastMessage(`Permohonan relawan untuk ${userItem.name} berhasil disetujui!`);
        await loadUsers();
      } else {
        alert(res.error || 'Gagal menyetujui permohonan.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingItem?.userId) return;

    setProcessingId(rejectingItem.userId);
    try {
      const res = await rejectContributorRequest(rejectingItem.userId, rejectionReason);
      if (res.success) {
        setToastMessage(`Permohonan relawan untuk ${rejectingItem.name} telah ditolak.`);
        setRejectingItem(null);
        setRejectionReason('');
        await loadUsers();
      } else {
        alert(res.error || 'Gagal menolak permohonan.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setProcessingId(null);
    }
  };

  const formatCleanPhone = (phone?: string | null) => {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return clean;
  };

  return (
    <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 flex flex-col gap-5 sm:gap-6">
      {/* Toast Notifikasi */}
        {toastMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="hover:opacity-75">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
              <span>Manajemen Relawan & Pengguna</span>
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Kelola persetujuan permohonan relawan dakwah, peran akses (Admin, Kontributor, User), dan lencana Bebas Kurasi
            </p>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container border border-surface-container-high transition-colors w-max"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Segarkan Data</span>
          </button>
        </div>

        {/* Alert Permohonan Pending Menunggu Review */}
        {counts.pending > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[24px] shrink-0">
                notification_important
              </span>
              <div>
                <strong className="block text-amber-950 dark:text-amber-100 font-bold">
                  Ada {counts.pending} Permohonan Kontributor Dakwah Baru!
                </strong>
                <span>Jamaah menunggu persetujuan Anda untuk mulai memposting jadwal kajian secara mandiri.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-xs transition-colors"
            >
              Lihat Permohonan
            </button>
          </div>
        )}

        {/* Info Card Trusted Contributor */}
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-950 dark:text-purple-200 text-xs flex items-start gap-3">
          <span className="material-symbols-outlined text-purple-600 dark:text-purple-300 text-[22px] shrink-0 mt-0.5">
            verified
          </span>
          <div className="leading-relaxed">
            <strong className="block text-purple-900 dark:text-purple-200 mb-0.5">
              Tingkatan Hak Akses (3-Tier Roles) & Trusted Contributor
            </strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] sm:text-xs">
              <li><strong>Jamaah (User)</strong>: Akses dasar mencari & menyimpan kajian. Memerlukan pengajuan untuk mengirim info kajian.</li>
              <li><strong>Kontributor Dakwah</strong>: Dapat memposting jadwal kajian (masuk antrean kurasi admin).</li>
              <li><strong>Trusted (Bebas Kurasi)</strong>: DKM/Kontributor terpercaya yang jadwal kajiannya langsung tayang di peta publik tanpa kurasi.</li>
              <li><strong>Administrator</strong>: Akses penuh moderasi kajian, persetujuan relawan, dan manajemen pengguna.</li>
            </ul>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-container-low rounded-2xl border border-surface-container-high/70 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'all'
                  ? 'bg-surface-container-lowest text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Semua</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container font-mono">
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'pending'
                  ? 'bg-surface-container-lowest text-amber-700 dark:text-amber-300 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Permohonan Baru</span>
              {counts.pending > 0 ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                  {counts.pending}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container font-mono">0</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('kontributor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'kontributor'
                  ? 'bg-surface-container-lowest text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Kontributor</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container font-mono">
                {counts.kontributor}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'admin'
                  ? 'bg-surface-container-lowest text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Admin</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container font-mono">
                {counts.admin}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('user')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'user'
                  ? 'bg-surface-container-lowest text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Jamaah (User)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container font-mono">
                {counts.user}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Cari nama, email, masjid..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary text-on-surface placeholder:text-outline transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
              </button>
            )}
          </div>
        </div>

        {/* Khusus Tab Permohonan Baru (Tampilan Card Detail) */}
        {activeTab === 'pending' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">how_to_reg</span>
                <span>Daftar Permohonan Kontributor Menunggu Persetujuan ({filteredUsers.length})</span>
              </h2>
            </div>

            {loading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-2 bg-surface-container-lowest rounded-2xl border border-surface-container-high/70">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-on-surface-variant font-medium">Memuat data permohonan...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-10 text-center text-xs text-outline bg-surface-container-lowest rounded-2xl border border-surface-container-high/70 flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[32px]">check_circle</span>
                <span className="font-semibold text-on-surface">Tidak ada permohonan yang tertunda</span>
                <span>Semua permohonan relawan dakwah telah ditinjau.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUsers.map((u) => {
                  const cleanPhone = formatCleanPhone(u.whatsappNumber);

                  return (
                    <div
                      key={u.userId}
                      className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-amber-500/40 shadow-xs flex flex-col justify-between gap-4"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-on-surface leading-tight">{u.name}</h3>
                              {u.email && (
                                <p className="text-xs text-on-surface-variant font-mono mt-0.5">{u.email}</p>
                              )}
                            </div>
                          </div>

                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                            Menunggu Review
                          </span>
                        </div>

                        {/* Detail Pengajuan */}
                        <div className="p-3 rounded-xl bg-surface-container-low/60 border border-surface-container-high flex flex-col gap-2 text-xs">
                          {u.communityName && (
                            <div className="flex items-center gap-2 text-on-surface">
                              <span className="material-symbols-outlined text-outline text-[16px]">mosque</span>
                              <span className="font-medium">Masjid / Komunitas:</span>
                              <strong className="text-primary truncate">{u.communityName}</strong>
                            </div>
                          )}

                          {u.whatsappNumber && (
                            <div className="flex items-center gap-2 text-on-surface">
                              <span className="material-symbols-outlined text-emerald-600 text-[16px]">chat</span>
                              <span className="font-medium">WhatsApp:</span>
                              <span className="font-mono">{u.whatsappNumber}</span>
                              {cleanPhone && (
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 text-[11px] text-emerald-600 hover:underline font-semibold ml-auto"
                                >
                                  <span>Chat WA</span>
                                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                </a>
                              )}
                            </div>
                          )}

                          {u.requestedAt && (
                            <div className="flex items-center gap-2 text-on-surface-variant text-[11px]">
                              <span className="material-symbols-outlined text-outline text-[15px]">schedule</span>
                              <span>Diajukan pada {new Date(u.requestedAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}</span>
                            </div>
                          )}

                          {u.requestNote && (
                            <div className="pt-2 border-t border-surface-container-high/60 mt-0.5">
                              <span className="text-[10px] font-semibold text-outline uppercase tracking-wider block mb-1">
                                Motivasi / Catatan Relawan:
                              </span>
                              <p className="text-xs italic text-on-surface bg-surface-container/50 p-2 rounded-lg">
                                &quot;{u.requestNote}&quot;
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tombol Aksi Permohonan */}
                      <div className="flex items-center gap-2 pt-2 border-t border-surface-container-high/60">
                        <button
                          type="button"
                          onClick={() => handleApprove(u)}
                          disabled={processingId === u.userId}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">verified_user</span>
                          <span>{processingId === u.userId ? 'Memproses...' : 'Setujui Relawan'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRejectingItem(u)}
                          disabled={processingId === u.userId}
                          className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-surface-container hover:bg-rose-50 text-rose-700 border border-surface-container-high hover:border-rose-200 text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                          <span>Tolak</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tabel / List Pengguna Umum */}
        {activeTab !== 'pending' && (
          <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low/40">
              <h2 className="text-sm font-bold text-on-surface">
                Daftar Pengguna ({filteredUsers.length} dari {users.length})
              </h2>
            </div>

            {loading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-on-surface-variant font-medium">Memuat data pengguna...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-10 text-center text-xs text-outline">
                {searchQuery ? 'Tidak ada pengguna yang cocok dengan pencarian.' : 'Belum ada data relawan.'}
              </div>
            ) : (
              <div className="divide-y divide-surface-container-high/60">
                {filteredUsers.map((u, idx) => {
                  const isAdmin = u.role === 'admin';
                  const isKontributor = u.role === 'kontributor';
                  const isUser = u.role === 'user';
                  const isTrusted = u.isTrusted || isAdmin;
                  const isPending = u.requestStatus === 'pending';
                  const cleanPhone = formatCleanPhone(u.whatsappNumber);

                  return (
                    <div
                      key={u.userId || u.name + idx}
                      className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface-container-low/30 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                            isAdmin
                              ? 'bg-purple-100 text-purple-800'
                              : isKontributor
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-on-surface truncate">{u.name}</h3>

                            {/* Role Badge */}
                            {isAdmin && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                                ADMIN
                              </span>
                            )}
                            {isKontributor && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                KONTRIBUTOR
                              </span>
                            )}
                            {isUser && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300">
                                JAMAAH (USER)
                              </span>
                            )}

                            {/* Status Trusted */}
                            {isTrusted && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span className="material-symbols-outlined text-[12px]">verified</span>
                                Bebas Kurasi
                              </span>
                            )}

                            {/* Status Permohonan Pending */}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                <span className="material-symbols-outlined text-[12px]">hourglass_top</span>
                                Permohonan Tertunda
                              </span>
                            )}
                          </div>

                          {/* Info Tambahan & Kontak */}
                          <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-xs text-on-surface-variant flex-wrap">
                            <span>Total: <strong>{u.count} kajian</strong></span>

                            {u.email && (
                              <span className="font-mono text-[11px] text-outline">
                                {u.email}
                              </span>
                            )}

                            {u.communityName && (
                              <span className="text-primary font-medium flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">mosque</span>
                                {u.communityName}
                              </span>
                            )}

                            {u.whatsappNumber && (
                              <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">chat</span>
                                {cleanPhone ? (
                                  <a
                                    href={`https://wa.me/${cleanPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                  >
                                    {u.whatsappNumber}
                                  </a>
                                ) : (
                                  u.whatsappNumber
                                )}
                              </span>
                            )}

                            {u.userId && (
                              <span className="text-outline font-mono text-[11px] truncate max-w-[140px] sm:max-w-none">
                                ID: {u.userId.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Aksi Baris Pengguna */}
                      {u.userId && (
                        <div className="flex items-center gap-2 shrink-0 self-stretch lg:self-center justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-surface-container-high/40 flex-wrap">
                          {/* Jika Pending: Tombol Cepat Setujui / Tolak */}
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(u)}
                                disabled={processingId === u.userId}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs"
                              >
                                <span className="material-symbols-outlined text-[15px]">check</span>
                                <span>Setujui</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setRejectingItem(u)}
                                disabled={processingId === u.userId}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[15px]">close</span>
                                <span>Tolak</span>
                              </button>
                            </>
                          )}

                          {/* Toggle Trusted (Hanya Kontributor / Admin) */}
                          <button
                            type="button"
                            onClick={() => handleToggleTrusted(u)}
                            disabled={processingId === u.userId}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                              u.isTrusted
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-surface-container-low text-on-surface-variant border-surface-container-high hover:bg-surface-container'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {u.isTrusted ? 'verified' : 'new_releases'}
                            </span>
                            <span>{u.isTrusted ? 'Bebas Kurasi (Aktif)' : 'Jadikan Bebas Kurasi'}</span>
                          </button>

                          {/* Dropdown Ganti Role */}
                          <div className="flex items-center gap-1.5 bg-surface-container-low border border-surface-container-high rounded-xl px-2.5 py-1 text-xs">
                            <span className="material-symbols-outlined text-[16px] text-outline">manage_accounts</span>
                            <select
                              value={u.role}
                              disabled={processingId === u.userId}
                              onChange={(e) => handleChangeRole(u, e.target.value as AppUserRole)}
                              className="bg-transparent text-xs font-semibold text-on-surface focus:outline-none cursor-pointer"
                            >
                              <option value="user">Peran: Jamaah (User)</option>
                              <option value="kontributor">Peran: Kontributor</option>
                              <option value="admin">Peran: Administrator</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Tolak Permohonan */}
        {rejectingItem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">cancel</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Tolak Permohonan Relawan</h3>
                  <p className="text-xs text-on-surface-variant">
                    Pengajuan dari: <strong>{rejectingItem.name}</strong>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Alasan Penolakan (Opsional untuk evaluasi relawan):
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Mohon lengkapi nomor WhatsApp yang aktif atau koordinasikan dengan DKM terlebih dahulu..."
                  className="w-full text-xs p-3 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-rose-500 text-on-surface placeholder:text-outline"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingItem(null);
                    setRejectionReason('');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleRejectConfirm}
                  disabled={processingId === rejectingItem.userId}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  {processingId === rejectingItem.userId ? 'Memproses...' : 'Tolak Permohonan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
