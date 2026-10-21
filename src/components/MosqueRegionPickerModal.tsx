'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Drawer } from 'vaul';
import {
  INDONESIA_PROVINCES,
  ALL_CITIES,
  type ProvinceGroup,
  type CityItem,
} from '@/utils/regions';
import type { MosqueVenue } from '@/lib/services/venues';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export interface MosqueRegionSelection {
  type: 'province' | 'city';
  id: string;
  name: string;
  provinceName?: string;
}

interface MosqueRegionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mosques: MosqueVenue[];
  selectedRegion: MosqueRegionSelection | null;
  onSelectRegion: (region: MosqueRegionSelection | null) => void;
  onlyWithActiveSessions: boolean;
  onToggleOnlyWithActiveSessions: (val: boolean) => void;
  userLocation: { lat: number; lng: number } | null;
  radiusKm: number;
  isRadiusEnabled: boolean;
  onRadiusChange: (km: number) => void;
  onToggleRadiusEnabled: (enabled: boolean) => void;
}

// Pre-compute huruf kecil untuk seluruh kota & alias sekali saja di level modul
const PRECOMPUTED_CITIES = ALL_CITIES.map((city) => ({
  city,
  nameLower: city.name.toLowerCase(),
  aliasesLower: city.aliases.map((a) => a.toLowerCase()),
}));

// Cache hasil pencocokan kota berdasarkan ID masjid (O(1) lookup lintas re-render GPS)
const mosqueCityCache = new Map<string, CityItem | null>();

/**
 * Mencocokkan satu masjid ke CityItem berdasarkan teks city, address, dan name.
 */
export function detectMosqueCityItem(mosque: MosqueVenue): CityItem | null {
  if (mosque.id && mosqueCityCache.has(mosque.id)) {
    return mosqueCityCache.get(mosque.id) ?? null;
  }

  const cityCol = (mosque.city || '').toLowerCase().trim();
  const combined = `${cityCol} ${(mosque.address || '').toLowerCase()} ${(mosque.name || '').toLowerCase()}`;

  let matched: CityItem | null = null;

  // 1. Cek kecocokan langsung pada kolom city jika sudah terisi spesifik
  if (cityCol && cityCol !== 'indonesia') {
    for (const item of PRECOMPUTED_CITIES) {
      if (
        cityCol === item.nameLower ||
        item.nameLower.includes(cityCol) ||
        cityCol.includes(item.nameLower)
      ) {
        matched = item.city;
        break;
      }
      let aliasHit = false;
      for (const aLower of item.aliasesLower) {
        if (cityCol === aLower || (aLower.length > 3 && cityCol.includes(aLower))) {
          matched = item.city;
          aliasHit = true;
          break;
        }
      }
      if (aliasHit) break;
    }
  }

  // 2. Cek kecocokan dari gabungan city + address + name
  if (!matched) {
    for (const item of PRECOMPUTED_CITIES) {
      if (combined.includes(item.nameLower)) {
        matched = item.city;
        break;
      }
      let aliasHit = false;
      for (const aLower of item.aliasesLower) {
        if (aLower.length <= 3) {
          // Hindari false-positive untuk singkatan pendek (bsd, diy, ugm, ikn)
          const idx = combined.indexOf(aLower);
          if (idx !== -1) {
            const before = idx === 0 ? ' ' : combined[idx - 1];
            const after =
              idx + aLower.length >= combined.length ? ' ' : combined[idx + aLower.length];
            if (!/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after)) {
              matched = item.city;
              aliasHit = true;
              break;
            }
          }
        } else if (combined.includes(aLower)) {
          matched = item.city;
          aliasHit = true;
          break;
        }
      }
      if (aliasHit) break;
    }
  }

  if (mosque.id) {
    mosqueCityCache.set(mosque.id, matched);
  }
  return matched;
}

/**
 * Mengecek apakah sebuah masjid cocok dengan filter MosqueRegionSelection
 */
export function doesMosqueMatchRegion(
  mosque: MosqueVenue,
  region: MosqueRegionSelection | null
): boolean {
  if (!region) return true;

  const detected = detectMosqueCityItem(mosque);
  if (detected) {
    if (region.type === 'city' && detected.id === region.id) return true;
    if (region.type === 'province' && detected.provinceId === region.id) return true;
  }

  // Fallback pencocokan teks langsung untuk nama provinsi/kota
  const text = `${mosque.city || ''} ${mosque.province || ''} ${mosque.address || ''} ${mosque.name || ''}`.toLowerCase();
  const rName = region.name.toLowerCase().replace(/^(kota|kab\.|kabupaten)\s+/i, '').trim();
  if (rName && text.includes(rName)) {
    return true;
  }

  return false;
}

export default function MosqueRegionPickerModal({
  isOpen,
  onClose,
  mosques,
  selectedRegion,
  onSelectRegion,
  onlyWithActiveSessions,
  onToggleOnlyWithActiveSessions,
  userLocation,
  radiusKm,
  isRadiusEnabled,
  onRadiusChange,
  onToggleRadiusEnabled,
}: MosqueRegionPickerModalProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [expandedProvince, setExpandedProvince] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  // Deteksi ukuran layar (Desktop >= 640px vs Mobile < 640px untuk Vaul Bottom Sheet)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Rekap jumlah masjid per kota & provinsi secara lazy (hanya dihitung ketika modal dibuka)
  const { cityCounts, provinceCounts, topCities, activeSessionMosqueCount } = useMemo(() => {
    if (!isOpen) {
      return {
        cityCounts: {} as Record<string, number>,
        provinceCounts: {} as Record<string, number>,
        topCities: [] as CityItem[],
        activeSessionMosqueCount: 0,
      };
    }

    const cCounts: Record<string, number> = {};
    const pCounts: Record<string, number> = {};
    let withSessions = 0;

    for (const m of mosques) {
      if (m.active_sessions_count && m.active_sessions_count > 0) {
        withSessions++;
      }
      const city = detectMosqueCityItem(m);
      if (city) {
        cCounts[city.id] = (cCounts[city.id] || 0) + 1;
        pCounts[city.provinceId] = (pCounts[city.provinceId] || 0) + 1;
      }
    }

    const sortedCities = ALL_CITIES.filter((c) => (cCounts[c.id] || 0) > 0).sort(
      (a, b) => (cCounts[b.id] || 0) - (cCounts[a.id] || 0)
    );

    return {
      cityCounts: cCounts,
      provinceCounts: pCounts,
      topCities: sortedCities.slice(0, 10),
      activeSessionMosqueCount: withSessions,
    };
  }, [isOpen, mosques]);

  const radiusMosqueCount = useMemo(() => {
    if (!isOpen || !userLocation) return 0;
    let count = 0;
    for (const m of mosques) {
      if (typeof m.distance_km === 'number' && m.distance_km <= radiusKm) {
        count++;
      }
    }
    return count;
  }, [isOpen, mosques, userLocation, radiusKm]);

  // Auto-expand provinsi jika wilayah aktif dipilih
  useEffect(() => {
    if (selectedRegion) {
      if (selectedRegion.type === 'province') {
        setExpandedProvince(selectedRegion.id);
      } else {
        const found = ALL_CITIES.find((c) => c.id === selectedRegion.id);
        if (found) setExpandedProvince(found.provinceId);
      }
    }
  }, [selectedRegion]);

  // Tutup dengan tombol ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter daftar provinsi & kota berdasarkan pencarian di dalam modal
  const filteredProvinces = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return INDONESIA_PROVINCES;

    return INDONESIA_PROVINCES.map((prov) => {
      const matchProvName = prov.name.toLowerCase().includes(q);
      const matchedCities = prov.cities.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.aliases.some((a) => a.toLowerCase().includes(q))
      );

      if (matchProvName || matchedCities.length > 0) {
        return {
          ...prov,
          cities: matchProvName ? prov.cities : matchedCities,
        };
      }
      return null;
    }).filter(Boolean) as ProvinceGroup[];
  }, [debouncedSearch]);

  if (!isOpen) return null;

  const handleSelectAllIndonesia = () => {
    onSelectRegion(null);
    onClose();
  };

  const handleSelectProvince = (prov: ProvinceGroup) => {
    onSelectRegion({
      type: 'province',
      id: prov.id,
      name: prov.name,
    });
    onClose();
  };

  const handleSelectCity = (city: CityItem) => {
    onSelectRegion({
      type: 'city',
      id: city.id,
      name: city.name,
      provinceName: city.provinceName,
    });
    onClose();
  };

  const renderHeader = () => (
    <>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-emerald-600 text-[22px]">tune</span>
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-on-surface leading-tight">
            Filter Lokasi &amp; Wilayah Masjid
          </h2>
          <p className="text-[11px] text-on-surface-variant">
            Pilih provinsi, kota/kabupaten, atau status kajian masjid
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
        title="Tutup Filter"
        aria-label="Tutup Filter"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </>
  );

  const renderSearch = (autoFocus = false) => (
    <div className="relative w-full">
      <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
        search
      </span>
      <input
        type="text"
        placeholder="Cari provinsi, kota, atau kabupaten..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm rounded-xl pl-9 pr-8 py-2.5 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all border border-surface-container-high"
        autoFocus={autoFocus}
      />
      {search && (
        <button
          type="button"
          onClick={() => setSearch('')}
          className="absolute right-2.5 top-2.5 text-outline hover:text-on-surface text-[16px] material-symbols-outlined cursor-pointer"
          title="Hapus pencarian"
        >
          cancel
        </button>
      )}
    </div>
  );

  const renderBody = () => (
    <>
      {/* 1. Filter Jarak Radius dari Lokasi Pengguna (Slider) */}
      <div className="p-3.5 rounded-2xl border border-surface-container-high bg-surface-container-low/50 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-emerald-600/15 text-emerald-600 flex items-center justify-center material-symbols-outlined text-[18px] shrink-0">
              radar
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-on-surface truncate">
                Filter Radius dari Lokasi Saya
              </p>
              <p className="text-[10px] text-on-surface-variant truncate">
                {userLocation
                  ? isRadiusEnabled
                    ? `${radiusMosqueCount.toLocaleString('id-ID')} masjid dalam radius ${radiusKm} km`
                    : 'Filter radius dinonaktifkan (menampilkan semua jarak)'
                  : 'Aktifkan GPS perangkat untuk menggunakan filter radius'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {userLocation && isRadiusEnabled && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold">
                {radiusKm} km
              </span>
            )}
            <button
              type="button"
              disabled={!userLocation}
              onClick={() => onToggleRadiusEnabled(!isRadiusEnabled)}
              className={`relative inline-flex items-center w-11 h-6 rounded-full border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                userLocation && isRadiusEnabled
                  ? 'bg-emerald-600 border-emerald-600'
                  : 'bg-slate-300 dark:bg-slate-700 border-slate-400/70 dark:border-slate-600'
              }`}
              title={isRadiusEnabled ? 'Matikan Filter Radius' : 'Aktifkan Filter Radius'}
              aria-label="Toggle Filter Radius"
            >
              <span
                className={`inline-block w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                  userLocation && isRadiusEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {userLocation && (
          <div className="space-y-1.5 pt-0.5">
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={radiusKm}
              onChange={(e) => {
                const nextKm = Number(e.target.value);
                if (!isRadiusEnabled) {
                  onToggleRadiusEnabled(true);
                }
                onRadiusChange(nextKm);
              }}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-emerald-600"
            />
            <div className="flex items-center justify-between text-[10px] font-semibold text-outline px-0.5">
              <span>1 km</span>
              <span>25 km</span>
              <span>50 km</span>
              <span>75 km</span>
              <span>100 km</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filter Status Kajian Masjid */}
      <div>
        <p className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">
          Status Jadwal Kajian
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onToggleOnlyWithActiveSessions(false)}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              !onlyWithActiveSessions
                ? 'bg-emerald-600/10 border-emerald-600 text-emerald-700 dark:text-emerald-300 font-bold'
                : 'bg-surface-container-low border-surface-container-high text-on-surface hover:bg-surface-container'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[18px]">mosque</span>
              <span className="text-xs truncate">Semua Masjid</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container font-bold">
              {mosques.length.toLocaleString('id-ID')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onToggleOnlyWithActiveSessions(true)}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              onlyWithActiveSessions
                ? 'bg-emerald-600/10 border-emerald-600 text-emerald-700 dark:text-emerald-300 font-bold'
                : 'bg-surface-container-low border-surface-container-high text-on-surface hover:bg-surface-container'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs truncate">Ada Kajian Aktif</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
              {activeSessionMosqueCount.toLocaleString('id-ID')}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Opsi Seluruh Indonesia */}
      <button
        type="button"
        onClick={handleSelectAllIndonesia}
        className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer ${
          !selectedRegion
            ? 'bg-emerald-600/10 border-emerald-600 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
            : 'bg-surface-container-low/60 border-surface-container-high hover:bg-surface-container text-on-surface'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-emerald-600/15 text-emerald-600 flex items-center justify-center material-symbols-outlined text-[18px]">
            public
          </span>
          <div>
            <p className="text-xs sm:text-sm font-semibold">Seluruh Indonesia</p>
            <p className="text-[11px] text-outline font-normal">
              Tampilkan seluruh {mosques.length.toLocaleString('id-ID')} masjid terdaftar
            </p>
          </div>
        </div>
        {!selectedRegion && (
          <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
        )}
      </button>

      {/* 3. Kota dengan Masjid Terbanyak (jika tidak sedang mengetik search) */}
      {!search.trim() && topCities.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">
            Kota / Kabupaten Terpopuler
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topCities.map((city) => {
              const isSelected = selectedRegion?.type === 'city' && selectedRegion.id === city.id;
              const count = cityCounts[city.id] || 0;

              return (
                <button
                  type="button"
                  key={city.id}
                  onClick={() => handleSelectCity(city)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface'
                  }`}
                >
                  <span>{city.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {count.toLocaleString('id-ID')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Daftar Provinsi & Kota/Kabupaten Berjenjang */}
      <div>
        <p className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">
          Daftar Provinsi &amp; Kota/Kabupaten
        </p>

        {filteredProvinces.length === 0 ? (
          <div className="py-8 text-center text-outline text-xs">
            Wilayah &quot;{search}&quot; tidak ditemukan.
          </div>
        ) : (
          <div className="divide-y divide-surface-container-high/60 border border-surface-container-high rounded-2xl overflow-hidden bg-surface-container-low/40">
            {filteredProvinces.map((prov) => {
              const isExpanded = search.trim().length > 0 || expandedProvince === prov.id;
              const isProvSelected =
                selectedRegion?.type === 'province' && selectedRegion.id === prov.id;
              const provCount = provinceCounts[prov.id] || 0;

              return (
                <div key={prov.id} className="transition-colors">
                  {/* Province Header Row */}
                  <div className="flex items-center justify-between p-3 hover:bg-surface-container/60 transition-colors">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedProvince(isExpanded && !search.trim() ? null : prov.id)
                      }
                      className="flex items-center gap-2.5 flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-outline">
                        {isExpanded ? 'expand_more' : 'chevron_right'}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-on-surface truncate">
                        {prov.name}
                      </span>
                      {provCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold shrink-0">
                          {provCount.toLocaleString('id-ID')} masjid
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectProvince(prov)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ml-2 shrink-0 cursor-pointer ${
                        isProvSelected
                          ? 'bg-emerald-600 text-white'
                          : 'text-emerald-600 hover:bg-emerald-600/10'
                      }`}
                    >
                      Pilih Provinsi
                    </button>
                  </div>

                  {/* Cities inside Province */}
                  {isExpanded && (
                    <div className="bg-surface-container-lowest divide-y divide-surface-container-high/30 px-3 pb-2">
                      {prov.cities.map((city) => {
                        const isCitySelected =
                          selectedRegion?.type === 'city' && selectedRegion.id === city.id;
                        const count = cityCounts[city.id] || 0;

                        return (
                          <button
                            type="button"
                            key={city.id}
                            onClick={() => handleSelectCity(city)}
                            className={`w-full flex items-center justify-between py-2 px-2.5 rounded-xl text-left transition-all cursor-pointer ${
                              isCitySelected
                                ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 font-bold'
                                : 'hover:bg-surface-container-low text-on-surface'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="material-symbols-outlined text-[16px] text-outline">
                                location_on
                              </span>
                              <span className="text-xs truncate">{city.name}</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                  count > 0
                                    ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                                    : 'text-outline'
                                }`}
                              >
                                {count.toLocaleString('id-ID')}
                              </span>
                              {isCitySelected && (
                                <span className="material-symbols-outlined text-emerald-600 text-[16px]">
                                  check
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  const renderFooter = () => (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-on-surface truncate">
          {selectedRegion ? `Wilayah: ${selectedRegion.name}` : 'Wilayah: Seluruh Indonesia'}
        </p>
        <p className="text-[10px] text-emerald-600 font-semibold truncate">
          {userLocation && isRadiusEnabled ? `Radius: ${radiusKm} km` : 'Radius: Semua Jarak'}
          {onlyWithActiveSessions ? ' • Hanya masjid ada kajian' : ''}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {(selectedRegion || onlyWithActiveSessions || (userLocation && (!isRadiusEnabled || radiusKm !== 30))) && (
          <button
            type="button"
            onClick={() => {
              onSelectRegion(null);
              onToggleOnlyWithActiveSessions(false);
              onRadiusChange(30);
              onToggleRadiusEnabled(true);
            }}
            className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
          >
            Reset
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
        >
          Terapkan
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* 1. DESKTOP (>= 640px): Centered Modal */}
      {isDesktop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={onClose} />
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-surface-container-high/60 z-10 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-surface-container-high/60 flex items-center justify-between shrink-0">
              {renderHeader()}
            </div>

            {/* Search Bar */}
            <div className="p-4 pb-2 shrink-0">{renderSearch(true)}</div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">{renderBody()}</div>

            {/* Footer */}
            <div className="p-4 border-t border-surface-container-high/60 bg-surface-container-lowest flex items-center justify-between gap-3 shrink-0">
              {renderFooter()}
            </div>
          </div>
        </div>
      )}

      {/* 2. MOBILE (< 640px): Vaul Bottom Sheet */}
      {!isDesktop && (
        <Drawer.Root
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
          dismissible={true}
        >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />

            <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[90dvh] max-h-[90dvh] bg-surface-container-lowest rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.18)] border-t border-surface-container-high/80 focus:outline-none font-geist">
              {/* Drag Handle */}
              <div className="w-full flex justify-center pt-3 pb-1.5 shrink-0 cursor-pointer touch-none">
                <Drawer.Handle className="w-12 h-1.5 rounded-full bg-outline/40 hover:bg-outline/60 transition-colors" />
              </div>

              {/* Sticky Header */}
              <div className="shrink-0 px-4 pb-3 border-b border-surface-container-high/60 bg-surface-container-lowest flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-[22px]">
                      tune
                    </span>
                    <Drawer.Title className="text-base font-extrabold text-on-surface">
                      Filter Lokasi &amp; Wilayah
                    </Drawer.Title>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                    title="Tutup Filter"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                <Drawer.Description className="sr-only">
                  Pilih provinsi, kota, atau status jadwal kajian untuk memfilter daftar masjid
                </Drawer.Description>
                <div>{renderSearch(false)}</div>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0 overscroll-contain pb-[calc(76px+env(safe-area-inset-bottom,20px))]">
                {renderBody()}
              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 p-3.5 border-t border-surface-container-high/60 bg-surface-container-lowest flex items-center justify-between gap-3 pb-[calc(12px+env(safe-area-inset-bottom,12px))]">
                {renderFooter()}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </>
  );
}
