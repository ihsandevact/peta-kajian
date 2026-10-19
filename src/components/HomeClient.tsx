'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import SidebarFilter from '@/components/SidebarFilter';
import { hasPhysicalLocation, type StudySession } from '@/lib/services/kajian';
import { calculateDistance } from '@/utils/distance';
import { createClient } from '@/utils/supabase/client';
import { type SelectedRegion, sessionMatchesRegion } from '@/utils/regions';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { useOnlineStatus } from '@/utils/offlineCache';
import { useActiveSessionsQuery } from '@/lib/hooks/useActiveSessionsQuery';
import { getUserRoleAndStatus } from '@/lib/services/admin';
import RequestContributorModal from '@/components/RequestContributorModal';
import LiveStreamFloatingPill from '@/components/LiveStreamFloatingPill';
import InAppRoutePanel from '@/components/InAppRoutePanel';
import LiveNavigationHUD from '@/components/LiveNavigationHUD';
import { fetchRoute, type RouteResult } from '@/lib/services/routing';
import { Drawer } from 'vaul';

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

  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);
  const [snapPoint, setSnapPoint] = useState<string | number | null>(0.65);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    const mql = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [activeRouteSession, setActiveRouteSession] = useState<StudySession | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [routeMode, setRouteMode] = useState<'driving' | 'walking'>('driving');
  const [isRouteLoading, setIsRouteLoading] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [isNavMuted, setIsNavMuted] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'kontributor' | 'user' | null>(null);

  // TanStack Query untuk data fetching kajian
  const {
    sessions,
    isLoading,
    isRefreshing,
    hasConnectionError,
    refetch: handleManualRefresh,
  } = useActiveSessionsQuery({
    currentUserRole,
    isOffline,
  });

  // Pertahankan selectedSession agar data terbarunya tersinkron saat refresh
  useEffect(() => {
    if (selectedSession && sessions.length > 0) {
      const updated = sessions.find((s) => s.id === selectedSession.id);
      if (updated) setSelectedSession(updated);
    }
  }, [sessions]);

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

  // Fungsi untuk meminta lokasi pengguna
  const requestUserLocation = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (error) => {
          console.warn('Gagal mendapatkan lokasi GPS pengguna:', error);
          // Silent fail agar tidak mengganggu pengguna yang menolak akses GPS
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Minta lokasi pengguna saat aplikasi dimuat
  useEffect(() => {
    requestUserLocation();
  }, [requestUserLocation]);

  // Handler untuk memulai navigasi rute jalan in-app
  const handleStartRoute = useCallback(async (session: StudySession) => {
    if (!session.venues || typeof session.venues.lat !== 'number' || typeof session.venues.lng !== 'number') {
      alert('Lokasi kajian tidak memiliki koordinat GPS yang valid.');
      return;
    }

    setActiveRouteSession(session);
    setIsRouteLoading(true);
    setRouteError(null);
    setSelectedSession(null); // Tutup popup info agar tampilan peta bersih untuk rute
    setSnapPoint('224px'); // Ciutkan bottom sheet ke peek saat rute aktif/selesai

    let origin = userLocation;
    if (!origin) {
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });
          origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(origin);
        } catch (err) {
          console.warn('Geolocation permission denied or timed out:', err);
          setIsRouteLoading(false);
          setRouteError('Mohon izinkan akses lokasi (GPS) pada perangkat Anda untuk menghitung rute ke masjid.');
          return;
        }
      } else {
        setIsRouteLoading(false);
        setRouteError('Browser/perangkat Anda tidak mendukung fitur lokasi GPS.');
        return;
      }
    }

    try {
      const result = await fetchRoute(
        [origin.lng, origin.lat],
        [session.venues.lng, session.venues.lat],
        routeMode
      );
      if (result) {
        setActiveRoute(result);
      } else {
        setRouteError('Tidak dapat menemukan rute jalan ke lokasi kajian ini.');
      }
    } catch (err) {
      console.error('Failed to fetch route:', err);
      setRouteError('Gagal memuat rute jalan. Silakan coba kembali atau buka via Google Maps.');
    } finally {
      setIsRouteLoading(false);
    }
  }, [routeMode, userLocation]);

  // Ganti moda transportasi (berkendara vs jalan kaki)
  const handleModeChange = useCallback(async (newMode: 'driving' | 'walking') => {
    setRouteMode(newMode);
    if (activeRouteSession && userLocation && activeRouteSession.venues) {
      setIsRouteLoading(true);
      setRouteError(null);
      try {
        const result = await fetchRoute(
          [userLocation.lng, userLocation.lat],
          [activeRouteSession.venues.lng, activeRouteSession.venues.lat],
          newMode
        );
        if (result) {
          setActiveRoute(result);
        } else {
          setRouteError('Tidak dapat menemukan rute jalan untuk moda transportasi ini.');
        }
      } catch {
        setRouteError('Gagal memperbarui rute moda transportasi.');
      } finally {
        setIsRouteLoading(false);
      }
    }
  }, [activeRouteSession, userLocation]);

  // Mulai navigasi langsung (HUD mode, 3D camera, Screen Wake Lock, continuous GPS tracking)
  const handleStartLiveNav = useCallback(() => {
    setIsNavigating(true);

    // 1. Minta Screen Wake Lock agar layar HP tidak mati otomatis
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        (navigator as any).wakeLock.request('screen').then((lock: any) => {
          wakeLockRef.current = lock;
        }).catch((err: any) => {
          console.warn('Wake Lock request error:', err);
        });
      } catch (e) {
        console.warn('Wake Lock not supported:', e);
      }
    }

    // 2. Mulai continuous GPS tracking dengan watchPosition
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            if (typeof pos.coords.heading === 'number' && !isNaN(pos.coords.heading)) {
              setUserHeading(pos.coords.heading);
            }
          },
          (err) => {
            console.warn('Geolocation watchPosition error:', err);
          },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        );
        watchIdRef.current = watchId;
      } catch (err) {
        console.warn('watchPosition failure:', err);
      }
    }
  }, []);

  // Hentikan mode navigasi langsung
  const handleExitLiveNav = useCallback(() => {
    setIsNavigating(false);

    // Hentikan GPS watch
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Lepaskan Screen Wake Lock
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }

    // Hentikan suara jika sedang berbicara
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Handler pemilihan kajian terpusat: otomatis membersihkan rute/navigasi jika memilih kajian lain
  const handleSelectSession = useCallback((session: StudySession | null) => {
    if (activeRouteSession && (!session || session.id !== activeRouteSession.id)) {
      handleExitLiveNav();
      setActiveRouteSession(null);
      setActiveRoute(null);
      setRouteError(null);
    }
    setSelectedSession(session);
    if (session) {
      setSnapPoint('224px');
    }
  }, [activeRouteSession, handleExitLiveNav]);

  // Tutup panel dan bersihkan garis rute di peta, serta pulihkan state floating card kajian awal
  const handleCloseRoute = useCallback(() => {
    const prevSession = activeRouteSession;
    handleExitLiveNav();
    setActiveRouteSession(null);
    setActiveRoute(null);
    setRouteError(null);
    if (prevSession) {
      // Kloning objek agar referensi state baru dan memicu flyToSession di Map.tsx
      setSelectedSession({ ...prevSession });
    }
  }, [activeRouteSession, handleExitLiveNav]);

  // Bersihkan GPS watch dan Wake Lock saat komponen unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
      if (filters.time === 'akhwat' && s.audience_type !== 'akhwat') return false;
      
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
          setSnapPoint('224px');
        }
      }
    }
  }, [sessions]);

  const prevFiltersRef = useRef<FilterState>(filters);
  const prevUserLocationRef = useRef<{lat: number, lng: number} | null>(userLocation);

  // OBSERVER: Auto-Focus dinamis setiap kali daftar filter/sorting berubah
  useEffect(() => {
    // Jika rute sedang aktif atau dalam proses navigasi, jangan ubah selectedSession secara otomatis
    if (activeRouteSession) return;

    const filtersChanged =
      prevFiltersRef.current.time !== filters.time ||
      prevFiltersRef.current.searchQuery !== filters.searchQuery ||
      prevFiltersRef.current.region !== filters.region ||
      JSON.stringify(prevFiltersRef.current.audience) !== JSON.stringify(filters.audience) ||
      JSON.stringify(prevFiltersRef.current.facilities) !== JSON.stringify(filters.facilities);

    const locationJustArrived = !prevUserLocationRef.current && !!userLocation && filters.time === 'terdekat';
    prevUserLocationRef.current = userLocation;

    if (filtersChanged || locationJustArrived) {
      prevFiltersRef.current = filters;
      if (sortedSessions.length > 0) {
        // Setiap kali berpindah filter: SELALU trigger aktif kajian paling atas (urutan pertama)
        setSelectedSession({ ...sortedSessions[0] });
      } else {
        setSelectedSession(null);
      }
    } else {
      // Jika filter TIDAK berubah (misal pembaruan background data dari query),
      // pertahankan sesi yang sedang dilihat jika masih ada dalam daftar
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
    }
  }, [filters, sortedSessions, activeRouteSession, userLocation]);

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
                    Masuk dengan Google untuk membuka fitur agenda & catatan majelis Anda:
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
              onClick={handleManualRefresh}
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
        <main className={`flex-1 flex w-full h-full relative overflow-hidden bg-surface transition-all duration-300 ${
          activeRouteSession ? 'pb-0' : 'md:pb-0 pb-[64px] /* pb-16 untuk Bottom Nav di Mobile */'
        }`}>
          
          {/* Kolom Kanan: Map */}
          <div className="absolute inset-0 w-full h-full md:relative md:flex-1 bg-[#f1f5f9] overflow-hidden z-10">
            {/* Quick Access Floating Pill jika ada channel live (disembunyikan saat mode navigasi aktif) */}
            {!isNavigating && (
              <LiveStreamFloatingPill hasSelectedSession={!!selectedSession} isNavigating={isNavigating} />
            )}

            <MapComponent 
              sessions={sortedSessions} 
              selectedSession={selectedSession}
              onSelectSession={handleSelectSession}
              flyToRegion={filters.region}
              activeRoute={activeRoute}
              userLocation={userLocation}
              onStartRoute={handleStartRoute}
              isNavigating={isNavigating}
              userHeading={userHeading}
            />

            {/* Panel Rute In-App Pratinjau (Tampil sebelum mulai navigasi langsung) */}
            {activeRouteSession && !isNavigating && (
              <InAppRoutePanel
                session={activeRouteSession}
                routeResult={activeRoute}
                isLoading={isRouteLoading}
                mode={routeMode}
                onModeChange={handleModeChange}
                onClose={handleCloseRoute}
                userLocation={userLocation}
                errorMessage={routeError}
                onStartLiveNavigation={handleStartLiveNav}
              />
            )}

            {/* Mode Navigasi Langsung In-App (Top HUD Banner & Bottom Control Bar) */}
            {activeRouteSession && isNavigating && activeRoute && (
              <LiveNavigationHUD
                session={activeRouteSession}
                routeResult={activeRoute}
                userLocation={userLocation}
                userHeading={userHeading}
                onExit={handleExitLiveNav}
                onFinish={handleCloseRoute}
                isMuted={isNavMuted}
                onToggleMute={() => setIsNavMuted((prev) => !prev)}
              />
            )}
          </div>
          
          {/* Kolom Kiri Desktop: Search & List (hanya tampil di layar md ke atas) */}
          {(!isMounted || isDesktop) && (
            <aside className="hidden md:flex w-[410px] lg:w-[430px] h-full shrink-0 flex-col bg-surface-container-lowest shadow-[1px_0_0_0_rgba(226,232,240,0.8)] order-first overflow-hidden">
              <SidebarFilter 
                filters={filters} 
                setFilters={setFilters} 
                sessions={sortedSessions} 
                allSessions={sessions}
                selectedSession={selectedSession}
                onSelectSession={handleSelectSession}
                isLoading={isLoading}
                userLocation={userLocation}
                onRequestLocation={requestUserLocation}
                isRefreshing={isRefreshing}
                onRefresh={handleManualRefresh}
                currentUser={currentUser}
                hasConnectionError={hasConnectionError}
                isOffline={isOffline}
              />
            </aside>
          )}

          {/* Kolom Kiri Mobile: Vaul Bottom Sheet Drawer dengan Native Gestures & Snap Points */}
          {isMounted && !isDesktop && (
            <div className="md:hidden">
              <Drawer.Root
                snapPoints={['224px', 0.65, 0.92]}
                activeSnapPoint={snapPoint}
                setActiveSnapPoint={setSnapPoint}
                modal={false}
                dismissible={false}
                open={!activeRouteSession}
              >
                <Drawer.Portal>
                  <Drawer.Content 
                    className="md:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col h-[92dvh] max-h-[92dvh] bg-surface-container-lowest rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-surface-container-high/60 focus:outline-none pb-[calc(64px+env(safe-area-inset-bottom,0px))]"
                  >
                    <Drawer.Title className="sr-only">Daftar &amp; Filter Kajian</Drawer.Title>
                    <Drawer.Description className="sr-only">Navigasi dan filter daftar jadwal kajian</Drawer.Description>
                    
                    {/* Drag Handle Indicator */}
                    <div 
                      className="w-full flex justify-center pt-3 pb-2 shrink-0 cursor-pointer hover:bg-surface-container-low transition-colors touch-none"
                      onClick={() => setSnapPoint(prev => (prev === '224px' ? 0.65 : '224px'))}
                    >
                      <Drawer.Handle className="w-12 h-1.5 rounded-full bg-outline/60" />
                    </div>

                    <div className="flex-1 overflow-hidden min-h-0">
                      <SidebarFilter 
                        filters={filters} 
                        setFilters={setFilters} 
                        sessions={sortedSessions} 
                        allSessions={sessions}
                        selectedSession={selectedSession}
                        onSelectSession={handleSelectSession}
                        isLoading={isLoading}
                        userLocation={userLocation}
                        onRequestLocation={requestUserLocation}
                        isRefreshing={isRefreshing}
                        onRefresh={handleManualRefresh}
                        currentUser={currentUser}
                        hasConnectionError={hasConnectionError}
                        isOffline={isOffline}
                      />
                    </div>
                  </Drawer.Content>
                </Drawer.Portal>
              </Drawer.Root>
            </div>
          )}
          
        </main>

        {/* MOBILE BOTTOM NAVIGATION (Hanya di HP, otomatis meluncur keluar saat rute aktif) */}
        <nav className={`md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-container-lowest shadow-[0_-2px_12px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom,0px)] border-t border-surface-container-high/50 transition-transform duration-300 ${
          activeRouteSession ? 'translate-y-full opacity-0 pointer-events-none' : ''
        }`}>
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
