'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAllMosques,
  createDestinationSession,
  matchCityFilter,
  type MosqueVenue,
} from '@/lib/services/venues';
import { fetchRoute, type RouteResult } from '@/lib/services/routing';
import { calculateDistance } from '@/utils/distance';
import { getPrayerScheduleAndNext } from '@/utils/prayerTimes';
import { createClient } from '@/utils/supabase/client';
import { getUserRoleAndStatus } from '@/lib/services/admin';
import MosqueCardItem from './MosqueCardItem';
import MosqueCardSkeleton from './MosqueCardSkeleton';
import MosqueProfileModal from './MosqueProfileModal';
import MosqueRegionPickerModal, {
  doesMosqueMatchRegion,
  type MosqueRegionSelection,
} from './MosqueRegionPickerModal';
import ThemeToggle from './ThemeToggle';
import type { StudySession } from '@/lib/services/kajian';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  type NavigationVehicleIcon,
  getStoredVehicleIcon,
} from '@/utils/navigationVehicle';
import { getSavedParkingSpot, type SavedParkingSpot } from '@/utils/parkingSpot';

const MosqueMap = dynamic(() => import('./MosqueMap'), { ssr: false });
const InAppRoutePanel = dynamic(() => import('./InAppRoutePanel'), { ssr: false });
const LiveNavigationHUD = dynamic(() => import('./LiveNavigationHUD'), { ssr: false });

const PAGE_BATCH_SIZE = 40;
const MASJID_STATE_STORAGE_KEY = 'peta_kajian_masjid_state';

const QUICK_CITIES = [
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
];

export default function MosqueClient() {
  const [selectedMosque, setSelectedMosque] = useState<MosqueVenue | null>(null);
  const [profileMosque, setProfileMosque] = useState<MosqueVenue | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const [vehicleIcon, setVehicleIcon] = useState<NavigationVehicleIcon>('car');
  const [savedParkingSpot, setSavedParkingSpot] = useState<SavedParkingSpot | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Periksa status login dan apakah pengguna adalah Admin (untuk menentukan visibilitas data testing)
  useEffect(() => {
    const supabase = createClient();

    async function checkAdmin(u: any) {
      if (!u) {
        setIsAdmin(false);
        return;
      }
      try {
        const rInfo = await getUserRoleAndStatus(u);
        setIsAdmin(rInfo.role === 'admin');
      } catch {
        setIsAdmin(false);
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        checkAdmin(data.user);
      } else {
        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user) {
            checkAdmin(sess.session.user);
          }
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAdmin(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('Semua');
  const [selectedRegion, setSelectedRegion] = useState<MosqueRegionSelection | null>(null);
  const [onlyWithActiveSessions, setOnlyWithActiveSessions] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [isRadiusEnabled, setIsRadiusEnabled] = useState<boolean>(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list');
  const [isPrayerScheduleExpanded, setIsPrayerScheduleExpanded] = useState(false);
  const [prayerTick, setPrayerTick] = useState<number>(0);

  // Perbarui countdown waktu sholat setiap 30 detik
  useEffect(() => {
    const timer = setInterval(() => {
      setPrayerTick((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Navigation States
  const [activeRouteMosque, setActiveRouteMosque] = useState<MosqueVenue | null>(null);
  const [routeDestinationSession, setRouteDestinationSession] = useState<StudySession | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState<'driving' | 'walking'>('driving');
  const [isNavigating, setIsNavigating] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const routeParamHandledRef = useRef<boolean>(false);
  const skipNextScrollResetRef = useRef<boolean>(false);

  // Bersihkan sisa sessionStorage lama agar saat pertama kali load tidak otomatis memilih masjid apapun
  useEffect(() => {
    try {
      sessionStorage.removeItem(MASJID_STATE_STORAGE_KEY);
    } catch {}
  }, []);

  // Deteksi ukuran layar, ikon kendaraan tersimpan, dan lokasi parkir saat mount
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);

    const stored = getStoredVehicleIcon();
    setVehicleIcon(stored === 'motorcycle' ? 'motorcycle' : 'car');
    setSavedParkingSpot(getSavedParkingSpot());

    return () => mql.removeEventListener('change', handler);
  }, []);

  // Deteksi lokasi pengguna saat mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          if (typeof pos.coords.accuracy === 'number') {
            setUserAccuracy(pos.coords.accuracy);
          }
        },
        (err) => {
          console.warn('Geolocation permission not granted:', err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // 1. Fetch & cache daftar masjid menggunakan TanStack Query (data testing hanya disertakan jika isAdmin === true)
  const {
    data: rawMosques = [],
    isLoading: loading,
  } = useQuery({
    queryKey: ['mosques', 'directory', { isAdmin }],
    queryFn: () => fetchAllMosques({ limit: 50000, includeTestData: isAdmin }),
    staleTime: 1000 * 60 * 30, // Cache segar 30 menit
  });

  // 2. Hitung jarak GPS & urutkan dari terdekat secara in-memory tanpa refetch ke server
  const allMosques = React.useMemo(() => {
    if (!userLocation) return rawMosques;
    const withDist = rawMosques.map((m) => {
      if (typeof m.lat === 'number' && typeof m.lng === 'number') {
        const d = calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng);
        return { ...m, distance_km: Math.round(d * 10) / 10 };
      }
      return m;
    });
    return withDist.sort((a, b) => {
      if (a.distance_km === undefined) return 1;
      if (b.distance_km === undefined) return -1;
      return a.distance_km - b.distance_km;
    });
  }, [rawMosques, userLocation]);

  // Debounce teks pencarian & slider radius agar list 13.000+ item & kamera peta tidak thrashing
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const debouncedRadiusKm = useDebouncedValue(radiusKm, 150);

  // Infinite scroll state & refs untuk daftar kartu di sidebar (40 per batch)
  const [visibleCount, setVisibleCount] = useState(PAGE_BATCH_SIZE);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (skipNextScrollResetRef.current) {
      skipNextScrollResetRef.current = false;
      return;
    }
    setVisibleCount(PAGE_BATCH_SIZE);
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  }, [selectedCity, selectedRegion, onlyWithActiveSessions, debouncedSearch, debouncedRadiusKm, isRadiusEnabled]);

  // Memoized Filtering (kota/wilayah instan, radius di-debounce 150ms, teks pencarian di-debounce 300ms)
  const filteredMosques = React.useMemo(() => {
    let list = allMosques;

    // 1. Filter jarak radius dari lokasi GPS pengguna (jika aktif)
    if (isRadiusEnabled && userLocation) {
      list = list.filter((m) => typeof m.distance_km === 'number' && m.distance_km <= debouncedRadiusKm);
    }

    // 2. Filter hanya masjid yang punya kajian aktif (jika diaktifkan)
    if (onlyWithActiveSessions) {
      list = list.filter((m) => (m.active_sessions_count || 0) > 0);
    }

    // 3. Filter berdasarkan Provinsi/Kota dari Modal/BottomSheet
    if (selectedRegion) {
      list = list.filter((m) => doesMosqueMatchRegion(m, selectedRegion));
    } else if (selectedCity && selectedCity.toLowerCase() !== 'semua') {
      // 4. Atau filter berdasarkan Quick Cities pill
      list = list.filter((m) => matchCityFilter(m, selectedCity));
    }

    // 5. Filter teks pencarian (nama, alamat, kota)
    if (debouncedSearch && debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.address.toLowerCase().includes(q) ||
          (m.city && m.city.toLowerCase().includes(q))
      );
    }

    return list;
  }, [
    allMosques,
    isRadiusEnabled,
    userLocation,
    debouncedRadiusKm,
    selectedCity,
    selectedRegion,
    onlyWithActiveSessions,
    debouncedSearch,
  ]);

  const hasActiveFilterModal = Boolean(
    selectedRegion || onlyWithActiveSessions || (userLocation && isRadiusEnabled)
  );

  const visibleMosques = React.useMemo(
    () => filteredMosques.slice(0, visibleCount),
    [filteredMosques, visibleCount]
  );

  const hasMore = visibleCount < filteredMosques.length;

  // IntersectionObserver untuk Infinite Scroll otomatis saat mendekati bawah daftar
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    const root = listContainerRef.current;
    if (!sentinel || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_BATCH_SIZE, filteredMosques.length));
        }
      },
      {
        root,
        rootMargin: '300px',
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, filteredMosques.length, mobileView]);

  // Kirim seluruh hasil filter ke MosqueMap (GPU Supercluster menangani 13.000+ titik di zoom jauh & viewport filter untuk pin DOM)
  const mapMosques = React.useMemo(() => {
    if (selectedMosque && !filteredMosques.some((m) => m.id === selectedMosque.id)) {
      return [...filteredMosques, selectedMosque];
    }
    return filteredMosques;
  }, [filteredMosques, selectedMosque]);

  // Koordinat referensi & jadwal waktu sholat 5 waktu (mengikuti masjid terpilih -> lokasi GPS pengguna -> hasil filter -> Jakarta)
  const prayerSchedule = React.useMemo(() => {
    void prayerTick;
    let refLat = -6.2088;
    let refLng = 106.8456;

    if (
      selectedMosque &&
      typeof selectedMosque.lat === 'number' &&
      typeof selectedMosque.lng === 'number'
    ) {
      refLat = selectedMosque.lat;
      refLng = selectedMosque.lng;
    } else if (userLocation) {
      refLat = userLocation.lat;
      refLng = userLocation.lng;
    } else if (
      filteredMosques.length > 0 &&
      typeof filteredMosques[0].lat === 'number' &&
      typeof filteredMosques[0].lng === 'number'
    ) {
      refLat = filteredMosques[0].lat;
      refLng = filteredMosques[0].lng;
    }

    return getPrayerScheduleAndNext(refLat, refLng, new Date());
  }, [selectedMosque, userLocation, filteredMosques, prayerTick]);

  // Pastikan kartu masjid yang sedang dipilih selalu masuk dalam rentang visibleMosques di sidebar
  useEffect(() => {
    if (!selectedMosque || filteredMosques.length === 0) return;
    const idx = filteredMosques.findIndex((m) => m.id === selectedMosque.id);
    if (idx >= visibleCount) {
      setVisibleCount(
        Math.min(
          filteredMosques.length,
          Math.ceil((idx + 1) / PAGE_BATCH_SIZE) * PAGE_BATCH_SIZE
        )
      );
    }
  }, [selectedMosque, filteredMosques, visibleCount]);

  // Jika masjid yang sedang dipilih terfilter keluar dari daftar, tutup kartu infonya
  useEffect(() => {
    if (
      allMosques.length > 0 &&
      selectedMosque &&
      !filteredMosques.some((m) => m.id === selectedMosque.id)
    ) {
      setSelectedMosque(null);
    }
  }, [allMosques.length, filteredMosques, selectedMosque]);

  // Hentikan mode navigasi langsung (bersihkan watchPosition, Wake Lock, & SpeechSynthesis)
  const handleExitLiveNav = useCallback(() => {
    setIsNavigating(false);

    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Handler pemilihan masjid terpusat: otomatis membersihkan rute jika memilih masjid lain
  const handleSelectMosque = useCallback(
    (mosque: MosqueVenue | null) => {
      if (activeRouteMosque && (!mosque || mosque.id !== activeRouteMosque.id)) {
        handleExitLiveNav();
        setActiveRouteMosque(null);
        setRouteDestinationSession(null);
        setActiveRoute(null);
        setRouteError(null);
      }
      setSelectedMosque(mosque);
    },
    [activeRouteMosque, handleExitLiveNav]
  );

  // Buka Modal / Bottom Sheet Profil Masjid sekaligus tandai masjid sebagai terpilih terakhir
  const handleOpenProfile = useCallback(
    (mosque: MosqueVenue) => {
      handleSelectMosque(mosque);
      setProfileMosque(mosque);
      setTimeout(() => {
        const el = listContainerRef.current?.querySelector(
          `[data-mosque-id="${mosque.id}"]`
        ) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    },
    [handleSelectMosque]
  );

  // Stabilized callback untuk beralih ke tampilan peta pada layar mobile saat kartu diklik
  const handleCardFlyTo = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setMobileView('map');
    }
  }, []);

  // Handler memulai perhitungan rute navigasi in-app
  const handleStartRoute = useCallback(
    async (mosque: MosqueVenue) => {
      if (typeof mosque.lat !== 'number' || typeof mosque.lng !== 'number') {
        alert('Masjid ini tidak memiliki koordinat GPS yang valid.');
        return;
      }

      setActiveRouteMosque(mosque);
      setRouteDestinationSession(createDestinationSession(mosque));
      setIsRouteLoading(true);
      setRouteError(null);
      setSelectedMosque(null); // Tutup floating popup card agar peta bersih untuk rute
      setMobileView('map');

      if (routeMode === 'walking') {
        setVehicleIcon('person');
      } else {
        const stored = getStoredVehicleIcon();
        setVehicleIcon(stored === 'motorcycle' ? 'motorcycle' : 'car');
      }

      let origin = userLocation;
      if (!origin && 'geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });
          origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(origin);
          if (typeof pos.coords.accuracy === 'number') {
            setUserAccuracy(pos.coords.accuracy);
          }
        } catch (err) {
          console.warn('Gagal mendapatkan lokasi GPS:', err);
          setIsRouteLoading(false);
          setRouteError('Mohon izinkan akses lokasi (GPS) pada perangkat Anda untuk menghitung rute ke masjid.');
          return;
        }
      }

      if (!origin) {
        setIsRouteLoading(false);
        setRouteError('Lokasi Anda belum terdeteksi. Silakan aktifkan GPS.');
        return;
      }

      try {
        const result = await fetchRoute(
          [origin.lng, origin.lat],
          [mosque.lng, mosque.lat],
          routeMode
        );

        if (result) {
          setActiveRoute(result);
        } else {
          setRouteError('Tidak dapat menemukan rute jalan ke masjid ini.');
        }
      } catch (err) {
        console.error('Error calculating route:', err);
        setRouteError('Gagal memuat rute jalan. Silakan coba kembali atau buka via Google Maps.');
      } finally {
        setIsRouteLoading(false);
      }
    },
    [userLocation, routeMode]
  );

  // Ganti moda transportasi (Kendaraan vs Jalan Kaki) dan hitung ulang rute OSRM
  const handleModeChange = useCallback(
    async (newMode: 'driving' | 'walking') => {
      setRouteMode(newMode);

      if (newMode === 'walking') {
        setVehicleIcon('person');
      } else {
        const stored = getStoredVehicleIcon();
        setVehicleIcon(stored === 'motorcycle' ? 'motorcycle' : 'car');
      }

      if (activeRouteMosque && userLocation) {
        setIsRouteLoading(true);
        setRouteError(null);
        try {
          const result = await fetchRoute(
            [userLocation.lng, userLocation.lat],
            [activeRouteMosque.lng, activeRouteMosque.lat],
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
    },
    [activeRouteMosque, userLocation]
  );

  // Mulai navigasi langsung (HUD mode, 3D camera, Screen Wake Lock, continuous GPS tracking)
  const handleStartLiveNav = useCallback(() => {
    setIsNavigating(true);

    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        (navigator as any).wakeLock
          .request('screen')
          .then((lock: any) => {
            wakeLockRef.current = lock;
          })
          .catch((err: any) => {
            console.warn('Wake Lock request error:', err);
          });
      } catch (e) {
        console.warn('Wake Lock not supported:', e);
      }
    }

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

  // Tutup panel rute dan pulihkan floating card masjid sebelumnya
  const handleCloseRoute = useCallback(() => {
    const prevMosque = activeRouteMosque;
    handleExitLiveNav();
    setActiveRouteMosque(null);
    setRouteDestinationSession(null);
    setActiveRoute(null);
    setRouteError(null);
    if (prevMosque) {
      setSelectedMosque({ ...prevMosque });
    }
  }, [activeRouteMosque, handleExitLiveNav]);

  // Rerouting otomatis saat pengguna keluar jalur (off-route)
  const handleReroute = useCallback(
    async (newOrigin: { lat: number; lng: number }) => {
      if (!activeRouteMosque) return;
      try {
        const result = await fetchRoute(
          [newOrigin.lng, newOrigin.lat],
          [activeRouteMosque.lng, activeRouteMosque.lat],
          routeMode
        );
        if (result) {
          setActiveRoute(result);
        }
      } catch (err) {
        console.warn('Gagal menghitung ulang rute:', err);
      }
    },
    [activeRouteMosque, routeMode]
  );

  // Pilih rute alternatif OSRM
  const handleSelectAlternativeRoute = useCallback((route: RouteResult) => {
    setActiveRoute(route);
  }, []);

  // Simpan / hapus lokasi parkir
  const handleParkingSaved = useCallback(() => {
    setSavedParkingSpot(getSavedParkingSpot());
  }, []);

  const handleClearParking = useCallback(() => {
    setSavedParkingSpot(null);
  }, []);

  // Bersihkan GPS watch & Wake Lock saat unmount
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

  // Deep-linking eksplisit via URL (?route=<id/slug> atau ?masjid=<id/slug>)
  useEffect(() => {
    if (routeParamHandledRef.current || allMosques.length === 0 || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const routeTarget = params.get('route');
    const selectTarget = params.get('masjid');

    const target = routeTarget || selectTarget;
    if (!target) return;

    const found = allMosques.find((m) => m.id === target || m.slug === target);
    routeParamHandledRef.current = true;

    if (found) {
      if (routeTarget) {
        handleStartRoute(found);
      } else {
        handleSelectMosque(found);
      }
    }
  }, [allMosques, handleStartRoute, handleSelectMosque]);

  return (
    <div className="relative w-full h-[100dvh] flex flex-col bg-background text-on-surface overflow-hidden">
      {/* BODY KONTEN (SPLIT SCREEN DESKTOP / SWITCH VIEW MOBILE) */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* SIDEBAR PANEL (DAFTAR & FILTER MASJID) */}
        <aside
          className={`w-full sm:w-[420px] lg:w-[480px] xl:w-[510px] h-full flex flex-col bg-surface border-r border-outline-variant/40 shrink-0 z-30 transition-transform duration-200 ${
            mobileView === 'list'
              ? 'flex absolute inset-0 sm:relative sm:inset-auto'
              : 'hidden sm:flex'
          }`}
        >
          {/* SIDEBAR HEADER + SEARCH & FILTERS */}
          <div className="p-3 sm:p-4 border-b border-outline-variant/40 space-y-3 bg-surface shrink-0">
            {/* Baris 1: Header Sebatas Lebar Sidebar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-container text-on-surface transition-colors shrink-0"
                  title="Kembali ke Beranda"
                  aria-label="Kembali ke Beranda"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </Link>

                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <span className="material-symbols-outlined text-[16px]">mosque</span>
                  </div>
                  <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-on-surface">
                    Direktori Masjid
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMobileView('map')}
                  className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/40"
                >
                  <span className="material-symbols-outlined text-[14px]">map</span>
                  <span>Peta</span>
                </button>
                <ThemeToggle variant="icon" />
              </div>
            </div>

            {/* Baris 1.5: Indikator Waktu Sholat & Countdown Real-Time (Kemenag RI) */}
            <div className="rounded-xl bg-emerald-600/8 dark:bg-emerald-500/10 border border-emerald-600/20 px-2.5 py-1.5 transition-all">
              <button
                type="button"
                onClick={() => setIsPrayerScheduleExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                title="Klik untuk melihat jadwal 5 waktu sholat hari ini"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[15px] text-emerald-600 dark:text-emerald-400 shrink-0">
                    schedule
                  </span>
                  <span className="text-[11px] font-bold text-on-surface truncate">
                    Menuju{' '}
                    <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">
                      {prayerSchedule.nextPrayer.name} {prayerSchedule.nextPrayer.time}
                    </span>{' '}
                    {prayerSchedule.timezoneLabel}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold shadow-2xs">
                    {prayerSchedule.nextPrayer.countdownText}
                  </span>
                  <span
                    className={`material-symbols-outlined text-[16px] text-on-surface-variant transition-transform duration-200 ${
                      isPrayerScheduleExpanded ? 'rotate-180' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </div>
              </button>

              {isPrayerScheduleExpanded && (
                <div className="grid grid-cols-5 gap-1 mt-2 pt-2 border-t border-emerald-600/15 text-center">
                  {(
                    [
                      { id: 'subuh', label: 'Subuh', time: prayerSchedule.subuh },
                      { id: 'dzuhur', label: 'Dzuhur', time: prayerSchedule.dzuhur },
                      { id: 'ashar', label: 'Ashar', time: prayerSchedule.ashar },
                      { id: 'maghrib', label: 'Maghrib', time: prayerSchedule.maghrib },
                      { id: 'isya', label: 'Isya', time: prayerSchedule.isya },
                    ] as const
                  ).map((item) => {
                    const isNext = prayerSchedule.nextPrayer.id === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`py-1 px-1 rounded-lg transition-colors ${
                          isNext
                            ? 'bg-emerald-600 text-white font-extrabold shadow-2xs'
                            : 'bg-surface/70 text-on-surface-variant'
                        }`}
                      >
                        <div className="text-[9px] uppercase tracking-wider opacity-85">
                          {item.label}
                        </div>
                        <div className="text-[11px] font-bold mt-0.5">{item.time}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Baris 2: Search Input + Tombol Icon Filter Wilayah */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama masjid, jalan, atau kota..."
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-surface-container-low border border-outline-variant/60 rounded-xl focus:outline-none focus:border-emerald-500 text-on-surface placeholder:text-on-surface-variant/60"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* Tombol Icon Filter Lokasi/Wilayah (Modal di Desktop / Vaul Bottom Sheet di Mobile) */}
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className={`relative h-9 sm:h-[38px] px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  hasActiveFilterModal
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/60 text-on-surface'
                }`}
                title="Filter Lokasi & Wilayah Masjid"
                aria-label="Filter Lokasi & Wilayah Masjid"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                <span className="hidden xs:inline">Wilayah</span>
                {hasActiveFilterModal && (
                  <span className="w-2 h-2 rounded-full bg-amber-300" />
                )}
              </button>
            </div>

            {/* Active Region / Radius / Session Filter Chips */}
            {hasActiveFilterModal && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {userLocation && isRadiusEnabled && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/10 border border-emerald-600/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(true)}
                      className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                      title="Klik untuk ubah jarak radius"
                    >
                      <span className="material-symbols-outlined text-[14px]">radar</span>
                      <span>Radius {radiusKm} km</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRadiusEnabled(false)}
                      className="ml-0.5 hover:text-emerald-900 dark:hover:text-white flex items-center cursor-pointer"
                      title="Matikan filter radius"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                )}
                {selectedRegion && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/10 border border-emerald-600/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    <span>{selectedRegion.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedRegion(null)}
                      className="ml-0.5 hover:text-emerald-900 dark:hover:text-white flex items-center cursor-pointer"
                      title="Hapus filter wilayah"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                )}
                {onlyWithActiveSessions && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/10 border border-emerald-600/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Ada Kajian Aktif</span>
                    <button
                      type="button"
                      onClick={() => setOnlyWithActiveSessions(false)}
                      className="ml-0.5 hover:text-emerald-900 dark:hover:text-white flex items-center cursor-pointer"
                      title="Hapus filter status kajian"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Quick Cities Pill Carousel */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {QUICK_CITIES.map((city) => {
                const isActive = !selectedRegion && selectedCity === city;
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => {
                      setSelectedRegion(null);
                      setSelectedCity(city);
                      if (city !== 'Semua') {
                        setIsRadiusEnabled(false);
                      }
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>

          {/* LIST MASJID */}
          <div
            ref={listContainerRef}
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between text-xs text-on-surface-variant font-medium px-1">
              <span>{userLocation ? 'Masjid Terdekat dari Anda' : 'Daftar Masjid Terdaftar'}</span>
              {loading ? (
                <span
                  aria-hidden="true"
                  className="inline-block w-24 h-5 rounded-full bg-surface-container-high animate-pulse"
                />
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-[11px] font-semibold text-on-surface">
                  <strong className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {filteredMosques.length.toLocaleString('id-ID')}
                  </strong>
                  <span>ditemukan</span>
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-2.5" aria-busy="true" aria-label="Memuat daftar masjid">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <MosqueCardSkeleton key={idx} />
                ))}
              </div>
            ) : filteredMosques.length === 0 ? (
              <div className="py-12 px-4 text-center text-on-surface-variant space-y-2">
                <span className="material-symbols-outlined text-[36px] text-outline">mosque</span>
                <p className="text-xs sm:text-sm font-medium">Tidak ada masjid yang cocok dengan pencarian.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCity('Semua');
                    setSelectedRegion(null);
                    setOnlyWithActiveSessions(false);
                  }}
                  className="text-xs text-emerald-600 font-bold hover:underline"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <>
                {visibleMosques.map((mosque) => (
                  <MosqueCardItem
                    key={mosque.id}
                    mosque={mosque}
                    isSelected={selectedMosque?.id === mosque.id}
                    onSelect={handleSelectMosque}
                    onRoute={handleStartRoute}
                    onOpenProfile={handleOpenProfile}
                    onFlyTo={handleCardFlyTo}
                  />
                ))}

                {/* Sentinel & Status Infinite Scroll */}
                {hasMore ? (
                  <div
                    ref={loadMoreSentinelRef}
                    className="py-4 flex items-center justify-center gap-2 text-xs text-on-surface-variant"
                  >
                    <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <span>
                      Memuat lebih banyak ({visibleMosques.length.toLocaleString('id-ID')} /{' '}
                      {filteredMosques.length.toLocaleString('id-ID')})...
                    </span>
                  </div>
                ) : (
                  filteredMosques.length > PAGE_BATCH_SIZE && (
                    <div className="py-3 text-center text-[11px] text-outline">
                      Semua {filteredMosques.length.toLocaleString('id-ID')} masjid telah ditampilkan
                    </div>
                  )
                )}
              </>
            )}
          </div>
          <div className="px-3 py-1.5 border-t border-outline-variant/30 text-[10px] text-on-surface-variant/70 text-center shrink-0">
            Sebagian data lokasi &copy; Overture Maps Foundation, OpenStreetMap contributors
          </div>
        </aside>

        {/* MAP DISPLAY (PETA KANAN / MOBILE FULL) */}
        <main className="flex-1 h-full relative block z-10 overflow-hidden">
          {/* Floating Controls di Peta Mobile (disembunyikan saat panel rute atau navigasi aktif) */}
          {!isNavigating && !activeRouteMosque && (
            <div className="sm:hidden absolute top-3 left-3 right-3 z-20 flex flex-col gap-1.5 pointer-events-none">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 pointer-events-auto">
                  <Link
                    href="/"
                    className="w-9 h-9 rounded-xl bg-surface/95 border border-outline-variant/60 shadow-md backdrop-blur-md flex items-center justify-center text-on-surface"
                    title="Kembali ke Beranda"
                    aria-label="Kembali ke Beranda"
                  >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(true)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-md border backdrop-blur-md transition-all ${
                      hasActiveFilterModal || selectedCity !== 'Semua'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-surface/95 text-on-surface border-outline-variant/60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span className="truncate max-w-[130px]">
                      {selectedRegion
                        ? selectedRegion.name
                        : selectedCity !== 'Semua'
                        ? selectedCity
                        : userLocation && isRadiusEnabled
                        ? `Radius ${radiusKm} km`
                        : 'Filter Wilayah'}
                    </span>
                    {loading ? (
                      <span
                        aria-hidden="true"
                        className="w-7 h-3.5 rounded-full bg-current/20 animate-pulse"
                      />
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-full bg-black/15 dark:bg-white/15 text-[10px] font-extrabold">
                        {filteredMosques.length.toLocaleString('id-ID')}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-surface/95 text-on-surface border border-outline-variant/60 shadow-md backdrop-blur-md"
                  >
                    <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                    <span>Daftar</span>
                  </button>
                  <div className="bg-surface/95 border border-outline-variant/60 rounded-xl shadow-md backdrop-blur-md p-0.5">
                    <ThemeToggle variant="icon" />
                  </div>
                </div>
              </div>

              {/* Pill Ringkas Waktu Sholat Berikutnya di Peta Mobile */}
              <div className="flex justify-start pointer-events-auto">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/95 border border-outline-variant/60 shadow-md backdrop-blur-md text-[11px] font-bold text-on-surface">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">
                    schedule
                  </span>
                  <span>
                    {prayerSchedule.nextPrayer.name} {prayerSchedule.nextPrayer.time}{' '}
                    {prayerSchedule.timezoneLabel}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                    • {prayerSchedule.nextPrayer.countdownText}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Floating Indicator saat Memuat Titik Masjid di Peta */}
          {loading && !isNavigating && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface/95 border border-outline-variant/60 shadow-lg backdrop-blur-md text-xs font-bold text-on-surface">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span className="animate-pulse">Memuat titik masjid di peta...</span>
              </div>
            </div>
          )}

          <MosqueMap
            mosques={mapMosques}
            selectedMosque={selectedMosque}
            onSelectMosque={handleSelectMosque}
            userLocation={userLocation}
            radiusKm={isRadiusEnabled && userLocation ? debouncedRadiusKm : null}
            activeRoute={activeRoute}
            isNavigating={isNavigating}
            userHeading={userHeading}
            onStartRoute={handleStartRoute}
            onOpenProfile={handleOpenProfile}
            vehicleIcon={vehicleIcon}
            onVehicleIconChange={setVehicleIcon}
            savedParkingSpot={savedParkingSpot}
            onClearParkingSpot={handleClearParking}
            mobileView={mobileView}
          />

          {/* Panel Rute In-App Pratinjau (Tampil sebelum mulai navigasi langsung, identik dengan HomeClient) */}
          {activeRouteMosque && !isNavigating && routeDestinationSession && (
            <InAppRoutePanel
              session={routeDestinationSession}
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

          {/* Mode Navigasi Langsung In-App (Top HUD Banner & Bottom Control Bar tanpa blur overlay) */}
          {activeRouteMosque && isNavigating && activeRoute && routeDestinationSession && (
            <LiveNavigationHUD
              session={routeDestinationSession}
              routeResult={activeRoute}
              userLocation={userLocation}
              userHeading={userHeading}
              userAccuracy={userAccuracy}
              onExit={handleExitLiveNav}
              onFinish={handleCloseRoute}
              onReroute={handleReroute}
              isMuted={isAudioMuted}
              onToggleMute={() => setIsAudioMuted((prev) => !prev)}
              vehicleIcon={vehicleIcon}
              onVehicleIconChange={setVehicleIcon}
              onParkingSaved={handleParkingSaved}
            />
          )}
        </main>
      </div>

      {/* MODAL FILTER LOKASI/WILAYAH (DESKTOP MODAL / MOBILE VAUL BOTTOM SHEET) */}
      <MosqueRegionPickerModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        mosques={allMosques}
        selectedRegion={selectedRegion}
        onSelectRegion={(reg) => {
          setSelectedRegion(reg);
          if (reg) {
            setSelectedCity('Semua');
            setIsRadiusEnabled(false);
          }
        }}
        onlyWithActiveSessions={onlyWithActiveSessions}
        onToggleOnlyWithActiveSessions={(val) => setOnlyWithActiveSessions(val)}
        userLocation={userLocation}
        radiusKm={radiusKm}
        isRadiusEnabled={isRadiusEnabled}
        onRadiusChange={setRadiusKm}
        onToggleRadiusEnabled={setIsRadiusEnabled}
      />

      {/* MODAL PROFIL & JADWAL MASJID (DESKTOP MODAL / MOBILE VAUL BOTTOM SHEET) */}
      <MosqueProfileModal
        isOpen={Boolean(profileMosque)}
        mosque={profileMosque}
        onClose={() => setProfileMosque(null)}
        onStartRoute={handleStartRoute}
      />
    </div>
  );
}
