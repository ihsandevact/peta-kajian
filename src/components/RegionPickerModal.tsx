'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Drawer } from 'vaul';
import {
  INDONESIA_PROVINCES,
  ALL_CITIES,
  countActiveSessionsByRegion,
  type SelectedRegion,
  type ProvinceGroup,
  type CityItem,
} from '@/utils/regions';
import type { StudySession } from '@/lib/services/kajian';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface RegionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRegion: SelectedRegion | null;
  onSelectRegion: (region: SelectedRegion | null) => void;
  sessions: StudySession[];
  onResetAll?: () => void;
}

export default function RegionPickerModal({
  isOpen,
  onClose,
  selectedRegion,
  onSelectRegion,
  sessions,
  onResetAll,
}: RegionPickerModalProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [expandedProvince, setExpandedProvince] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Hitung jumlah kajian per wilayah secara lazy hanya saat modal terbuka
  const { cityCounts, provinceCounts, activeCities } = useMemo(() => {
    if (!isOpen) {
      return {
        cityCounts: {} as Record<string, number>,
        provinceCounts: {} as Record<string, number>,
        activeCities: [] as CityItem[],
      };
    }
    return countActiveSessionsByRegion(sessions);
  }, [isOpen, sessions]);

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

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter provinsi & kota berdasarkan query pencarian di dalam modal (debounced 250ms)
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
      center: prov.center,
      zoom: prov.zoom,
    });
    onClose();
  };

  const handleSelectCity = (city: CityItem) => {
    onSelectRegion({
      type: 'city',
      id: city.id,
      name: city.name,
      provinceName: city.provinceName,
      center: city.center,
      zoom: city.zoom,
    });
    onClose();
  };

  // 1. Header Row (Judul & Tombol Close)
  const renderHeader = () => (
    <>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
        <h2 className="text-base sm:text-lg font-bold text-on-surface">Filter &amp; Wilayah Kajian</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
        title="Tutup Modal"
        aria-label="Tutup Modal"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </>
  );

  // 2. Search Input Box
  const renderSearch = (autoFocus: boolean = false) => (
    <div className="relative w-full">
      <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
        search
      </span>
      <input
        type="text"
        placeholder="Cari kota, kabupaten, atau provinsi..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm rounded-xl pl-9 pr-8 py-2.5 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high"
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

  // 3. Scrollable List Body (Seluruh Indonesia, Kota Populer, Provinsi & Kota)
  const renderBody = () => (
    <>
      {/* 1. Opsi Seluruh Indonesia */}
      <button
        type="button"
        onClick={handleSelectAllIndonesia}
        className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer ${
          !selectedRegion
            ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
            : 'bg-surface-container-low/60 border-surface-container-high hover:bg-surface-container text-on-surface'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center material-symbols-outlined text-[18px]">
            public
          </span>
          <div>
            <p className="text-xs sm:text-sm font-semibold">Seluruh Indonesia</p>
            <p className="text-[11px] text-outline font-normal">Tampilkan semua jadwal kajian nasional</p>
          </div>
        </div>
        {!selectedRegion && (
          <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
        )}
      </button>

      {/* 2. Kota Populer dengan Kajian Terbanyak (Jika tidak sedang search) */}
      {!search && activeCities.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">
            Kota dengan Kajian Aktif
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeCities.slice(0, 8).map((city) => {
              const isSelected = selectedRegion?.type === 'city' && selectedRegion.id === city.id;
              const count = cityCounts[city.id] || 0;

              return (
                <button
                  type="button"
                  key={city.id}
                  onClick={() => handleSelectCity(city)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface'
                  }`}
                >
                  <span>{city.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Daftar Provinsi & Kota Berjenjang */}
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
              const isExpanded = isSearchActive(search) || expandedProvince === prov.id;
              const isProvSelected =
                selectedRegion?.type === 'province' && selectedRegion.id === prov.id;
              const provCount = provinceCounts[prov.id] || 0;

              return (
                <div key={prov.id} className="transition-colors">
                  {/* Province Header Row */}
                  <div className="flex items-center justify-between p-3 hover:bg-surface-container/60 transition-colors">
                    <button
                      type="button"
                      onClick={() => setExpandedProvince(isExpanded && !search ? null : prov.id)}
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
                          {provCount} kajian
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectProvince(prov)}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ml-2 shrink-0 cursor-pointer ${
                        isProvSelected
                          ? 'bg-primary text-white'
                          : 'text-primary hover:bg-primary/10'
                      }`}
                    >
                      Pilih Provinsi
                    </button>
                  </div>

                  {/* Cities inside Province (Accordion) */}
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
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'hover:bg-surface-container-low text-on-surface'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="material-symbols-outlined text-[16px] text-outline">
                                pin_drop
                              </span>
                              <span className="text-xs truncate">{city.name}</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {count > 0 ? (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
                                  {count}
                                </span>
                              ) : (
                                <span className="text-[10px] text-outline">0</span>
                              )}
                              {isCitySelected && (
                                <span className="material-symbols-outlined text-primary text-[16px]">
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

  const hasAnyActiveFilter = Boolean(selectedRegion);

  // 4. Footer Bar
  const renderFooter = () => (
    <>
      <div className="flex items-center gap-2 min-w-0">
        {hasAnyActiveFilter && onResetAll ? (
          <button
            type="button"
            onClick={() => {
              onResetAll();
            }}
            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
            <span>Reset Filter</span>
          </button>
        ) : (
          <p className="text-xs text-outline truncate">
            {selectedRegion
              ? `Wilayah aktif: ${selectedRegion.name}`
              : 'Menampilkan seluruh wilayah'}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-semibold text-xs rounded-xl transition-colors shrink-0 cursor-pointer shadow-xs"
      >
        Terapkan
      </button>
    </>
  );

  return (
    <>
      {/* ======================================================== */}
      {/* 1. TAMPILAN DESKTOP (sm: / 640px ke atas): Centered Modal */}
      {/* ======================================================== */}
      {isDesktop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={onClose} />
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-surface-container-high/60 z-10 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-surface-container-high/60 flex items-center justify-between shrink-0">
              {renderHeader()}
            </div>

            {/* Search Bar */}
            <div className="p-4 pb-2 shrink-0">
              {renderSearch(true)}
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
              {renderBody()}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-surface-container-high/60 bg-surface-container-lowest flex items-center justify-between gap-3 shrink-0">
              {renderFooter()}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 2. TAMPILAN MOBILE (Layar HP): Vaul Bottom Sheet dengan Fullscreen Overlay */}
      {/* ====================================================================== */}
      {!isDesktop && (
        <Drawer.Root
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
          dismissible={true}
        >
          <Drawer.Portal>
            {/* Fullscreen Overlay: Menutupi seluruh layar & peta di belakangnya */}
            <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />

            <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[92dvh] max-h-[92dvh] bg-surface-container-lowest rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.18)] border-t border-surface-container-high/80 focus:outline-none font-geist">
              {/* Drag Handle Indicator */}
              <div className="w-full flex justify-center pt-3 pb-1.5 shrink-0 cursor-pointer touch-none">
                <Drawer.Handle className="w-12 h-1.5 rounded-full bg-outline/40 hover:bg-outline/60 transition-colors" />
              </div>

              {/* Sticky Header: Judul + Tombol Close + Search Bar */}
              <div className="shrink-0 px-4 pb-3 border-b border-surface-container-high/60 bg-surface-container-lowest flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
                    <Drawer.Title className="text-base font-bold text-on-surface">
                      Filter &amp; Wilayah Kajian
                    </Drawer.Title>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                    title="Tutup Modal"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                <Drawer.Description className="sr-only">
                  Pilih wilayah kota atau provinsi untuk memfilter jadwal kajian
                </Drawer.Description>
                <div>
                  {renderSearch(false)}
                </div>
              </div>

              {/* Scrollable Body: Bisa digulir sampai paling bawah dengan safe area padding */}
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

function isSearchActive(q: string): boolean {
  return q.trim().length > 0;
}
