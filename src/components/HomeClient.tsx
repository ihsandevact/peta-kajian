'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import SidebarFilter from '@/components/SidebarFilter';
import { fetchActiveSessions, hasPhysicalLocation, type StudySession } from '@/lib/services/kajian';
import { calculateDistance } from '@/utils/distance';
import { createClient } from '@/utils/supabase/client';
import { type SelectedRegion, sessionMatchesRegion } from '@/utils/regions';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { useOnlineStatus, cacheFeedSnapshot, getFeedSnapshot, getCachedOfflineSessions } from '@/utils/offlineCache';
import { getUserRoleAndStatus } from '@/lib/services/admin';
import RequestContributorModal from '@/components/RequestContributorModal';
import LiveStreamFloatingPill from '@/components/LiveStreamFloatingPill';

const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
});

export type FilterState = {
  time: string;
  audience: string[];
  radius: number;
  searchQuery: string;
  facilities: string[];
  region: SelectedRegion | null;
};

function HeaderAvatar({ url, size = 'w-5 h-5' }: { url?: string; size?: string }) {
  const [hasError, setHasError] = useState(false);

  if (url && !hasError) {
    return (
      <img
        src={url}
        alt=""
        className={`${size} rounded-full object-cover shrink-0`}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <span className="material-symbols-outlined text-[20px] text-primary shrink-0">
      account_circle
    </span>
  );
}

export default function HomeClient() {
  const { bookmarks } = useBookmarks();
  const { isOffline } = useOnlineStatus();

  const [filters, setFilters] = useState<FilterState>({
    time: 'semua',
    audience: ['umum', 'ikhwan', 'akhwat'],
    radius: 20,
    searchQuery: '',
    facilities: [],
    region: null,
  });

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [hasConnectionError, setHasConnectionError] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'kontributor' | 'user' | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [showLoginBenefits, setShowLoginBenefits] = useState<boolean>(false);
  const loginBenefitsRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tutup popover benefit saat klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (loginBenefitsRef.current && !loginBenefitsRef.current.contains(e.target as Node)) {
        setShowLoginBenefits(false);
      }
    }
    if (showLoginBenefits) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLoginBenefits]);
  const lastFetchTimeRef = useRef<number>(Date.now());
  const isFetchingRef = useRef<boolean>(false);

  // Periksa status login dan role pengguna
  useEffect(() => {
    const supabase = createClient();

    async function initUser(u: any) {
      setCurrentUser(u);
      if (u) {
        try {
          const rInfo = await getUserRoleAndStatus(u);
          setCurrentUserRole(rInfo.role);
        } catch {
          setCurrentUserRole('user');
        }
      } else {
        setCurrentUserRole(null);
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        initUser(data.user);
      } else {
        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user) {
            initUser(sess.session.user);
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      initUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handler redirect pasca-login OAuth: jika pengguna baru saja kembali dari Google OAuth
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const targetNext = sessionStorage.getItem('peta_kajian_auth_next');
      const inProgress = sessionStorage.getItem('peta_kajian_auth_in_progress');

      // Jika tidak ada targetNext atau tujuannya memang beranda '/', bersihkan flag
      if (!targetNext || targetNext === '/' || !targetNext.startsWith('/') || targetNext.startsWith('//')) {
        if (inProgress || targetNext) {
          sessionStorage.removeItem('peta_kajian_auth_in_progress');
          sessionStorage.removeItem('peta_kajian_auth_next');
          const isHttps = window.location.protocol === 'https:';
          document.cookie = `peta_kajian_auth_next=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${isHttps ? '; Secure' : ''}`;
        }
        return;
      }

      // Jika ada targetNext selain beranda (misal '/live'):
      const supabase = createClient();

      const proceedRedirect = () => {
        sessionStorage.removeItem('peta_kajian_auth_in_progress');
        sessionStorage.removeItem('peta_kajian_auth_next');
        const isHttps = window.location.protocol === 'https:';
        document.cookie = `peta_kajian_auth_next=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${isHttps ? '; Secure' : ''}`;

        // Arahkan ke targetNext TANPA menyertakan ?code= karena sudah berhasil di-exchange menjadi session cookies
        const targetUrl = new URL(targetNext, window.location.origin);
        window.location.replace(targetUrl.pathname + targetUrl.search);
      };

      // Jika URL membawa ?code=, tunggu sampai proses exchange token PKCE selesai dan sesi tersimpan di cookie
      if (window.location.search.includes('code=')) {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            proceedRedirect();
          }
        }, 3500);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            subscription.unsubscribe();
            proceedRedirect();
          }
        });

        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            subscription.unsubscribe();
            proceedRedirect();
          }
        });
      } else {
        // Jika tidak membawa ?code= (misal sudah di-exchange di server atau sudah tersimpan)
        proceedRedirect();
      }
    } catch {}
  }, []);

  // Minta lokasi pengguna saat aplikasi dimuat
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (error) => {
          console.error('Error getting location', error);
          // Silent fail agar tidak mengganggu pengguna yang menolak akses GPS
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Helper untuk membatasi waktu tunggu request Supabase maksimal 6 detik
  const fetchWithTimeout = useCallback(async <T,>(promise: Promise<T>, timeoutMs = 6000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Koneksi timeout: Server tidak merespons dalam 6 detik.'));
      }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutId);
    });
  }, []);

  const refetchData = useCallback(async (isSilent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!isSilent) {
      setIsRefreshing(true);
    }

    const isDeviceOffline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);

    try {
      if (isDeviceOffline) {
        setHasConnectionError(true);
        const cached = getFeedSnapshot();
        const offlineBookmarked = getCachedOfflineSessions();
        const map = new Map<string, StudySession>();
        [...cached, ...offlineBookmarked].forEach((s) => map.set(s.id, s));
        const merged = Array.from(map.values());
        setSessions(merged);
        setSelectedSession((prev) => {
          if (!prev) return null;
          return merged.find((s) => s.id === prev.id) || prev;
        });
        return;
      }

      const startTime = Date.now();
      const data = await fetchWithTimeout(fetchActiveSessions(), 6000);
      
      setHasConnectionError(false);
      if (data && data.length > 0) {
        setSessions(data);
        cacheFeedSnapshot(data);
        // Pertahankan selectedSession agar tidak tertutup saat background refresh
        setSelectedSession((prev) => {
          if (!prev) return null;
          return data.find((s) => s.id === prev.id) || prev;
        });
      } else {
        const cached = getFeedSnapshot();
        const offlineBookmarked = getCachedOfflineSessions();
        const map = new Map<string, StudySession>();
        [...cached, ...offlineBookmarked].forEach((s) => map.set(s.id, s));
        const merged = Array.from(map.values());
        setSessions(merged);
        setSelectedSession((prev) => {
          if (!prev) return null;
          return merged.find((s) => s.id === prev.id) || prev;
        });
      }
      lastFetchTimeRef.current = Date.now();

      // Jika manual refresh, pastikan animasi spin berputar setidaknya 400ms agar user merasakan responnya
      if (!isSilent) {
        const elapsed = Date.now() - startTime;
        if (elapsed < 400) {
          await new Promise((res) => setTimeout(res, 400 - elapsed));
        }
      }
    } catch (e) {
      console.warn('Gagal memuat kajian terbaru, beralih ke offline cache:', e);
      setHasConnectionError(true);
      const cached = getFeedSnapshot();
      const offlineBookmarked = getCachedOfflineSessions();
      const map = new Map<string, StudySession>();
      [...cached, ...offlineBookmarked].forEach((s) => map.set(s.id, s));
      const merged = Array.from(map.values());
      setSessions(merged);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [isOffline, fetchWithTimeout]);

  // Initial load
  useEffect(() => {
    refetchData(true);
  }, [refetchData]);

  // Auto-refetch saat perangkat kembali online
  useEffect(() => {
    const handleOnline = () => {
      refetchData(false);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refetchData]);

  // 1. Auto-refresh saat kembali ke tab/layar (Window Focus & Visibility Change)
  // Dilengkapi throttle 30 detik agar tidak spam jika berpindah cepat
  useEffect(() => {
    const handleReentry = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastFetchTimeRef.current > 30000) {
          refetchData(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleReentry);
    window.addEventListener('focus', handleReentry);

    return () => {
      document.removeEventListener('visibilitychange', handleReentry);
      window.removeEventListener('focus', handleReentry);
    };
  }, [refetchData]);

  // 2. Periodic background polling setiap 3 menit (hanya ketika tab sedang aktif dilihat)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refetchData(true);
      }
    }, 180000); // 3 menit (180.000 ms)

    return () => clearInterval(interval);
  }, [refetchData]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      // Hanya tampilkan kajian yang memiliki lokasi fisik di peta (offline atau hybrid)
      // Kajian online murni difokuskan di halaman /live
      if (!hasPhysicalLocation(s)) return false;
      
      // Filter Wilayah / Provinsi / Kota
      if (filters.region && !sessionMatchesRegion(s, filters.region)) {
        return false;
      }

      // Search Query (judul, pemateri, masjid, dan alamat)
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchTitle = s.title.toLowerCase().includes(query);
        const matchSpeaker = s.speaker_name.toLowerCase().includes(query);
        const matchVenue = s.venues?.name?.toLowerCase().includes(query);
        const matchAddress = s.venues?.address?.toLowerCase().includes(query);
        if (!matchTitle && !matchSpeaker && !matchVenue && !matchAddress) return false;
      }

      // Kategori
      if (!filters.audience.includes(s.audience_type)) return false;

      // Fasilitas
      if (filters.facilities.length > 0 && s.venues?.facilities) {
        const hasAllFacilities = filters.facilities.every(
          (fac) => s.venues!.facilities[fac as keyof typeof s.venues.facilities] === true
        );
        if (!hasAllFacilities) return false;
      }

      // Status Filter: Berlangsung, Tersimpan, Selesai, Rutin, Online
      const now = new Date();
      const info = getEffectiveSessionInfo(s, now);
      const isRutin = !!s.is_recurring;
      
      // Smart Filtering: Sembunyikan kajian tematik yang sudah lewat dari tampilan utama
      // kecuali pengguna secara sengaja memilih filter 'selesai' atau melihat 'tersimpan'
      if (filters.time !== 'selesai' && filters.time !== 'tersimpan' && info.isPast && !isRutin) {
        return false;
      }

      if (filters.time === 'tersimpan' && !bookmarks.includes(s.id)) return false;
      if (filters.time === 'berlangsung' && !info.isLive) return false;
      if (filters.time === 'terbaru' && (info.isPast && !isRutin)) return false;
      if (filters.time === 'selesai' && (!info.isPast || isRutin)) return false;
      if (filters.time === 'rutin' && !isRutin) return false;
      if (filters.time === 'online' && !s.is_online && !s.stream_url) return false;
      
      return true;
    });
  }, [sessions, filters, bookmarks]);

  // SMART SORTING: Live -> Upcoming/Rutin di atas, Selesai di bawah
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      // Sorting Jarak (Terdekat) — kajian tanpa lokasi fisik ditaruh paling bawah
      if (filters.time === 'terdekat' && userLocation) {
        const aHasLoc = hasPhysicalLocation(a);
        const bHasLoc = hasPhysicalLocation(b);
        if (aHasLoc && !bHasLoc) return -1;
        if (!aHasLoc && bHasLoc) return 1;
        if (!aHasLoc && !bHasLoc) return 0;
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.venues!.lat, a.venues!.lng);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.venues!.lat, b.venues!.lng);
        return distA - distB;
      }

      // Default Sorting (Waktu menggunakan effectiveDate)
      const now = new Date();
      const infoA = getEffectiveSessionInfo(a, now);
      const infoB = getEffectiveSessionInfo(b, now);
      
      // 1. Prioritas Tertinggi: Sedang Berlangsung (Live)
      if (infoA.isLive && !infoB.isLive) return -1;
      if (!infoA.isLive && infoB.isLive) return 1;

      // 2. Upcoming / Future vs Selesai / Past
      const aIsFuture = !infoA.isPast;
      const bIsFuture = !infoB.isPast;

      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;

      // 3. Kronologis waktu sesi
      if (aIsFuture && bIsFuture) {
        if (infoA.effectiveDate && infoB.effectiveDate) {
          return infoA.effectiveDate.getTime() - infoB.effectiveDate.getTime();
        }
        if (infoA.effectiveDate && !infoB.effectiveDate) return -1;
        if (!infoA.effectiveDate && infoB.effectiveDate) return 1;
        return 0;
      } else {
        if (infoA.effectiveDate && infoB.effectiveDate) {
          return infoB.effectiveDate.getTime() - infoA.effectiveDate.getTime();
        }
        return 0;
      }
    });
  }, [filteredSessions, filters.time, userLocation]);

  // Deep-linking: auto-select session from ?session=<id> in URL
  useEffect(() => {
    if (sessions.length > 0 && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session');
      if (sessionId) {
        const found = sessions.find(s => s.id === sessionId);
        if (found) {
          const info = getEffectiveSessionInfo(found, new Date());
          if (info.isPast && !found.is_recurring) {
            setFilters(p => ({ ...p, time: 'selesai' }));
          }
          setSelectedSession(found);
          setIsSheetExpanded(false);
        }
      }
    }
  }, [sessions]);

  // OBSERVER: Auto-Focus dinamis setiap kali daftar filter/sorting berubah
  useEffect(() => {
    if (sortedSessions.length > 0) {
      setSelectedSession(prev => {
        if (prev && sortedSessions.some(s => s.id === prev.id)) {
          return prev;
        }
        return sortedSessions[0];
      });
    } else {
      setSelectedSession(null);
    }
  }, [sortedSessions]);

  return (
    <div className="w-full h-screen bg-surface font-geist text-on-surface flex overflow-hidden">
      
      {/* GLOBAL SIDEBAR (Kiri Jauh) */}
      <aside className={`hidden lg:flex transition-all duration-300 bg-surface-container-lowest z-50 flex-col justify-between py-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] shrink-0 relative ${isSidebarCollapsed ? 'w-[72px]' : 'w-64'}`}>
        
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`absolute -right-3 top-8 w-6 h-6 bg-surface-container-high rounded-full flex items-center justify-center text-on-surface hover:bg-primary-container hover:text-on-primary transition-colors shadow-sm z-50`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {isSidebarCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>

        <div className={`flex flex-col gap-6 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {/* Logo Area */}
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : 'px-1'}`}>
            <img
              src="/logo.png?v=3"
              alt="Peta Kajian Logo"
              className={`${isSidebarCollapsed ? 'w-11 h-11' : 'w-12 h-12'} object-contain shrink-0 transition-all drop-shadow-xs`}
            />
            {!isSidebarCollapsed && (
              <div className="flex flex-col overflow-hidden whitespace-nowrap">
                <span className="font-bold text-base text-on-surface leading-tight tracking-tight">Peta Kajian</span>
                <span className="text-[11px] font-medium text-outline">Seluruh Indonesia</span>
              </div>
            )}
          </div>
          
          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            <a href="#" className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} bg-primary-container text-on-primary`}>
              <span className="material-symbols-outlined text-[20px]">map</span>
              {!isSidebarCollapsed && <span>Jelajah Peta</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  Jelajah Peta
                </span>
              )}
            </a>
            
            <Link 
              href="/live"
              className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} text-red-600 dark:text-red-400 hover:bg-red-500/10 w-full text-left`}
            >
              <span className="material-symbols-outlined text-[20px] text-red-600">smart_display</span>
              {!isSidebarCollapsed && (
                <span className="flex items-center gap-1.5">
                  <span>Live Kajian</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                </span>
              )}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  Live Kajian
                </span>
              )}
            </Link>
            
            <Link 
              href="/leaderboard"
              className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface w-full text-left`}
            >
              <span className="material-symbols-outlined text-[20px] text-amber-500">workspace_premium</span>
              {!isSidebarCollapsed && <span>Leaderboard Relawan</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  Leaderboard Relawan
                </span>
              )}
            </Link>

            <Link 
              href="/faq"
              className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface w-full text-left`}
            >
              <span className="material-symbols-outlined text-[20px] text-primary">help</span>
              {!isSidebarCollapsed && <span>Pusat Bantuan & FAQ</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  Pusat Bantuan & FAQ
                </span>
              )}
            </Link>
          </nav>
        </div>
        
        <div className={`flex flex-col gap-1.5 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {currentUser ? (
            <>
              {currentUserRole === 'admin' || currentUserRole === 'kontributor' ? (
                <Link
                  href="/kontributor/dashboard"
                  className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface`}
                >
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                  {!isSidebarCollapsed && <span>Kirim Info Kajian</span>}
                  {isSidebarCollapsed && (
                    <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                      Kirim Info Kajian
                    </span>
                  )}
                </Link>
              ) : (
                <Link
                  href="/kontributor/profile"
                  className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10`}
                >
                  <span className="material-symbols-outlined text-[20px] text-emerald-600">volunteer_activism</span>
                  {!isSidebarCollapsed && <span>Ajukan Jadi Relawan</span>}
                  {isSidebarCollapsed && (
                    <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                      Ajukan Jadi Relawan
                    </span>
                  )}
                </Link>
              )}

              <Link
                href="/kontributor/profile"
                className={`group relative flex items-center transition-colors rounded-lg text-xs font-medium ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-2'} text-on-surface hover:bg-surface-container-high`}
              >
                <HeaderAvatar url={currentUser.user_metadata?.avatar_url} size="w-5 h-5" />
                {!isSidebarCollapsed && (
                  <span className="truncate">
                    {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Profil Saya'}
                  </span>
                )}
                {isSidebarCollapsed && (
                  <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-on-surface text-surface text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                    Profil Saya
                  </span>
                )}
              </Link>
            </>
          ) : (
            <div
              ref={loginBenefitsRef}
              onMouseEnter={() => {
                if (closeTimerRef.current) {
                  clearTimeout(closeTimerRef.current);
                  closeTimerRef.current = null;
                }
                setShowLoginBenefits(true);
              }}
              onMouseLeave={() => {
                closeTimerRef.current = setTimeout(() => {
                  setShowLoginBenefits(false);
                }, 200);
              }}
              className="relative"
            >
              <div
                className={`flex items-center rounded-xl border border-primary/35 bg-primary/5 text-primary hover:bg-primary hover:text-white hover:border-primary shadow-2xs transition-all group ${
                  isSidebarCollapsed ? 'justify-center p-1' : 'p-1'
                }`}
              >
                <Link
                  href="/login"
                  className={`flex items-center flex-1 text-xs font-semibold rounded-lg transition-colors ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'px-2.5 py-1.5 gap-2'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] shrink-0">login</span>
                  {!isSidebarCollapsed && <span>Masuk</span>}
                </Link>

                {/* Tombol Info Benefit */}
                {!isSidebarCollapsed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowLoginBenefits((prev) => !prev);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 group-hover:hover:bg-white/20 text-primary group-hover:text-white/90 group-hover:hover:text-white transition-colors shrink-0"
                    title="Lihat keuntungan masuk akun"
                    aria-label="Lihat keuntungan masuk akun"
                  >
                    <span className="material-symbols-outlined text-[17px]">info</span>
                  </button>
                )}
              </div>

              {/* Popover / Tooltip Keuntungan Login */}
              {showLoginBenefits && (
                <div
                  className={`absolute z-50 w-72 sm:w-80 bg-surface-container-lowest text-on-surface p-4 rounded-2xl shadow-xl border border-surface-container-high transition-all animate-fadeIn ${
                    isSidebarCollapsed
                      ? 'left-full ml-3 bottom-0'
                      : 'left-full ml-3 bottom-0'
                  }`}
                >
                  {/* Header Popover */}
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <span className="material-symbols-outlined text-[18px] text-primary font-bold">
                      auto_stories
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-on-surface">
                      Buku Saku Penuntut Ilmu
                    </h4>
                  </div>

                  <p className="text-[11px] text-on-surface-variant mb-3 leading-relaxed">
                    Masuk dengan Google (1-Klik) untuk membuka fitur agenda & catatan majelis Anda:
                  </p>

                  {/* List Benefit */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5 text-xs">
                      <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-[13px]">bookmark</span>
                      </div>
                      <div className="text-[11px]">
                        <span className="font-semibold text-on-surface">Simpan Kajian (Cloud Sync)</span>
                        <p className="text-outline text-[10px] leading-tight">Akses kajian tersimpan di semua perangkat Anda.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs">
                      <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-[13px]">front_hand</span>
                      </div>
                      <div className="text-[11px]">
                        <span className="font-semibold text-on-surface">Tandai Hadir (InsyaAllah)</span>
                        <p className="text-outline text-[10px] leading-tight">Rekap rencana hadir kajian Anda & bantu estimasi jamaah.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs">
                      <div className="w-5 h-5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-[13px]">campaign</span>
                      </div>
                      <div className="text-[11px]">
                        <span className="font-semibold text-on-surface">Input Jadwal Kajian</span>
                        <p className="text-outline text-[10px] leading-tight">Bantu sebar jadwal kajian masjid terdekat sebagai relawan.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs">
                      <div className="w-5 h-5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-[13px]">notifications_active</span>
                      </div>
                      <div className="text-[11px]">
                        <span className="font-semibold text-on-surface">Pengingat Otomatis</span>
                        <p className="text-outline text-[10px] leading-tight">Notifikasi sebelum kajian dimulai agar tidak terlewat.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* AREA KANAN */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Banner Peringatan Mode Offline */}
        {(isOffline || hasConnectionError) && (
          <div className="bg-amber-600 dark:bg-amber-700 text-white text-xs font-medium px-4 py-2 flex items-center justify-between gap-2 shadow-sm z-30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[18px] shrink-0">wifi_off</span>
              <span className="truncate">
                <strong>Mode Offline</strong> — Perangkat tidak terhubung ke internet. Menampilkan kajian tersimpan di memori perangkat.
              </span>
            </div>
            <button
              type="button"
              onClick={() => refetchData(false)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              title="Coba Hubungkan Ulang"
            >
              <span className={`material-symbols-outlined text-[14px] ${isRefreshing ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>{isRefreshing ? 'Memuat...' : 'Coba Lagi'}</span>
            </button>
          </div>
        )}

        {/* MAIN CONTENT SPLIT */}
        <main className="flex-1 flex w-full h-full relative overflow-hidden bg-surface md:pb-0 pb-[64px] /* pb-16 untuk Bottom Nav di Mobile */">
          
          {/* Kolom Kanan: Map */}
          <div className="absolute inset-0 w-full h-full md:relative md:flex-1 bg-[#f1f5f9] overflow-hidden z-10">
            {/* Quick Access Floating Pill jika ada channel live */}
            <LiveStreamFloatingPill hasSelectedSession={!!selectedSession} />

            <MapComponent 
              sessions={sortedSessions} 
              selectedSession={selectedSession}
              onSelectSession={(session) => {
                setSelectedSession(session);
                if (session) setIsSheetExpanded(false);
              }}
              flyToRegion={filters.region}
            />
          </div>
          
          {/* Kolom Kiri: Search & List (Menjadi Bottom Sheet di Mobile) */}
          <div className={`
            absolute bottom-[64px] left-0 w-full z-20 rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]
            ${isSheetExpanded ? 'h-[65vh]' : 'h-[160px]'}
            md:relative md:w-[410px] lg:w-[430px] md:h-full md:rounded-none md:shadow-[1px_0_0_0_rgba(226,232,240,0.8)] md:bottom-auto
            shrink-0 flex flex-col bg-surface-container-lowest overflow-hidden transition-all duration-300 ease-in-out
            md:order-first
          `}>
            {/* Drag Handle Indicator (Hanya tampil di Mobile) */}
            <div 
              className="md:hidden w-full flex justify-center pt-3 pb-2 shrink-0 cursor-pointer hover:bg-surface-container-low transition-colors"
              onClick={() => setIsSheetExpanded(!isSheetExpanded)}
            >
              <div className="w-12 h-1.5 rounded-full bg-outline/60"></div>
            </div>

            <div className="flex-1 overflow-hidden">
              <SidebarFilter 
                filters={filters} 
                setFilters={setFilters} 
                sessions={sortedSessions} 
                allSessions={sessions}
                selectedSession={selectedSession}
                onSelectSession={(session) => {
                  setSelectedSession(session);
                  if (session) setIsSheetExpanded(false); // Otomatis collapse saat kajian dipilih agar map terlihat
                }}
                isLoading={isLoading}
                userLocation={userLocation}
                isRefreshing={isRefreshing}
                onRefresh={() => refetchData(false)}
                currentUser={currentUser}
                hasConnectionError={hasConnectionError}
                isOffline={isOffline}
              />
            </div>
          </div>
          
        </main>

        {/* MOBILE BOTTOM NAVIGATION (Hanya di HP) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-container-lowest shadow-[0_-2px_12px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom,0px)] border-t border-surface-container-high/50">
          <div className="flex items-center justify-around h-16 px-2">
            <a href="#" className="flex flex-col items-center justify-center min-w-[56px] h-12 text-primary font-bold">
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
              <span className="text-[10px] mt-0.5 tracking-tight">Peta</span>
            </a>
            <Link 
              href="/live"
              className="flex flex-col items-center justify-center min-w-[56px] h-12 text-red-600 dark:text-red-400 hover:text-red-700 transition-colors relative"
            >
              <div className="relative">
                <span className="material-symbols-outlined text-[22px]">smart_display</span>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-600 animate-ping" />
              </div>
              <span className="text-[10px] mt-0.5 font-bold tracking-tight">Live</span>
            </Link>
            <Link 
              href="/leaderboard"
              className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[22px] text-amber-500">workspace_premium</span>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">Peringkat</span>
            </Link>
            {currentUser ? (
              <>
                {currentUserRole === 'admin' || currentUserRole === 'kontributor' ? (
                  <Link 
                    href="/kontributor/dashboard" 
                    className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[22px]">add_circle</span>
                    <span className="text-[10px] mt-0.5 font-medium tracking-tight">Kirim</span>
                  </Link>
                ) : (
                  <Link 
                    href="/kontributor/profile" 
                    className="flex flex-col items-center justify-center min-w-[56px] h-12 text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[22px]">volunteer_activism</span>
                    <span className="text-[10px] mt-0.5 font-medium tracking-tight">Relawan</span>
                  </Link>
                )}

                <Link
                  href="/kontributor/profile"
                  className="flex flex-col items-center justify-center min-w-[56px] h-12 text-outline hover:text-on-surface transition-colors"
                >
                  <HeaderAvatar url={currentUser.user_metadata?.avatar_url} size="w-6 h-6" />
                  <span className="text-[10px] mt-0.5 font-medium tracking-tight">Profil</span>
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="flex flex-col items-center justify-center min-w-[56px] h-12 text-primary font-bold hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[22px]">login</span>
                <span className="text-[10px] mt-0.5 tracking-tight font-bold">Masuk</span>
              </Link>
            )}
          </div>
        </nav>
      </div>

      {/* Modal Permohonan Menjadi Kontributor */}
      <RequestContributorModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={() => setIsRequestModalOpen(false)}
        userEmail={currentUser?.email || undefined}
      />
    </div>
  );
}
