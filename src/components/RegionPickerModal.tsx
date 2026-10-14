'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  INDONESIA_PROVINCES,
  ALL_CITIES,
  countActiveSessionsByRegion,
  type SelectedRegion,
  type ProvinceGroup,
  type CityItem,
} from '@/utils/regions';
import type { StudySession } from '@/lib/services/kajian';

interface RegionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRegion: SelectedRegion | null;
  onSelectRegion: (region: SelectedRegion | null) => void;
  sessions: StudySession[];
}

export default function RegionPickerModal({
  isOpen,
  onClose,
  selectedRegion,
  onSelectRegion,
  sessions,
}: RegionPickerModalProps) {
  const [search, setSearch] = useState('');
  const [expandedProvince, setExpandedProvince] = useState<string | null>(null);

  // Hitung jumlah kajian per wilayah
  const { cityCounts, provinceCounts, activeCities } = useMemo(
    () => countActiveSessionsByRegion(sessions),
    [sessions]
  );

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

  // Filter provinsi & kota berdasarkan query pencarian di dalam modal
  const filteredProvinces = useMemo(() => {
    const q = search.trim().toLowerCase();
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
  }, [search]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal / Bottom Sheet Card */}
      <div className="relative w-full sm:max-w-lg bg-surface-container-lowest sm:rounded-3xl rounded-t-[28px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-surface-container-high/60 z-10 animate-in slide-in-from-bottom-4 duration-300">
        {/* Drag handle on mobile */}
        <div className="sm:hidden w-full flex justify-center pt-3 pb-1" onClick={onClose}>
          <div className="w-12 h-1.5 rounded-full bg-outline/40"></div>
        </div>

        {/* Modal Header */}
        <div className="px-5 pt-3 sm:pt-5 pb-3 border-b border-surface-container-high/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">location_on</span>
            <h2 className="text-base sm:text-lg font-bold text-on-surface">Pilih Wilayah Kajian</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Search Bar inside Modal */}
        <div className="p-4 pb-2">
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
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-outline hover:text-on-surface text-[16px] material-symbols-outlined"
              >
                cancel
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          {/* 1. Opsi Seluruh Indonesia */}
          <button
            onClick={handleSelectAllIndonesia}
            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
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
                      key={city.id}
                      onClick={() => handleSelectCity(city)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
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
              Daftar Provinsi & Kota/Kabupaten
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
                          onClick={() => setExpandedProvince(isExpanded && !search ? null : prov.id)}
                          className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                        >
                          <span className="material-symbols-outlined text-[18px] text-outline">
                            {isExpanded ? 'expand_more' : 'chevron_right'}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-on-surface truncate">
                            {prov.name}
                          </span>
                          {provCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold shrink-0">
                              {provCount} kajian
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => handleSelectProvince(prov)}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ml-2 shrink-0 ${
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
                                key={city.id}
                                onClick={() => handleSelectCity(city)}
                                className={`w-full flex items-center justify-between py-2 px-2.5 rounded-xl text-left transition-all ${
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
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-surface-container-high/60 bg-surface-container-lowest flex items-center justify-between gap-3">
          <p className="text-xs text-outline truncate">
            {selectedRegion
              ? `Wilayah aktif: ${selectedRegion.name}`
              : 'Menampilkan seluruh wilayah'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs rounded-xl transition-colors shrink-0"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function isSearchActive(q: string): boolean {
  return q.trim().length > 0;
}
