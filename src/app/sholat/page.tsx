'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  INDONESIAN_CITIES,
  DEFAULT_CITY,
  calculateQiblaDirection,
  findClosestCity,
  type IndonesianCity,
} from '@/utils/qibla';
import { getFullPrayerSchedule, type FullPrayerSchedule } from '@/utils/prayerTimes';
import QiblaCompass from '@/components/sholat/QiblaCompass';
import ThemeToggle from '@/components/ThemeToggle';
import DesktopTopNavbar from '@/components/navigation/DesktopTopNavbar';

function SholatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab: 'jadwal' vs 'kiblat'
  const initialTab = searchParams.get('tab') === 'kiblat' ? 'kiblat' : 'jadwal';
  const [activeTab, setActiveTab] = useState<'jadwal' | 'kiblat'>(initialTab);

  // Lokasi saat ini (kota atau koordinat GPS kustom)
  const [selectedCity, setSelectedCity] = useState<IndonesianCity>(DEFAULT_CITY);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState<boolean>(false);
  const [citySearchQuery, setCitySearchQuery] = useState<string>('');

  // Waktu saat ini untuk ticker countdown realtime
  const [now, setNow] = useState<Date>(new Date());

  // Muat preferensi kota atau lokasi terakhir dari localStorage
  useEffect(() => {
    try {
      const savedCityId = localStorage.getItem('pk_prayer_city_id');
      if (savedCityId) {
        const found = INDONESIAN_CITIES.find((c) => c.id === savedCityId);
        if (found) setSelectedCity(found);
      }
    } catch {}
  }, []);

  // Update jam setiap 1 detik agar countdown tetap dinamis
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Koordinat efektif untuk perhitungan
  const activeLat = userCoords && isGpsActive ? userCoords.lat : selectedCity.lat;
  const activeLng = userCoords && isGpsActive ? userCoords.lng : selectedCity.lng;
  const activeLocationName = isGpsActive ? 'Lokasi Saya (GPS)' : selectedCity.name;

  // Jadwal Sholat lengkap (5 waktu + Imsak, Terbit, Dhuha)
  const prayerSchedule: FullPrayerSchedule = useMemo(() => {
    return getFullPrayerSchedule(activeLat, activeLng, now);
  }, [activeLat, activeLng, now]);

  // Perhitungan Arah Kiblat
  const qiblaInfo = useMemo(() => {
    return calculateQiblaDirection(activeLat, activeLng);
  }, [activeLat, activeLng]);

  // Ambil lokasi GPS browser
  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Fitur GPS tidak didukung di browser ini.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setIsGpsActive(true);
        setIsLocating(false);

        // Cari kota terdekat untuk label informasi
        const closest = findClosestCity(coords.lat, coords.lng);
        setSelectedCity(closest);

        try {
          localStorage.setItem('pk_prayer_city_id', closest.id);
        } catch {}
      },
      (err) => {
        setIsLocating(false);
        alert(
          err.code === 1
            ? 'Izin lokasi tidak diberikan. Menggunakan pilihan kota manual.'
            : 'Gagal mendeteksi lokasi GPS. Periksa koneksi atau pilih kota secara manual.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Pilih kota secara manual
  const handleSelectCity = useCallback((city: IndonesianCity) => {
    setSelectedCity(city);
    setIsGpsActive(false);
    setUserCoords(null);
    setIsCityModalOpen(false);
    try {
      localStorage.setItem('pk_prayer_city_id', city.id);
    } catch {}
  }, []);

  // Format tanggal hari ini
  const formattedDate = useMemo(() => {
    return now.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [now]);

  // Filter pencarian kota dalam modal
  const filteredCities = useMemo(() => {
    const q = citySearchQuery.toLowerCase().trim();
    if (!q) return INDONESIAN_CITIES;
    return INDONESIAN_CITIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.province.toLowerCase().includes(q)
    );
  }, [citySearchQuery]);

  // Icon untuk tiap waktu sholat
  const getPrayerIcon = (id: string) => {
    switch (id) {
      case 'imsak':
        return 'bedtime';
      case 'subuh':
        return 'wb_twilight';
      case 'terbit':
        return 'wb_sunny';
      case 'dhuha':
        return 'light_mode';
      case 'dzuhur':
        return 'sunny';
      case 'ashar':
        return 'partly_cloudy_day';
      case 'maghrib':
        return 'routine';
      case 'isya':
        return 'dark_mode';
      default:
        return 'schedule';
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans flex flex-col pb-[calc(76px+env(safe-area-inset-bottom,16px))] md:pb-12">
      {/* NAVBAR DESKTOP UNIFIED (lg+) */}
      <DesktopTopNavbar />

      {/* 1. TOP NAVBAR HEADER (Mobile < lg) */}
      <header className="lg:hidden sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b border-outline-variant/40 transition-colors">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Tombol Kembali & Judul */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/');
                }
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 cursor-pointer transition-colors shrink-0"
              aria-label="Kembali"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-on-surface truncate">
                Jadwal Sholat &amp; Kiblat
              </h1>
              <p className="text-[10px] sm:text-xs text-emerald-700 dark:text-emerald-400 font-bold leading-none truncate">
                Standar Kemenag RI &amp; Azimuth Ka'bah
              </p>
            </div>
          </div>

          {/* Action Toolbar Kanan */}
          <div className="flex items-center gap-2">
            <ThemeToggle variant="icon" size="sm" />
          </div>
        </div>
      </header>

      {/* =====================================================================
          TAMPILAN MOBILE & TABLET (< lg): TETAP 100% SEPERTI SEMULA
         ===================================================================== */}
      <div className="lg:hidden flex flex-col flex-1">
      {/* 2. BAR PEMILIH LOKASI (GPS / GANTI KOTA) */}
      <section className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-surface border border-outline-variant/60 shadow-xs">
          {/* Info Lokasi Terpilih */}
          <button
            type="button"
            onClick={() => setIsCityModalOpen(true)}
            className="flex items-center gap-2 min-w-0 text-left hover:opacity-85 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">
                {isGpsActive ? 'my_location' : 'location_on'}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-on-surface truncate">
                  {activeLocationName}
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-500/10 px-1.5 py-0.2 rounded">
                  {prayerSchedule.timezoneLabel}
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant truncate">
                Ketuk untuk ganti kota / wilayah
              </p>
            </div>
          </button>

          {/* Tombol Deteksi GPS Cepat */}
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isLocating}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              isGpsActive
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant/60'
            }`}
            title="Gunakan GPS Perangkat"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                isLocating ? 'animate-spin' : ''
              }`}
            >
              {isLocating ? 'sync' : 'near_me'}
            </span>
            <span className="hidden xs:inline">
              {isLocating ? 'Mencari...' : isGpsActive ? 'GPS Aktif' : 'GPS Saya'}
            </span>
          </button>
        </div>
      </section>

      {/* 3. TAB SWITCHER (JADWAL SHOLAT VS ARAH KIBLAT) */}
      <section className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-2">
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-surface-container-low border border-outline-variant/40">
          <button
            type="button"
            onClick={() => setActiveTab('jadwal')}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'jadwal'
                ? 'bg-surface text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">schedule</span>
            <span>Jadwal Sholat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kiblat')}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'kiblat'
                ? 'bg-surface text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
            <span>Kompas Kiblat</span>
          </button>
        </div>
      </section>

      {/* 4. ISI KONTEN TAB */}
      <main className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-2 pb-6 space-y-4 flex-1">
        {activeTab === 'jadwal' ? (
          <>
            {/* HERO CARD: SHOLAT BERIKUTNYA & COUNTDOWN */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg relative overflow-hidden">
              {/* Ornamen Latar Belakang */}
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute right-4 top-4 text-white/10 pointer-events-none">
                <span className="material-symbols-outlined text-[80px]">mosque</span>
              </div>

              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-xs">
                    {formattedDate}
                  </span>
                  <span className="text-xs font-bold text-emerald-100">
                    {prayerSchedule.timezoneLabel} (UTC+{prayerSchedule.utcOffsetHours})
                  </span>
                </div>

                <div>
                  <p className="text-xs text-emerald-100 font-medium">Menuju Waktu Sholat</p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      {prayerSchedule.nextPrayer.name}
                    </h2>
                    <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                      {prayerSchedule.nextPrayer.time}
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/20 border border-white/15 text-xs font-bold text-white">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>{prayerSchedule.nextPrayer.countdownText}</span>
                </div>
              </div>
            </div>

            {/* GRID JADWAL SHOLAT 5 WAKTU & AMALAN */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {prayerSchedule.prayers.map((prayer) => {
                const isNext = prayerSchedule.nextPrayer.id === prayer.id;
                const icon = getPrayerIcon(prayer.id);

                return (
                  <div
                    key={prayer.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isNext
                        ? 'bg-emerald-600/10 border-emerald-500 shadow-sm ring-1 ring-emerald-500/40'
                        : prayer.isPrimary
                        ? 'bg-surface border-outline-variant/60 shadow-xs'
                        : 'bg-surface-container-low border-outline-variant/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`material-symbols-outlined text-[18px] ${
                            isNext ? 'text-emerald-600 dark:text-emerald-400' : 'text-on-surface-variant'
                          }`}
                        >
                          {icon}
                        </span>
                        <span
                          className={`text-xs font-extrabold truncate ${
                            isNext ? 'text-emerald-700 dark:text-emerald-300' : 'text-on-surface'
                          }`}
                        >
                          {prayer.name}
                        </span>
                      </div>
                      {isNext && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                      )}
                    </div>

                    <div className="flex items-baseline justify-between mt-auto">
                      <span
                        className={`text-lg sm:text-xl font-black font-mono tracking-tight ${
                          isNext ? 'text-emerald-700 dark:text-emerald-300' : 'text-on-surface'
                        }`}
                      >
                        {prayer.time}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        {prayerSchedule.timezoneLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* KOTAK FAEDAH / DALIL KEUTAMAAN SHOLAT BERJAMAAH TEPAT WAKTU */}
            <div className="p-4 rounded-2xl sm:rounded-3xl bg-surface border border-outline-variant/60 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <span className="material-symbols-outlined text-[20px]">lightbulb</span>
                <h4 className="text-xs sm:text-sm font-extrabold">Keutamaan Sholat di Awal Waktu</h4>
              </div>
              <p className="text-xs text-on-surface leading-relaxed">
                Dari Abdullah bin Mas'ud radhiyallahu 'anhu, ia berkata: <em>"Aku bertanya kepada Rasulullah ﷺ: 'Amalan apakah yang paling dicintai Allah?' Beliau menjawab: <strong>'Sholat pada waktunya.'</strong>"</em>
              </p>
              <p className="text-[11px] text-on-surface-variant font-semibold">
                — HR. Al-Bukhari no. 527 &amp; Muslim no. 85 (Shahih)
              </p>
            </div>
          </>
        ) : (
          /* TAB 2: KOMPAS ARAH KIBLAT INTERAKTIF */
          <div className="space-y-4">
            <div className="p-4 sm:p-6 rounded-3xl bg-surface border border-outline-variant/60 shadow-xs">
              <QiblaCompass
                qiblaBearing={qiblaInfo.bearing}
                distanceKm={qiblaInfo.distanceKm}
                cityName={activeLocationName}
                compassHeadingLabel={qiblaInfo.compassHeadingLabel}
              />
            </div>

            {/* INFO DETAIL KOORDINAT & TIPS KALIBRASI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/40 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-on-surface">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">
                    distance
                  </span>
                  <span>Jarak Garis Lurus</span>
                </div>
                <p className="text-on-surface-variant text-[11px]">
                  <strong>{qiblaInfo.distanceKm.toLocaleString('id-ID')} km</strong> menuju Masjidil Haram, Makkah Al-Mukarramah.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/40 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-on-surface">
                  <span className="material-symbols-outlined text-[16px] text-amber-600">
                    tune
                  </span>
                  <span>Tips Akurasi Sensor</span>
                </div>
                <p className="text-on-surface-variant text-[11px]">
                  Jauhkan ponsel dari medan magnet, magnetik casing, atau benda logam. Putar ponsel membentuk angka 8 untuk kalibrasi sensor jika diperlukan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* BANNER PROMOSI PANDUAN SIFAT SHOLAT NABI */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-linear-to-r from-indigo-900/10 via-indigo-600/10 to-indigo-500/5 border border-indigo-500/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left mt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">accessibility_new</span>
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs sm:text-sm font-bold text-on-surface">
                Panduan Sifat Sholat Nabi ﷺ Sesuai Sunnah
              </h4>
              <p className="text-[11px] text-on-surface-variant">
                Pelajari rukun, wajib, tata cara thuma&apos;ninah, dan bacaan sholat dari takbir hingga salam.
              </p>
            </div>
          </div>
          <Link
            href="/sifat-sholat"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Panduan</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </Link>
        </div>
      </main>
      </div>

      {/* =====================================================================
          TAMPILAN DESKTOP (lg+): 2 KOLOM ASIMETRIS BERGAYA HOMEPAGE
         ===================================================================== */}
      <main className="hidden lg:block max-w-7xl mx-auto px-4 lg:px-6 py-7 flex-1 w-full space-y-6">
        {/* Header Desktop & Pemilih Lokasi */}
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-outline-variant/20">
          <div>
            <p className="text-[13px] font-medium text-on-surface-variant" suppressHydrationWarning>
              {formattedDate} · Standar Kementerian Agama RI
            </p>
            <h1 className="text-3xl font-extrabold text-on-surface tracking-tight mt-0.5">
              Jadwal Sholat &amp; Arah Kiblat
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsCityModalOpen(true)}
              className="h-11 px-4 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/30 flex items-center gap-2.5 transition-all shadow-2xs cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center">
                <span className="material-symbols-outlined text-[17px]">
                  {isGpsActive ? 'my_location' : 'location_on'}
                </span>
              </div>
              <div className="text-left">
                <div className="text-xs font-extrabold text-on-surface flex items-center gap-1.5">
                  <span>{activeLocationName}</span>
                  <span className="px-1.5 py-0.2 rounded bg-[#e4eee8] dark:bg-emerald-950 text-[#126947] dark:text-emerald-300 text-[10px] font-bold">
                    {prayerSchedule.timezoneLabel}
                  </span>
                </div>
                <div className="text-[10px] text-on-surface-variant">Klik untuk ganti wilayah</div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isLocating}
              className={`h-11 px-4 rounded-2xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                isGpsActive
                  ? 'bg-[#126947] text-white border-[#126947] shadow-xs'
                  : 'bg-surface-container-lowest hover:bg-surface-container-low text-on-surface border-outline-variant/30'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[17px] ${
                  isLocating ? 'animate-spin' : ''
                }`}
              >
                {isLocating ? 'sync' : 'near_me'}
              </span>
              <span>{isLocating ? 'Mencari...' : isGpsActive ? 'GPS Aktif' : 'Deteksi GPS'}</span>
            </button>
          </div>
        </div>

        {/* Grid 2 Kolom Desktop: Kiri (Jadwal Sholat & Panduan) + Kanan (Kompas Kiblat) */}
        <div className="grid grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_410px] gap-8 items-start">
          {/* KOLOM KIRI: Hero Jadwal Sholat + Grid 8 Waktu + Dalil + Panduan */}
          <div className="space-y-6 min-w-0">
            {/* Hero Card Jadwal Sholat Bergaya Homepage (#0c432d) */}
            <div className="rounded-3xl bg-gradient-to-br from-[#0c432d] via-[#0f5439] to-[#0a3826] text-white p-6 shadow-md relative overflow-hidden border border-white/10">
              <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-emerald-100/90">
                    <span>
                      MENUJU {prayerSchedule.nextPrayer.name.toUpperCase()} ·{' '}
                      {prayerSchedule.nextPrayer.time}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-4xl font-black tracking-tight">
                      {prayerSchedule.nextPrayer.name}
                    </h2>
                    <span className="text-2xl font-black text-amber-300 font-mono">
                      {prayerSchedule.nextPrayer.time} {prayerSchedule.timezoneLabel}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/15 text-xs font-bold text-white">
                    <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                    <span suppressHydrationWarning>{prayerSchedule.nextPrayer.countdownText}</span>
                  </div>
                </div>

                <div className="hidden xl:flex flex-col items-end text-right">
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-emerald-50">
                    {prayerSchedule.timezoneLabel} · UTC+{prayerSchedule.utcOffsetHours}
                  </span>
                  <span className="text-xs text-emerald-100/80 mt-2">
                    Lokasi: <strong className="text-white">{activeLocationName}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Grid 8 Waktu Sholat & Amalan */}
            <div className="grid grid-cols-4 gap-3.5">
              {prayerSchedule.prayers.map((prayer) => {
                const isNext = prayerSchedule.nextPrayer.id === prayer.id;
                const icon = getPrayerIcon(prayer.id);

                return (
                  <div
                    key={prayer.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isNext
                        ? 'bg-[#e4eee8]/70 dark:bg-emerald-950/50 border-[#126947] shadow-xs ring-1 ring-[#126947]/30'
                        : 'bg-surface-container-lowest border-outline-variant/25 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isNext
                              ? 'bg-[#126947] text-white'
                              : 'bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[17px]">{icon}</span>
                        </div>
                        <span
                          className={`text-[13px] font-extrabold truncate ${
                            isNext ? 'text-[#126947] dark:text-emerald-300' : 'text-on-surface'
                          }`}
                        >
                          {prayer.name}
                        </span>
                      </div>
                      {isNext && (
                        <span className="px-2 py-0.5 rounded-full bg-[#126947] text-white text-[9px] font-extrabold uppercase">
                          Berikutnya
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between mt-auto pt-1">
                      <span
                        className={`text-2xl font-extrabold tracking-tight ${
                          isNext ? 'text-[#126947] dark:text-emerald-300' : 'text-on-surface'
                        }`}
                      >
                        {prayer.time}
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-semibold">
                        {prayerSchedule.timezoneLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dalil Keutamaan Sholat Bergaya Renungan Homepage */}
            <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/25 p-5 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-1.5 text-[#126947] dark:text-emerald-400">
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  format_quote
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-wider">
                  Keutamaan Sholat di Awal Waktu
                </span>
              </div>
              <blockquote className="font-serif italic text-[16px] text-on-surface leading-relaxed">
                “Aku bertanya kepada Rasulullah ﷺ: ‘Amalan apakah yang paling dicintai Allah?’
                Beliau menjawab: ‘Sholat pada waktunya.’”
              </blockquote>
              <p className="text-[12px] font-medium text-on-surface-variant pt-1">
                HR. Al-Bukhari no. 527 &amp; Muslim no. 85 — Abdullah bin Mas&apos;ud radhiyallahu
                &apos;anhu
              </p>
            </div>

            {/* Banner Panduan Sifat Sholat Nabi */}
            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-2xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">accessibility_new</span>
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-on-surface">
                    Panduan Sifat Sholat Nabi ﷺ Sesuai Sunnah
                  </h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Pelajari rukun, wajib, tata cara thuma&apos;ninah, dan bacaan sholat dari takbir
                    hingga salam.
                  </p>
                </div>
              </div>
              <Link
                href="/sifat-sholat"
                className="px-4 py-2.5 rounded-full bg-[#126947] hover:bg-[#0e5237] text-white text-xs font-bold transition-all shadow-2xs shrink-0 inline-flex items-center gap-1.5"
              >
                <span>Buka Panduan</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </Link>
            </div>
          </div>

          {/* KOLOM KANAN (SIDEBAR): Kompas Arah Kiblat Interaktif */}
          <aside className="space-y-4 sticky top-22">
            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">explore</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-on-surface">Kompas Arah Kiblat</h3>
                    <p className="text-[11px] text-on-surface-variant">
                      Azimuth Ka&apos;bah dari {activeLocationName}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 text-xs font-extrabold">
                  {Math.round(qiblaInfo.bearing)}°
                </span>
              </div>

              <QiblaCompass
                qiblaBearing={qiblaInfo.bearing}
                distanceKm={qiblaInfo.distanceKm}
                cityName={activeLocationName}
                compassHeadingLabel={qiblaInfo.compassHeadingLabel}
              />

              <div className="pt-3 border-t border-outline-variant/20 space-y-2 text-xs text-on-surface-variant">
                <div className="flex items-center justify-between">
                  <span>Jarak ke Masjidil Haram:</span>
                  <strong className="text-on-surface font-bold">
                    {qiblaInfo.distanceKm.toLocaleString('id-ID')} km
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Arah Mata Angin:</span>
                  <strong className="text-on-surface font-bold">
                    {qiblaInfo.compassHeadingLabel}
                  </strong>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* 5. MODAL PEMILIH KOTA MANUAL */}
      {isCityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/60 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 border-b border-outline-variant/40 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-on-surface">
                  Pilih Kota / Wilayah
                </h3>
                <p className="text-[10px] sm:text-xs text-on-surface-variant">
                  Waktu sholat &amp; kiblat disesuaikan dengan koordinat kota
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCityModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Input Filter Kota */}
            <div className="p-3 border-b border-outline-variant/30">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">search</span>
                </span>
                <input
                  type="text"
                  value={citySearchQuery}
                  onChange={(e) => setCitySearchQuery(e.target.value)}
                  placeholder="Cari nama kota atau provinsi..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/50 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  autoFocus
                />
              </div>
            </div>

            {/* Daftar Kota Scrollable */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-outline-variant/20">
              {filteredCities.map((city) => {
                const isSelected = !isGpsActive && selectedCity.id === city.id;

                return (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => handleSelectCity(city)}
                    className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-200'
                        : 'hover:bg-surface-container text-on-surface'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold">{city.name}</h4>
                      <p className="text-[10px] text-on-surface-variant">{city.province}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                        {city.timezone}
                      </span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">
                          check_circle
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SholatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-3xl text-emerald-600 animate-spin">
              sync
            </span>
            <p className="text-xs font-bold text-on-surface-variant">Memuat Jadwal Sholat...</p>
          </div>
        </div>
      }
    >
      <SholatContent />
    </Suspense>
  );
}
