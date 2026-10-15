'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

const BOOKMARKS_STORAGE_KEY = 'peta_kajian_bookmarks';
const BOOKMARKS_EVENT = 'peta-kajian-bookmarks-updated';

/**
 * Mengambil daftar ID kajian yang di-bookmark dari localStorage
 */
export function getStoredBookmarks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading bookmarks from localStorage', e);
    return [];
  }
}

/**
 * Memeriksa apakah suatu ID kajian sedang di-bookmark
 */
export function isSessionBookmarked(id: string): boolean {
  return getStoredBookmarks().includes(id);
}

/**
 * Sinkronisasi dua arah antara data lokal dan database Supabase:
 * 1. Unggah bookmark lokal yang belum ada di database
 * 2. Unduh bookmark dari database yang belum ada di lokal
 * 3. Simpan hasil gabungan (union) ke localStorage
 */
export async function syncBookmarksWithDatabase(userId: string): Promise<string[]> {
  if (typeof window === 'undefined' || !userId) return getStoredBookmarks();

  const supabase = createClient();
  try {
    // 1. Ambil bookmark yang ada di database
    const { data: remoteData, error } = await supabase
      .from('user_bookmarks')
      .select('session_id')
      .eq('user_id', userId);

    if (error) {
      console.warn('Sync bookmarks DB read error:', error.message);
      return getStoredBookmarks();
    }

    const remoteIds = (remoteData || []).map((row) => row.session_id);
    const localIds = getStoredBookmarks();

    // 2. Cari bookmark lokal yang belum ada di DB dan unggah
    const missingInDb = localIds.filter((id) => !remoteIds.includes(id));
    if (missingInDb.length > 0) {
      const rowsToInsert = missingInDb.map((sessionId) => ({
        user_id: userId,
        session_id: sessionId,
      }));
      await (supabase.from('user_bookmarks') as any).upsert(rowsToInsert, { onConflict: 'user_id,session_id' });
    }

    // 3. Gabungkan keduanya secara unik
    const merged = Array.from(new Set([...localIds, ...remoteIds]));
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent(BOOKMARKS_EVENT, { detail: merged }));

    return merged;
  } catch (e) {
    console.error('Error syncing bookmarks with database:', e);
    return getStoredBookmarks();
  }
}

/**
 * Melakukan toggle bookmark (tambah jika belum, hapus jika sudah ada).
 * - Berjalan optimis di localStorage & state lokal seketika (zero latency).
 * - Sinkronisasi otomatis ke Supabase di latar belakang jika pengguna login.
 */
export function toggleSessionBookmark(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = getStoredBookmarks();
    const exists = current.includes(id);
    const updated = exists ? current.filter((item) => item !== id) : [...current, id];
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));

    // Beritahu semua listener di halaman saat ini (Optimistic UI)
    window.dispatchEvent(new CustomEvent(BOOKMARKS_EVENT, { detail: updated }));

    // Kirim perubahan ke database secara asinkron jika pengguna terautentikasi
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: userData }) => {
      const user = userData?.user;
      if (user?.id) {
        if (exists) {
          // Hapus dari cloud
          (supabase
            .from('user_bookmarks') as any)
            .delete()
            .match({ user_id: user.id, session_id: id })
            .then(({ error }: any) => {
              if (error) console.warn('Gagal menghapus bookmark di cloud:', error.message);
            });
        } else {
          // Tambah ke cloud
          (supabase
            .from('user_bookmarks') as any)
            .insert({ user_id: user.id, session_id: id })
            .then(({ error }: any) => {
              if (error) console.warn('Gagal menyimpan bookmark di cloud:', error.message);
            });
        }
      }
    });

    return !exists;
  } catch (e) {
    console.error('Error toggling bookmark in localStorage', e);
    return false;
  }
}

/**
 * React Hook untuk menggunakan dan memantau status bookmarks secara reaktif
 */
export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setBookmarks(getStoredBookmarks());
    setIsLoaded(true);

    const handleUpdate = () => {
      setBookmarks(getStoredBookmarks());
    };

    window.addEventListener(BOOKMARKS_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // Cek auth pengguna untuk sinkronisasi cloud
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        syncBookmarksWithDatabase(data.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        syncBookmarksWithDatabase(session.user.id);
      }
    });

    return () => {
      window.removeEventListener(BOOKMARKS_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      subscription.unsubscribe();
    };
  }, []);

  const toggle = useCallback((id: string) => {
    return toggleSessionBookmark(id);
  }, []);

  const isBookmarked = useCallback(
    (id: string) => {
      return bookmarks.includes(id);
    },
    [bookmarks]
  );

  return {
    bookmarks,
    isLoaded,
    count: bookmarks.length,
    toggle,
    isBookmarked,
  };
}
