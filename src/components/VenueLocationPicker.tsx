'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { searchPlaces, reverseGeocode, type GeocodingPlace } from '@/lib/services/geocoding';

setWorkerUrl('/lib/maplibre/maplibre-gl-worker.mjs');

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'get_your_own_OpIi9ZULNHzrESv6T2vL';

export interface VenueLocationPickerProps {
  venueName: string;
  onVenueNameChange: (val: string) => void;
  markerPos: { lat: number; lng: number };
  onMarkerPosChange: (pos: { lat: number; lng: number }) => void;
  required?: boolean;
  className?: string;
  showVenueNameInput?: boolean;
}

export default function VenueLocationPicker({
  venueName,
  onVenueNameChange,
  markerPos,
  onMarkerPosChange,
  required = true,
  className = '',
  showVenueNameInput = true,
}: VenueLocationPickerProps) {
  // Map View State
  const [viewState, setViewState] = useState({
    longitude: markerPos.lng || 106.816666,
    latitude: markerPos.lat || -6.200000,
    zoom: 14,
  });

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodingPlace[]>([]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [addressPreview, setAddressPreview] = useState<string | null>(null);
  const [nameSuggestion, setNameSuggestion] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const reverseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sinkronisasi viewState saat markerPos berubah dari luar (misal dari scanner AI atau reset form)
  useEffect(() => {
    if (markerPos.lat && markerPos.lng) {
      setViewState((prev) => {
        // Hanya pindahkan jika jaraknya cukup signifikan agar tidak mengganggu interaksi pan manual
        const latDiff = Math.abs(prev.latitude - markerPos.lat);
        const lngDiff = Math.abs(prev.longitude - markerPos.lng);
        if (latDiff > 0.0001 || lngDiff > 0.0001) {
          return {
            ...prev,
            latitude: markerPos.lat,
            longitude: markerPos.lng,
          };
        }
        return prev;
      });
    }
  }, [markerPos.lat, markerPos.lng]);

  // Debounced reverse geocoding untuk menampilkan info alamat & saran nama
  useEffect(() => {
    if (reverseTimeoutRef.current) clearTimeout(reverseTimeoutRef.current);
    reverseTimeoutRef.current = setTimeout(async () => {
      if (markerPos.lat && markerPos.lng) {
        const info = await reverseGeocode(markerPos.lat, markerPos.lng);
        if (info) {
          const parts = [info.road, info.suburb, info.city].filter(Boolean);
          setAddressPreview(parts.length > 0 ? parts.join(', ') : info.displayName);
          if (info.name && info.name !== venueName) {
            setNameSuggestion(info.name);
          } else {
            setNameSuggestion(null);
          }
        }
      }
    }, 800);

    return () => {
      if (reverseTimeoutRef.current) clearTimeout(reverseTimeoutRef.current);
    };
  }, [markerPos.lat, markerPos.lng, venueName]);

  // Tutup dropdown hasil pencarian saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handler Cari Lokasi
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    setSearchResults([]);
    setGeoError(null);

    try {
      const results = await searchPlaces(q, { lat: markerPos.lat, lng: markerPos.lng });
      if (results.length === 0) {
        setGeoError('Lokasi tidak ditemukan. Coba ketik nama masjid yang lebih spesifik atau nama jalan/kecamatan.');
      } else {
        setSearchResults(results);
        // Jika hanya 1 hasil tepat, langsung arahkan ke sana
        if (results.length === 1) {
          const item = results[0];
          onMarkerPosChange({ lat: item.lat, lng: item.lng });
          setViewState({
            latitude: item.lat,
            longitude: item.lng,
            zoom: 16,
          });
          if (!venueName) {
            onVenueNameChange(item.name);
          }
          setSearchResults([]);
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setGeoError('Gagal mencari lokasi. Periksa koneksi internet Anda.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, markerPos, venueName, onMarkerPosChange, onVenueNameChange]);

  // Handler Pilih Lokasi dari Hasil Pencarian
  const handleSelectPlace = (place: GeocodingPlace) => {
    onMarkerPosChange({ lat: place.lat, lng: place.lng });
    setViewState({
      latitude: place.lat,
      longitude: place.lng,
      zoom: 16,
    });
    if (!venueName || venueName.trim() === '') {
      onVenueNameChange(place.name);
    }
    setSearchResults([]);
    setSearchQuery(place.name);
  };

  // Handler GPS Geolocation: "Lokasi Saya Saat Ini"
  const handleGetMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Browser Anda tidak mendukung fitur deteksi lokasi GPS.');
      return;
    }

    setIsGettingLocation(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        onMarkerPosChange({ lat: latitude, lng: longitude });
        setViewState({
          latitude,
          longitude,
          zoom: 16,
        });

        // Coba cari nama tempat dari koordinat GPS
        try {
          const rev = await reverseGeocode(latitude, longitude);
          if (rev?.name && (!venueName || venueName.trim() === '')) {
            onVenueNameChange(rev.name);
          }
        } catch {
          // ignore
        }

        setIsGettingLocation(false);
      },
      (err) => {
        setIsGettingLocation(false);
        console.warn('Geolocation error:', err);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Izin akses lokasi ditolak. Harap izinkan akses lokasi di browser untuk menggunakan fitur ini.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError('Sinyal GPS / posisi saat ini tidak terdeteksi.');
        } else {
          setGeoError('Waktu permintaan lokasi habis. Coba ulangi kembali.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  };

  return (
    <div className={`flex flex-col gap-3.5 ${className}`}>
      {/* 1. Input Nama Masjid / Tempat Kajian */}
      {showVenueNameInput && (
        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-on-surface">
              Nama Masjid / Tempat Kajian {required && <span className="text-error">*</span>}
            </span>
            {nameSuggestion && (
              <button
                type="button"
                onClick={() => {
                  onVenueNameChange(nameSuggestion);
                  setNameSuggestion(null);
                }}
                className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                title="Gunakan nama tempat yang terdeteksi dari titik pin"
              >
                <span className="material-symbols-outlined text-[13px]">auto_fix_high</span>
                <span>Gunakan &quot;{nameSuggestion}&quot;</span>
              </button>
            )}
          </div>
          <input
            type="text"
            name="venue_name"
            value={venueName}
            onChange={(e) => onVenueNameChange(e.target.value)}
            className="w-full bg-surface-container-low border border-surface-container-high rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary transition-colors"
            placeholder="Contoh: Masjid Nurul Iman Blok M Square, Jakarta Selatan"
            required={required}
          />
        </label>
      )}

      {/* 2. Bar Pencarian Lokasi & Tombol GPS */}
      <div className="flex flex-col gap-1.5 relative" ref={searchContainerRef}>
        <span className="text-xs font-semibold text-on-surface">
          Cari Titik di Peta
        </span>

        <div className="flex gap-2">
          {/* Input text pencarian */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // Mencegah submit form saat menekan Enter
                  handleSearch();
                }
              }}
              className="w-full bg-surface-container-low border border-surface-container-high rounded-lg pl-8 pr-8 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary transition-colors"
              placeholder="Cari nama masjid, jalan, atau kecamatan..."
            />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline pointer-events-none">
              search
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setGeoError(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface text-[16px] material-symbols-outlined"
                title="Hapus pencarian"
              >
                close
              </button>
            )}
          </div>

          {/* Tombol Cari */}
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-3.5 bg-surface-container-high hover:bg-surface-container-highest disabled:opacity-50 text-on-surface rounded-lg text-xs font-semibold transition-colors flex items-center justify-center min-w-[64px]"
          >
            {isSearching ? (
              <span className="material-symbols-outlined animate-spin text-[18px] text-primary">
                progress_activity
              </span>
            ) : (
              'Cari'
            )}
          </button>

          {/* Tombol Trigger Lokasi Saya Saat Ini (GPS) */}
          <button
            type="button"
            onClick={handleGetMyLocation}
            disabled={isGettingLocation}
            className="px-3 bg-emerald-600/10 hover:bg-emerald-600/20 active:bg-emerald-600/30 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
            title="Tempatkan pin langsung di lokasi saya saat ini"
          >
            <span
              className={`material-symbols-outlined text-[17px] ${
                isGettingLocation ? 'animate-spin' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isGettingLocation ? 'progress_activity' : 'my_location'}
            </span>
            <span className="hidden sm:inline">Lokasi Saya</span>
          </button>
        </div>

        {/* Notifikasi Error Pencarian atau Geolocation */}
        {geoError && (
          <div className="p-2 rounded-lg bg-error-container/20 border border-error/30 text-error text-xs flex items-center gap-2 mt-1 animate-in fade-in">
            <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
            <span>{geoError}</span>
          </div>
        )}

        {/* Dropdown Hasil Pencarian */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface-container-lowest border border-surface-container-high rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="px-3 py-1.5 bg-surface-container-low border-b border-surface-container-high text-[11px] font-semibold text-outline flex items-center justify-between">
              <span>Hasil Pencarian ({searchResults.length})</span>
              <span className="text-[10px]">Klik untuk pilih titik</span>
            </div>
            <ul className="max-h-56 overflow-y-auto divide-y divide-surface-container-high">
              {searchResults.map((place) => (
                <li
                  key={place.id}
                  onClick={() => handleSelectPlace(place)}
                  className="px-3 py-2 text-xs hover:bg-surface-container cursor-pointer transition-colors flex items-start gap-2.5"
                >
                  <span
                    className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${
                      place.isMosque ? 'text-primary' : 'text-outline'
                    }`}
                  >
                    {place.isMosque ? 'mosque' : 'location_on'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-on-surface truncate block">
                        {place.name}
                      </span>
                      {place.isMosque && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary uppercase shrink-0">
                          Masjid
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
                      {place.placeName}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 3. Peta Mini Interaktif */}
      <div className="flex flex-col gap-1.5">
        <div className="w-full h-[260px] sm:h-[300px] rounded-xl overflow-hidden border border-surface-container-high relative shadow-2xs group">
          {/* Petunjuk Aksi Mengambang di Atas Peta */}
          <div className="absolute top-2.5 left-2.5 z-10 bg-surface/90 backdrop-blur text-[11px] px-2.5 py-1 rounded-md shadow-xs text-on-surface font-medium border border-surface-container-high pointer-events-none flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-error">touch_app</span>
            <span>Klik peta atau geser pin merah tepat di atas masjid</span>
          </div>

          <Map
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            onClick={(e) => {
              // Klik di mana saja pada peta memindahkan pin langsung
              onMarkerPosChange({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            }}
            mapStyle={`https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`}
            attributionControl={false}
            cursor="crosshair"
          >
            <NavigationControl position="bottom-right" showCompass={false} />

            {/* Marker Pin Utama yang Bisa Di-drag */}
            <Marker
              longitude={markerPos.lng}
              latitude={markerPos.lat}
              draggable
              onDragEnd={(e) => onMarkerPosChange({ lng: e.lngLat.lng, lat: e.lngLat.lat })}
            >
              <div
                className="cursor-grab active:cursor-grabbing transform -translate-y-1/2 flex flex-col items-center group/pin"
                title="Geser pin untuk penyesuaian posisi presisi"
              >
                <div className="relative">
                  <span
                    className="material-symbols-outlined text-[36px] text-error drop-shadow-md transition-transform group-hover/pin:scale-110"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    location_on
                  </span>
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white"></div>
                </div>
              </div>
            </Marker>
          </Map>

          {/* Badge Koordinat Real-time di Pojok Bawah Peta */}
          <div className="absolute bottom-2.5 left-2.5 z-10 bg-surface/90 backdrop-blur text-[10px] font-mono px-2 py-0.5 rounded shadow-xs text-on-surface-variant border border-surface-container-high pointer-events-none">
            {markerPos.lat.toFixed(5)}, {markerPos.lng.toFixed(5)}
          </div>
        </div>

        {/* Teks Preview Alamat dari Reverse Geocoding */}
        {addressPreview && (
          <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5 px-1 truncate">
            <span className="material-symbols-outlined text-[13px] text-outline shrink-0">place</span>
            <span className="truncate">Titik terpilih: <strong>{addressPreview}</strong></span>
          </div>
        )}
      </div>

      {/* Hidden inputs untuk FormData kompatibilitas dengan server action */}
      <input type="hidden" name="lat" value={markerPos.lat} />
      <input type="hidden" name="lng" value={markerPos.lng} />
    </div>
  );
}
