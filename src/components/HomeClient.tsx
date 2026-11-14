'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import SidebarFilter from '@/components/SidebarFilter';
import { hasPhysicalLocation, type StudySession } from '@/lib/services/kajian';
import { evaluateAndQuerySessions } from '@/lib/domain/kajianQuery';
import { calculateDistance } from '@/utils/distance';
import { createClient } from '@/utils/supabase/client';
import { type SelectedRegion, sessionMatchesRegion } from '@/utils/regions';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { useOnlineStatus } from '@/utils/offlineCache';
import { useActiveSessionsQuery } from '@/lib/hooks/useActiveSessionsQuery';
import { getUserRoleAndStatus } from '@/lib/services/admin';
import LiveStreamFloatingPill from '@/components/LiveStreamFloatingPill';
import { useBottomNav } from '@/context/BottomNavContext';
import { fetchRoute, type RouteResult } from '@/lib/services/routing';
import {
  type NavigationVehicleIcon,
  getStoredVehicleIcon,
} from '@/utils/navigationVehicle';
import { getSavedParkingSpot, type SavedParkingSpot } from '@/utils/parkingSpot';
import { MapCanvasSkeleton } from '@/components/PetaPageSkeleton';
import DesktopTopNavbar from '@/components/navigation/DesktopTopNavbar';

const InAppRoutePanel = dynamic(() => import('@/components/InAppRoutePanel'), {
  ssr: false,
});

const LiveNavigationHUD = dynamic(() => import('@/components/LiveNavigationHUD'), {
  ssr: false,
});

const RequestContributorModal = dynamic(() => import('@/components/RequestContributorModal'), {
  ssr: false,
});

const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <MapCanvasSkeleton />,
});

export type FilterState = {
  time: string;
  audience: string[];
  radius: number;
  searchQuery: string;
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
    region: null,
  });

  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
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
  const [vehicleIcon, setVehicleIcon] = useState<NavigationVehicleIcon>('car');

  useEffect(() => {
    const stored = getStoredVehicleIcon();
    setVehicleIcon(stored === 'motorcycle' ? 'motorcycle' : 'car');
  }, []);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [savedParkingSpot, setSavedParkingSpot] = useState<SavedParkingSpot | null>(null);

  useEffect(() => {
    setSavedParkingSpot(getSavedParkingSpot());
  }, []);

  const [activeRouteSession, setActiveRouteSession] = useState<StudySession | null>(null);
  const { setIsHidden: setIsBottomNavHidden } = useBottomNav();
  useEffect(() => {
    setIsBottomNavHidden(Boolean(activeRouteSession));
    if (!activeRouteSession && typeof document !== 'undefined') {
      document.body.style.pointerEvents = 'auto';
      document.body.removeAttribute('data-scroll-locked');
    }
    return () => setIsBottomNavHidden(false);
  }, [activeRouteSession, setIsBottomNavHidden]);
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
      const hasOAuthCode = window.location.search.includes('code=');

      // Jika TIDAK sedang dalam proses OAuth (tidak ada flag inProgress & tidak ada ?code= di URL),
      // jangan pernah lakukan auto-redirect! Bersihkan sisa flag lama jika ada.
      if (!inProgress && !hasOAuthCode) {
        if (targetNext) {
          sessionStorage.removeItem('peta_kajian_auth_next');
          const isHttps = window.location.protocol === 'https:';
          document.cookie = `peta_kajian_auth_next=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${isHttps ? '; Secure' : ''}`;
        }
        return;
      }

      // Jika tidak ada targetNext atau tujuannya beranda '/' atau '/peta', bersihkan flag
      if (
        !targetNext ||
        targetNext === '/' ||
        targetNext === '/peta' ||
        !targetNext.startsWith('/') ||
        targetNext.startsWith('//')
      ) {
        sessionStorage.removeItem('peta_kajian_auth_in_progress');
        sessionStorage.removeItem('peta_kajian_auth_next');
        const isHttps = window.location.protocol === 'https:';
        document.cookie = `peta_kajian_auth_next=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${isHttps ? '; Secure' : ''}`;
        return;
      }

      // Jika ada targetNext selain beranda/peta (misal '/live' atau '/kontributor/profile'):
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
      if (hasOAuthCode) {
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
      } else if (inProgress) {
        // Cek apakah benar ada user session aktif sebelum redirect
        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user) {
            proceedRedirect();
          } else {
            sessionStorage.removeItem('peta_kajian_auth_in_progress');
            sessionStorage.removeItem('peta_kajian_auth_next');
          }
        });
      }
    } catch {}
  }, []);

  // Fungsi untuk meminta lokasi pengguna
  const requestUserLocation = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          if (typeof position.coords.accuracy === 'number') {
            setUserAccuracy(position.coords.accuracy);
          }
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
    setMobileView('map'); // Alihkan ke tampilan peta saat rute aktif

    // Otomatis tentukan ikon kursor: jika jalan kaki -> person, jika kendaraan -> mobil/motor (default mobil)
    if (routeMode === 'walking') {
      setVehicleIcon('person');
    } else {
      const stored = getStoredVehicleIcon();
      setVehicleIcon(stored === 'motorcycle' ? 'motorcycle' : 'car');
    }

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

    // Otomatis sinkronkan ikon kursor: jalan kaki -> person, kendaraan -> mobil/motor
    if (newMode === 'walking') {
      setVehicleIcon('person');
    } else {
      const stored = getStoredVehicleIcon();
      setVehicleIcon(stored === 'motorcycle' ? 'motorcycle' : 'car');
    }

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
            if (typeof pos.coords.accuracy === 'number') {
              setUserAccuracy(pos.coords.accuracy);
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

    // Bersihkan pointer-events lock Radix/Vaul pada body
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = 'auto';
      document.body.removeAttribute('data-scroll-locked');
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
    setSelectedSession(session ? { ...session } : null);
    if (session && typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileView('map');
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

    // Pastikan pointer-events dan scroll-lock selalu pulih saat menutup rute/navigasi
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = 'auto';
      document.body.removeAttribute('data-scroll-locked');
      setTimeout(() => {
        document.body.style.pointerEvents = 'auto';
        document.body.removeAttribute('data-scroll-locked');
      }, 50);
      setTimeout(() => {
        document.body.style.pointerEvents = 'auto';
        document.body.removeAttribute('data-scroll-locked');
      }, 500);
    }
  }, [activeRouteSession, handleExitLiveNav]);

  // Handler untuk rerouting otomatis saat off-route
  const handleReroute = useCallback(async (newOrigin: { lat: number; lng: number }) => {
    if (!activeRouteSession?.venues) return;
    try {
      const result = await fetchRoute(
        [newOrigin.lng, newOrigin.lat],
        [activeRouteSession.venues.lng, activeRouteSession.venues.lat],
        routeMode
      );
      if (result) {
        setActiveRoute(result);
      }
    } catch (err) {
      console.warn('Gagal menghitung ulang rute:', err);
    }
  }, [activeRouteSession, routeMode]);

  // Handler pemilihan rute alternatif OSRM
  const handleSelectAlternativeRoute = useCallback((route: RouteResult) => {
    setActiveRoute(route);
  }, []);

  // Handler saat posisi parkir disimpan atau dihapus
  const handleParkingSaved = useCallback(() => {
    setSavedParkingSpot(getSavedParkingSpot());
  }, []);

  const handleClearParking = useCallback(() => {
    setSavedParkingSpot(null);
  }, []);

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

  // Mesin Pencarian & Pemeringkatan Kajian (Kajian Schedule & Query Engine)
  const evaluatedSessions = useMemo(() => {
    return evaluateAndQuerySessions(sessions, {
      filter: {
        placement: 'map',
        region: filters.region,
        searchQuery: filters.searchQuery,
        audience: filters.audience,
        time: filters.time,
        bookmarkedIds: bookmarks,
      },
      sort: {
        userLocation,
        mode: filters.time === 'terdekat' ? 'distance' : 'auto',
      },
    });
  }, [sessions, filters, bookmarks, userLocation]);

  const sortedSessions = useMemo(() => {
    return evaluatedSessions.map((e) => e.session);
  }, [evaluatedSessions]);

  // Deep-linking: auto-select session from ?session=<id>, ?q=<search>, ?time=<filter> in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      const time = params.get('time');
      if (q || time) {
        setFilters(p => ({
          ...p,
          searchQuery: q !== null && q.trim() !== '' ? q : p.searchQuery,
          time: time !== null && time.trim() !== '' ? time : p.time,
        }));
      }
    }
  }, []);

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
          setMobileView('map');
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

    const regionChanged = prevFiltersRef.current.region !== filters.region;
    const switchedToNearby =
      prevFiltersRef.current.time !== filters.time && filters.time === 'terdekat';

    const filtersChanged =
      prevFiltersRef.current.time !== filters.time ||
      prevFiltersRef.current.searchQuery !== filters.searchQuery ||
      regionChanged ||
      JSON.stringify(prevFiltersRef.current.audience) !== JSON.stringify(filters.audience);

    const locationJustArrived = !prevUserLocationRef.current && !!userLocation && filters.time === 'terdekat';
    prevUserLocationRef.current = userLocation;

    const isRegionOrLocationMode = Boolean(filters.region || filters.time === 'terdekat');

    if (filtersChanged || locationJustArrived) {
      prevFiltersRef.current = filters;
      // Saat filter by wilayah/lokasi (region dipilih atau tab Terdekat aktif),
      // tidak memilih kajian manapun terlebih dahulu agar peta menampilkan area bulatan wilayah/radius
      if ((regionChanged && filters.region) || switchedToNearby || locationJustArrived || isRegionOrLocationMode) {
        setSelectedSession(null);
      } else if (sortedSessions.length > 0) {
        // Setiap kali berpindah filter lain: trigger aktif kajian paling atas (urutan pertama)
        setSelectedSession({ ...sortedSessions[0] });
      } else {
        setSelectedSession(null);
      }
    } else {
      // Jika filter TIDAK berubah (misal pembaruan background data dari query),
      // pertahankan sesi yang sedang dilihat jika masih ada dalam daftar
      if (sortedSessions.length > 0) {
        setSelectedSession(prev => {
          if (!prev) {
            return isRegionOrLocationMode ? null : sortedSessions[0];
          }
          if (sortedSessions.some(s => s.id === prev.id)) {
            return prev;
          }
          return isRegionOrLocationMode ? null : sortedSessions[0];
        });
      } else {
        setSelectedSession(null);
      }
    }
  }, [filters, sortedSessions, activeRouteSession, userLocation]);

  return (
    <div className="w-full h-screen bg-surface font-sans text-on-surface flex flex-col overflow-hidden">
      {/* NAVBAR DESKTOP UNIFIED (lg+) */}
      <DesktopTopNavbar
        fullWidth
        searchQuery={filters.searchQuery}
        onSearchChange={(q) => setFilters((prev) => ({ ...prev, searchQuery: q }))}
        searchPlaceholder="Cari kajian, ustadz, kitab, atau masjid..."
      />

      <div className="flex-1 flex min-h-0 overflow-hidden relative">
      {/* AREA UTAMA SPLIT SCREEN (DAFTAR KAJIAN + PETA) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
        
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
        <main className={`flex-1 flex min-h-0 w-full h-full relative overflow-hidden bg-surface ${
          activeRouteSession ? 'pb-0' : 'md:pb-0 pb-[64px]'
        }`}>
          
          {/* Kolom Daftar Kajian:
              - Desktop (md:): selalu tampil di samping kiri (md:w-[420px] lg:w-[465px] xl:w-[495px])
              - Mobile (<md): tampil penuh saat mobileView === 'list', disembunyikan saat mobileView === 'map'
          */}
          <aside
            className={`h-full min-h-0 flex-col bg-surface border-r border-outline-variant/25 shrink-0 z-30 overflow-hidden ${
              mobileView === 'list'
                ? 'flex w-full absolute inset-0 md:relative md:inset-auto md:w-[420px] lg:w-[465px] xl:w-[495px]'
                : 'hidden md:flex md:w-[420px] lg:w-[465px] xl:w-[495px]'
            }`}
          >
            <SidebarFilter 
              filters={filters} 
              setFilters={setFilters} 
              sessions={sortedSessions} 
              evaluatedSessions={evaluatedSessions}
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

          {/* Tombol Melayang "Lihat Peta" (Khusus Mobile saat tampilan Daftar) */}
          {mobileView === 'list' && !isNavigating && !activeRouteSession && (
            <button
              type="button"
              onClick={() => setMobileView('map')}
              className="md:hidden fixed z-40 bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-emerald-500/40"
              title="Buka Tampilan Peta"
              aria-label="Buka Tampilan Peta"
            >
              <span className="material-symbols-outlined text-[17px]">map</span>
              <span>Lihat Peta</span>
              <span className="px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] font-extrabold">
                {sortedSessions.length}
              </span>
            </button>
          )}

          {/* Kolom Kanan: Map
              - Desktop (md:): flex-1 selalu terlihat di kanan
              - Mobile (<md): tampil penuh saat mobileView === 'map', disembunyikan saat mobileView === 'list'
          */}
          <div
            className={`w-full h-full md:relative md:flex-1 bg-[#f1f5f9] overflow-hidden z-10 ${
              mobileView === 'map' ? 'block absolute inset-0 md:relative md:inset-auto' : 'hidden md:block'
            }`}
          >
            {/* Quick Access Floating Pill jika ada channel live (khusus desktop, disembunyikan di mobile agar peta mobile bersih) */}
            {!isNavigating && (
              <div className="hidden md:block">
                <LiveStreamFloatingPill hasSelectedSession={!!selectedSession} isNavigating={isNavigating} />
              </div>
            )}

            {/* Floating Controls di Peta Mobile: Tombol Kembali ke Daftar & Info Wilayah */}
            {!isNavigating && !activeRouteSession && mobileView === 'map' && (
              <div className="md:hidden absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
                {/* Chip Info Wilayah & Total Kajian */}
                <div className="pointer-events-auto">
                  <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-md border backdrop-blur-md bg-surface-container-lowest/95 text-on-surface border-surface-container-high">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">location_on</span>
                    <span className="truncate max-w-[140px]">
                      {filters.region ? filters.region.name : filters.time === 'terdekat' ? 'Terdekat Saya' : 'Semua Wilayah'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-extrabold">
                      {sortedSessions.length}
                    </span>
                  </div>
                </div>

                {/* Tombol Kembali ke Daftar */}
                <div className="pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-surface-container-lowest/95 text-on-surface border border-surface-container-high shadow-md backdrop-blur-md cursor-pointer active:scale-95 transition-transform"
                    title="Buka Tampilan Daftar Kajian"
                    aria-label="Buka Tampilan Daftar Kajian"
                  >
                    <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                    <span>Daftar</span>
                  </button>
                </div>
              </div>
            )}

            <MapComponent 
              sessions={sortedSessions} 
              selectedSession={selectedSession}
              onSelectSession={handleSelectSession}
              flyToRegion={filters.region}
              isNearbyFilter={filters.time === 'terdekat'}
              radiusKm={filters.radius || 25}
              activeRoute={activeRoute}
              userLocation={userLocation}
              onStartRoute={handleStartRoute}
              isNavigating={isNavigating}
              userHeading={userHeading}
              vehicleIcon={vehicleIcon}
              onVehicleIconChange={setVehicleIcon}
              savedParkingSpot={savedParkingSpot}
              onClearParkingSpot={handleClearParking}
              onSelectAlternativeRoute={handleSelectAlternativeRoute}
              mobileView={mobileView}
            />

            {/* Panel Rute In-App Pratinjau (Tampil sebelum mulai navigasi langsung) */}
            {activeRouteSession && !isNavigating && (
              <InAppRoutePanel
                session={activeRouteSession}
                routeResult={activeRoute}
                isLoading={isRouteLoading}
                mode={routeMode}
                onModeChange={handleModeChange}
                onSelectAlternativeRoute={handleSelectAlternativeRoute}
                onClose={handleCloseRoute}
                userLocation={userLocation}
                errorMessage={routeError}
                onStartLiveNavigation={handleStartLiveNav}
                isDesktop={isDesktop}
              />
            )}

            {/* Mode Navigasi Langsung In-App (Top HUD Banner & Bottom Control Bar) */}
            {activeRouteSession && isNavigating && activeRoute && (
              <LiveNavigationHUD
                session={activeRouteSession}
                routeResult={activeRoute}
                userLocation={userLocation}
                userHeading={userHeading}
                userAccuracy={userAccuracy}
                onExit={handleExitLiveNav}
                onFinish={handleCloseRoute}
                onReroute={handleReroute}
                isMuted={isNavMuted}
                onToggleMute={() => setIsNavMuted((prev) => !prev)}
                vehicleIcon={vehicleIcon}
                onVehicleIconChange={setVehicleIcon}
                onParkingSaved={handleParkingSaved}
              />
            )}
          </div>
        </main>
      </div>
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
