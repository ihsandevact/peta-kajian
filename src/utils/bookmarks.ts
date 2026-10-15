'use client';

import { useState, useEffect, useCallback } from 'react';

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
 * Melakukan toggle bookmark (tambah jika belum, hapus jika sudah ada).
 * Menembakkan custom event agar semua komponen yang me-listen langsung reaktif.
 */
export function toggleSessionBookmark(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = getStoredBookmarks();
    const exists = current.includes(id);
    const updated = exists ? current.filter((item) => item !== id) : [...current, id];
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));

    // Beritahu semua listener di halaman saat ini
    window.dispatchEvent(new CustomEvent(BOOKMARKS_EVENT, { detail: updated }));
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

    return () => {
      window.removeEventListener(BOOKMARKS_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
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
