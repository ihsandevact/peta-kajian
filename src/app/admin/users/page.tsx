'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AdminNav from '@/components/AdminNav';
import { createClient } from '@/utils/supabase/client';
import { toggleUserRole, toggleUserTrusted } from '@/app/actions/admin';
import { ADMIN_EMAILS } from '@/lib/services/admin';

interface ContributorItem {
  userId?: string;
  name: string;
  count: number;
  role: 'admin' | 'kontributor';
  isTrusted: boolean;
  email?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ContributorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      // 1. Ambil semua study_sessions untuk menghitung kontribusi per nama & user_id
      const { data: sessionRows } = await supabase
        .from('study_sessions')
        .select('created_by, contributor_name');

      // 2. Ambil data role dari user_roles jika ada
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('*');

      const roleMap: Record<string, { role: 'admin' | 'kontributor'; is_trusted: boolean }> = {};
      (roleRows || []).forEach((r) => {
        roleMap[r.user_id] = { role: r.role, is_trusted: r.is_trusted };
      });

      // 3. Kelompokkan per kontributor
      const map: Record<string, ContributorItem> = {};

      (sessionRows || []).forEach((s) => {
        const name = s.contributor_name || 'Relawan Dakwah';
        const uid = s.created_by;
        const key = uid || name;

        if (!map[key]) {
          const rInfo = uid ? roleMap[uid] : null;
          map[key] = {
            userId: uid || undefined,
            name,
            count: 0,
            role: rInfo?.role || 'kontributor',
            isTrusted: rInfo?.is_trusted || false,
          };
        }
        map[key].count += 1;
      });

      // Tambahkan default admin jika ada di whitelist
      ADMIN_EMAILS.forEach((email) => {
        if (!Object.values(map).some((u) => u.email === email || u.name.toLowerCase().includes('ihsan'))) {
          // Keep listed
        }
      });

      setUsers(Object.values(map).sort((a, b) => b.count - a.count));
    } catch (err) {
      console.error('Error loading contributors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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

  const handleToggleRole = async (userItem: ContributorItem) => {
    if (!userItem.userId) {
      alert('Relawan ini belum memiliki User ID tertaut di database.');
      return;
    }

    const newRole = userItem.role === 'admin' ? 'kontributor' : 'admin';
    const confirmChange = window.confirm(`Apakah Anda yakin ingin mengubah role ${userItem.name} menjadi ${newRole.toUpperCase()}?`);
    if (!confirmChange) return;

    setProcessingId(userItem.userId);
    try {
      const res = await toggleUserRole(userItem.userId, newRole);
      if (res.success) {
        setToastMessage(`Role ${userItem.name} diubah menjadi ${newRole}.`);
        await loadUsers();
      } else {
        alert(res.error || 'Gagal mengubah role.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface font-geist text-on-surface flex flex-col">
      <AdminNav />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-8 flex flex-col gap-6">
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
              Kelola hak akses role admin dan lencana Trusted Contributor (Bebas Kurasi)
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

        {/* Info Card Mengenai Trusted Contributor */}
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-950 dark:text-purple-200 text-xs flex items-start gap-3">
          <span className="material-symbols-outlined text-purple-600 dark:text-purple-300 text-[22px] shrink-0 mt-0.5">
            verified
          </span>
          <div className="leading-relaxed">
            <strong className="block text-purple-900 dark:text-purple-200 mb-0.5">
              Apa itu Trusted Contributor (Auto-Publish)?
            </strong>
            Kontributor atau DKM resmi yang diberi status <strong>Terpercaya (Trusted)</strong> dapat mengirimkan jadwal kajian yang <strong>langsung tayang di peta publik</strong> secara otomatis tanpa perlu menunggu kurasi admin terlebih dahulu.
          </div>
        </div>

        {/* User List Table / Cards */}
        <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low/40">
            <h2 className="text-sm font-bold text-on-surface">Daftar Kontributor Terdaftar ({users.length})</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-on-surface-variant font-medium">Memuat data pengguna...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-xs text-outline">Belum ada data relawan.</div>
          ) : (
            <div className="divide-y divide-surface-container-high/60">
              {users.map((u, idx) => {
                const isAdmin = u.role === 'admin';
                const isTrusted = u.isTrusted || isAdmin;

                return (
                  <div
                    key={u.userId || u.name + idx}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-container-low/30 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-sm text-on-surface shrink-0">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-on-surface truncate">{u.name}</h3>
                          {isAdmin ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                              ADMIN
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-surface-container-high">
                              KONTRIBUTOR
                            </span>
                          )}

                          {isTrusted && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span className="material-symbols-outlined text-[12px]">verified</span>
                              Bebas Kurasi
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-xs text-on-surface-variant">
                          <span>Total: <strong>{u.count} kajian</strong></span>
                          {u.userId && (
                            <span className="text-outline font-mono text-[11px] truncate max-w-[200px] sm:max-w-none">
                              ID: {u.userId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {u.userId && (
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* Toggle Trusted */}
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
                          <span>{u.isTrusted ? 'Trusted (Aktif)' : 'Jadikan Trusted'}</span>
                        </button>

                        {/* Toggle Role */}
                        <button
                          type="button"
                          onClick={() => handleToggleRole(u)}
                          disabled={processingId === u.userId}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">manage_accounts</span>
                          <span>{isAdmin ? 'Ubah ke Kontributor' : 'Jadikan Admin'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
