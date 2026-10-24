'use client';

import * as React from 'react';
import Map, { NavigationControl, Marker, Popup, Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import dynamic from 'next/dynamic';
import type { MosqueVenue } from '@/lib/services/venues';
import type { RouteResult } from '@/lib/services/routing';
import { useTheme } from '@/context/ThemeContext';
import MosquePopupCard from './MosquePopupCard';
import {
  type NavigationVehicleIcon,
  getStoredVehicleIcon,
  setStoredVehicleIcon,
  VEHICLE_OPTIONS,
  ALL_VEHICLE_OPTIONS,
} from '@/utils/navigationVehicle';
import { clearParkingSpot, type SavedParkingSpot } from '@/utils/parkingSpot';

const VehiclePickerModal = dynamic(() => import('./VehiclePickerModal'), { ssr: false });

setWorkerUrl('/lib/maplibre/maplibre-gl-worker.mjs');

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'get_your_own_OpIi9ZULNHzrESv6T2vL';
const DEFAULT_USER_RADIUS_KM = 30;

function getBoundsFromRadiusKm(
  lat: number,
  lng: number,
  radiusKm: number
): [[number, number], [number, number]] {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const lngDelta = radiusKm / (111.32 * cosLat);
  return [
    [lng - lngDelta, lat - latDelta],
    [lng + lngDelta, lat + latDelta],
  ];
}

function createGeoJsonCircle(
  lat: number,
  lng: number,
  radiusKm: number,
  points = 64
) {
  const coords: [number, number][] = [];
  const distanceX = radiusKm / (111.32 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  const distanceY = radiusKm / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
  };
}

interface MosqueMapMarkerProps {
  mosque: MosqueVenue;
  isSelected: boolean;
  onSelect: (mosque: MosqueVenue) => void;
  onFlyTo: (mosque: MosqueVenue) => void;
}

const MosqueMapMarker = React.memo(
  function MosqueMapMarker({ mosque, isSelected, onSelect, onFlyTo }: MosqueMapMarkerProps) {
    const handleClick = React.useCallback(
      (e: any) => {
        e.originalEvent.stopPropagation();
        onSelect(mosque);
        onFlyTo(mosque);
      },
      [mosque, onSelect, onFlyTo]
    );

    if (typeof mosque.lat !== 'number' || typeof mosque.lng !== 'number') return null;

    return (
      <Marker
        longitude={mosque.lng}
        latitude={mosque.lat}
        anchor="bottom"
        style={{ zIndex: isSelected ? 12 : 5 }}
        onClick={handleClick}
      >
        <div className="group flex flex-col items-center cursor-pointer select-none">
          {/* Tooltip Label Nama saat hover (saat terpilih digantikan oleh Floating Card Popup) */}
          {!isSelected && (
            <div className="px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold mb-1 shadow-md transition-all duration-150 whitespace-nowrap max-w-[140px] truncate bg-surface text-on-surface opacity-0 group-hover:opacity-100 border border-outline-variant/40 pointer-events-none">
              {mosque.name}
            </div>
          )}

          {/* Pin Ikon Masjid */}
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shadow-lg border-2 transition-transform duration-150 ${
              isSelected
                ? 'bg-emerald-600 border-white text-white scale-115 ring-4 ring-emerald-500/30'
                : 'bg-white dark:bg-slate-900 border-emerald-600 text-emerald-600 hover:scale-110'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] sm:text-[20px]">mosque</span>
          </div>
        </div>
      </Marker>
    );
  },
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.mosque.id === next.mosque.id &&
    prev.mosque.lat === next.mosque.lat &&
    prev.mosque.lng === next.mosque.lng &&
    prev.mosque.name === next.mosque.name
);

export interface MapFocusArea {
  lat: number;
  lng: number;
  radiusKm: number;
  key: string;
}

interface MosqueMapProps {
  mosques: MosqueVenue[];
  selectedMosque: MosqueVenue | null;
  onSelectMosque: (mosque: MosqueVenue | null) => void;
  userLocation: { lat: number; lng: number } | null;
  radiusKm?: number | null;
  focusArea?: MapFocusArea | null;
  activeRoute: RouteResult | null;
  isNavigating?: boolean;
  userHeading?: number | null;
  onStartRoute?: (mosque: MosqueVenue) => void;
  onOpenProfile?: (mosque: MosqueVenue) => void;
  vehicleIcon?: NavigationVehicleIcon;
  onVehicleIconChange?: (icon: NavigationVehicleIcon) => void;
  savedParkingSpot?: SavedParkingSpot | null;
  onClearParkingSpot?: () => void;
  mobileView?: 'map' | 'list';
  className?: string;
}

export default function MosqueMap({
  mosques,
  selectedMosque,
  onSelectMosque,
  userLocation,
  radiusKm = null,
  focusArea = null,
  activeRoute,
  isNavigating = false,
  userHeading = null,
  onStartRoute,
  onOpenProfile,
  vehicleIcon,
  onVehicleIconChange,
  savedParkingSpot,
  onClearParkingSpot,
  mobileView = 'list',
  className = '',
}: MosqueMapProps) {
  const mapRef = React.useRef<MapRef>(null);
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isMapLoaded, setIsMapLoaded] = React.useState(false);
  const [isFollowingUser, setIsFollowingUser] = React.useState(true);
  const [cameraOrientation, setCameraOrientation] = React.useState<'heads-up' | 'north-up'>('heads-up');
  const [selectedParkingPopup, setSelectedParkingPopup] = React.useState(false);
  const lastCenteredKeyRef = React.useRef<string | null>(null);
  const prevFocusAreaRef = React.useRef<MapFocusArea | null>(null);
  const [mapCursor, setMapCursor] = React.useState<string>('grab');
  const [viewport, setViewport] = React.useState<{
    zoom: number;
    bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  }>({
    zoom: 11,
    bounds: null,
  });

  const syncViewport = React.useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const b = map.getBounds();
    const z = map.getZoom();
    setViewport({
      zoom: z,
      bounds: b
        ? {
            minLng: b.getWest(),
            minLat: b.getSouth(),
            maxLng: b.getEast(),
            maxLat: b.getNorth(),
          }
        : null,
    });
  }, []);

  const [isSatelliteMode, setIsSatelliteMode] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('peta_kajian_satellite') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSatelliteMode = React.useCallback(() => {
    setIsSatelliteMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('peta_kajian_satellite', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [internalVehicleIcon, setInternalVehicleIcon] = React.useState<NavigationVehicleIcon>(
    vehicleIcon || 'car'
  );
  const [isVehiclePickerOpen, setIsVehiclePickerOpen] = React.useState(false);

  React.useEffect(() => {
    setInternalVehicleIcon(vehicleIcon || getStoredVehicleIcon());
  }, [vehicleIcon]);

  const activeVehicle = vehicleIcon || internalVehicleIcon;
  const currentVehicleConfig =
    ALL_VEHICLE_OPTIONS.find((v) => v.id === activeVehicle) || VEHICLE_OPTIONS[0];

  const handleSelectVehicle = (newIcon: NavigationVehicleIcon) => {
    setInternalVehicleIcon(newIcon);
    setStoredVehicleIcon(newIcon);
    if (onVehicleIconChange) {
      onVehicleIconChange(newIcon);
    }
  };

  // Menambahkan layer 3D Building Extrusion MapTiler saat style dimuat
  const add3DBuildings = React.useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (map.getLayer('3d-buildings')) return;

    const style = map.getStyle();
    if (!style || !style.sources) return;

    let vectorSourceId = 'openmaptiles';
    if (!style.sources['openmaptiles'] && style.sources['maptiler_planet']) {
      vectorSourceId = 'maptiler_planet';
    }

    const layers = style.layers || [];
    let labelLayerId: string | undefined;
    for (const l of layers) {
      if (l.type === 'symbol' && l.layout && (l.layout as any)['text-field']) {
        labelLayerId = l.id;
        break;
      }
    }

    try {
      map.addLayer(
        {
          id: '3d-buildings',
          source: vectorSourceId,
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14.5,
          paint: {
            'fill-extrusion-color': resolvedTheme === 'dark' ? '#263238' : '#cbd5e1',
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14.5,
              0,
              15.5,
              ['case', ['has', 'render_height'], ['get', 'render_height'], 10],
            ],
            'fill-extrusion-base': [
              'case',
              ['has', 'render_min_height'],
              ['get', 'render_min_height'],
              0,
            ],
            'fill-extrusion-opacity': 0.6,
          },
        },
        labelLayerId
      );
    } catch {}
  }, [resolvedTheme]);

  const handleMapLoad = React.useCallback(() => {
    setIsMapLoaded(true);
    mapRef.current?.resize();
    add3DBuildings();
    syncViewport();
  }, [add3DBuildings, syncViewport]);

  React.useEffect(() => {
    if (isMapLoaded && !isSatelliteMode) {
      add3DBuildings();
    }
  }, [isMapLoaded, resolvedTheme, isSatelliteMode, add3DBuildings]);

  // Reset mode mengikuti pengguna saat navigasi dimulai
  React.useEffect(() => {
    if (isNavigating) {
      setIsFollowingUser(true);
    }
  }, [isNavigating]);

  // Toggle orientasi kamera (Heads-Up 3D vs North-Up 2D)
  const toggleCameraOrientation = React.useCallback(() => {
    if (!mapRef.current) return;
    setIsFollowingUser(true);
    if (cameraOrientation === 'heads-up') {
      setCameraOrientation('north-up');
      mapRef.current.easeTo({
        bearing: 0,
        pitch: 0,
        duration: 600,
      });
    } else {
      setCameraOrientation('heads-up');
      const heading = typeof userHeading === 'number' && !isNaN(userHeading) ? userHeading : 0;
      mapRef.current.easeTo({
        bearing: heading,
        pitch: 50,
        duration: 600,
      });
    }
  }, [cameraOrientation, userHeading]);

  // Pusatkan kembali kamera ke posisi GPS dan arah kemudi
  const handleRecenter = React.useCallback(() => {
    if (!userLocation || !mapRef.current) return;
    setIsFollowingUser(true);
    if (cameraOrientation === 'heads-up') {
      const heading = typeof userHeading === 'number' && !isNaN(userHeading) ? userHeading : 0;
      mapRef.current.easeTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 17.5,
        pitch: 50,
        bearing: heading,
        duration: 800,
        essential: true,
      });
    } else {
      mapRef.current.easeTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 17,
        pitch: 0,
        bearing: 0,
        duration: 800,
        essential: true,
      });
    }
  }, [userLocation, userHeading, cameraOrientation]);

  // Fokuskan kamera peta ke area lokasi/wilayah terpilih dengan padding adaptif
  const fitToUserRadius = React.useCallback(
    (loc: { lat: number; lng: number }, radiusKm = DEFAULT_USER_RADIUS_KM, duration = 1000) => {
      if (!mapRef.current) return;
      const map = mapRef.current.getMap();
      if (!map) return;
      map.resize();

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      const bounds = getBoundsFromRadiusKm(loc.lat, loc.lng, radiusKm);
      map.fitBounds(bounds, {
        padding: isMobile
          ? { top: 90, bottom: 50, left: 25, right: 25 }
          : { top: 50, bottom: 50, left: 50, right: 50 },
        pitch: 0,
        bearing: 0,
        duration,
        essential: true,
      });
    },
    []
  );

  // Saat peta siap atau area fokus (radius / wilayah / quick city) berubah, pusatkan kamera ke area fokus
  React.useEffect(() => {
    if (!isMapLoaded || selectedMosque || activeRoute || isNavigating) {
      if (!focusArea) {
        lastCenteredKeyRef.current = null;
      }
      return;
    }

    const target = focusArea
      ? { lat: focusArea.lat, lng: focusArea.lng, radiusKm: focusArea.radiusKm, key: focusArea.key }
      : userLocation && typeof radiusKm === 'number' && radiusKm > 0
      ? {
          lat: userLocation.lat,
          lng: userLocation.lng,
          radiusKm,
          key: `radius:${userLocation.lat.toFixed(4)},${userLocation.lng.toFixed(4)}_${radiusKm}`,
        }
      : null;

    if (!target) {
      // Jika filter wilayah/radius sebelumnya aktif dan kini di-reset, kembali ke zoom pandang umum Indonesia
      if (prevFocusAreaRef.current && mapRef.current) {
        mapRef.current.flyTo({
          center: [118.0, -2.0],
          zoom: 4.5,
          duration: 1200,
          essential: true,
        });
      }
      lastCenteredKeyRef.current = null;
      prevFocusAreaRef.current = null;
      return;
    }

    prevFocusAreaRef.current = focusArea ?? null;

    if (lastCenteredKeyRef.current === target.key) return;
    lastCenteredKeyRef.current = target.key;

    // Pastikan layout canvas WebGL telah selesai reflow di DOM
    const timer = setTimeout(() => {
      fitToUserRadius({ lat: target.lat, lng: target.lng }, target.radiusKm, 900);
    }, 60);

    return () => clearTimeout(timer);
  }, [isMapLoaded, focusArea, userLocation, radiusKm, selectedMosque, activeRoute, isNavigating, fitToUserRadius]);

  // Saat di mobile pengguna beralih dari daftar ke peta tanpa masjid terpilih, pastikan peta merender area fokus
  React.useEffect(() => {
    if (!isMapLoaded || mobileView !== 'map' || selectedMosque || activeRoute || isNavigating) return;
    const target = focusArea
      ? { lat: focusArea.lat, lng: focusArea.lng, radiusKm: focusArea.radiusKm }
      : userLocation && typeof radiusKm === 'number' && radiusKm > 0
      ? { lat: userLocation.lat, lng: userLocation.lng, radiusKm }
      : userLocation
      ? { lat: userLocation.lat, lng: userLocation.lng, radiusKm: DEFAULT_USER_RADIUS_KM }
      : null;

    if (target) {
      mapRef.current?.resize();
      const timer = setTimeout(() => {
        fitToUserRadius({ lat: target.lat, lng: target.lng }, target.radiusKm, 0);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isMapLoaded, mobileView, focusArea, userLocation, radiusKm, selectedMosque, activeRoute, isNavigating, fitToUserRadius]);

  // Terbang ke masjid terpilih dengan vertical offset adaptif agar floating card + pin tampil tepat di tengah layar
  const flyToMosque = React.useCallback((mosque: MosqueVenue) => {
    if (!mapRef.current || typeof mosque.lat !== 'number' || typeof mosque.lng !== 'number') return;
    mapRef.current.resize();
    let offsetY = 140;
    if (typeof window !== 'undefined') {
      const isDesktop = window.innerWidth >= 640;
      offsetY = isDesktop ? 150 : 135;
    }
    mapRef.current.flyTo({
      center: [mosque.lng, mosque.lat],
      offset: [0, offsetY],
      zoom: 15,
      pitch: 0,
      bearing: 0,
      duration: 1000,
      essential: true,
    });
  }, []);

  React.useEffect(() => {
    if (isMapLoaded && selectedMosque && !activeRoute && !isNavigating) {
      flyToMosque(selectedMosque);
    }
  }, [isMapLoaded, selectedMosque, activeRoute, isNavigating, mobileView, flyToMosque]);

  // Reset sudut kamera 3D kembali ke 2D rata saat navigasi selesai
  React.useEffect(() => {
    if (isMapLoaded && !isNavigating && !selectedMosque && mapRef.current) {
      mapRef.current.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 800,
      });
    }
  }, [isMapLoaded, isNavigating, selectedMosque]);

  // Auto fitBounds saat rute in-app aktif (sebelum mode navigasi 3D)
  React.useEffect(() => {
    if (isMapLoaded && activeRoute && !isNavigating && mapRef.current) {
      const coords = activeRoute.geometry.coordinates;
      if (coords.length > 0) {
        let minLng = coords[0][0];
        let maxLng = coords[0][0];
        let minLat = coords[0][1];
        let maxLat = coords[0][1];

        for (const [lng, lat] of coords) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }

        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;
        mapRef.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: isDesktop
              ? { top: 90, bottom: 90, left: 90, right: 430 }
              : { top: 70, bottom: 340, left: 25, right: 25 },
            duration: 1200,
            essential: true,
          }
        );
      }
    }
  }, [isMapLoaded, activeRoute, isNavigating]);

  // Kamera mengikuti pengguna saat navigasi turn-by-turn aktif
  React.useEffect(() => {
    if (isMapLoaded && isNavigating && isFollowingUser && userLocation && mapRef.current) {
      if (cameraOrientation === 'heads-up') {
        const heading = typeof userHeading === 'number' && !isNaN(userHeading) ? userHeading : 0;
        mapRef.current.easeTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 17.5,
          pitch: 50,
          bearing: heading,
          duration: 800,
          essential: true,
        });
      } else {
        mapRef.current.easeTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 17,
          pitch: 0,
          bearing: 0,
          duration: 800,
          essential: true,
        });
      }
    }
  }, [isMapLoaded, isNavigating, isFollowingUser, userLocation, userHeading, cameraOrientation]);

  // Rute alternatif OSRM
  const inactiveAlternativeRoutes = React.useMemo(() => {
    if (!activeRoute) return [];
    if (activeRoute.allRoutes && activeRoute.allRoutes.length > 1) {
      return activeRoute.allRoutes.filter(
        (r) =>
          r.geometry !== activeRoute.geometry &&
          (r.routeIndex === undefined || r.routeIndex !== activeRoute.routeIndex)
      );
    }
    return activeRoute.alternatives || [];
  }, [activeRoute]);

  const routeGeoJson = React.useMemo(() => {
    if (!activeRoute) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: activeRoute.geometry,
    };
  }, [activeRoute]);

  const radiusCircleGeoJson = React.useMemo(() => {
    if (activeRoute || isNavigating) return null;

    if (focusArea && typeof focusArea.radiusKm === 'number' && focusArea.radiusKm > 0) {
      return createGeoJsonCircle(focusArea.lat, focusArea.lng, focusArea.radiusKm, 64);
    }

    if (
      userLocation &&
      typeof radiusKm === 'number' &&
      radiusKm > 0
    ) {
      return createGeoJsonCircle(userLocation.lat, userLocation.lng, radiusKm, 64);
    }

    return null;
  }, [focusArea, userLocation, radiusKm, activeRoute, isNavigating]);

  // GeoJSON FeatureCollection untuk GPU Supercluster (mendukung 13.000+ masjid di zoom jauh)
  const mosquesGeoJson = React.useMemo(() => {
    const features = [];
    for (let i = 0; i < mosques.length; i++) {
      const m = mosques[i];
      if (typeof m.lat === 'number' && typeof m.lng === 'number') {
        features.push({
          type: 'Feature' as const,
          properties: {
            id: m.id,
            name: m.name,
            activeCount: m.active_sessions_count || 0,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [m.lng, m.lat] as [number, number],
          },
        });
      }
    }
    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [mosques]);

  // Filter marker DOM kubah masjid berdasarkan viewport & level zoom agar super ringan namun responsif di semua area
  const domMosques = React.useMemo(() => {
    // Saat zoom dekat (>= 12.2) atau jumlah total hasil filter sedikit (<= 80), render pin DOM kubah di dalam viewport
    const showAllInViewport = viewport.zoom >= 12.2 || mosques.length <= 80;
    const result: MosqueVenue[] = [];

    if (showAllInViewport) {
      const b = viewport.bounds;
      if (b) {
        const lngPad = (b.maxLng - b.minLng) * 0.15;
        const latPad = (b.maxLat - b.minLat) * 0.15;
        const minLng = b.minLng - lngPad;
        const maxLng = b.maxLng + lngPad;
        const minLat = b.minLat - latPad;
        const maxLat = b.maxLat + latPad;

        for (let i = 0; i < mosques.length; i++) {
          const m = mosques[i];
          if (
            typeof m.lat === 'number' &&
            typeof m.lng === 'number' &&
            m.lng >= minLng &&
            m.lng <= maxLng &&
            m.lat >= minLat &&
            m.lat <= maxLat
          ) {
            result.push(m);
            if (result.length >= 180) break;
          }
        }
      } else {
        for (let i = 0; i < Math.min(mosques.length, 150); i++) {
          result.push(mosques[i]);
        }
      }
    }

    // Pastikan masjid yang sedang dipilih selalu dirender sebagai pin DOM kubah di level zoom berapa pun
    if (selectedMosque && !result.some((m) => m.id === selectedMosque.id)) {
      result.push(selectedMosque);
    }

    return result;
  }, [mosques, viewport, selectedMosque]);

  // Handler klik pada bulatan Cluster atau titik GeoJSON masjid saat zoom jauh
  const handleMapClick = React.useCallback(
    async (evt: any) => {
      const features = evt.features;
      if (features && features.length > 0) {
        const topFeature = features[0];

        // 1. Jika klik pada bulatan Cluster -> zoom in memperbesar klaster
        if (topFeature.layer?.id === 'mosque-clusters') {
          const clusterId = topFeature.properties?.cluster_id;
          const coords = topFeature.geometry?.coordinates as [number, number] | undefined;
          const map = mapRef.current?.getMap();
          const source = map?.getSource('mosques-cluster-source') as any;

          if (source && typeof source.getClusterExpansionZoom === 'function' && coords) {
            try {
              const expansionZoom = await Promise.resolve(
                source.getClusterExpansionZoom(clusterId)
              );
              mapRef.current?.easeTo({
                center: coords,
                zoom: Math.min(typeof expansionZoom === 'number' ? expansionZoom + 0.5 : 13.5, 16),
                duration: 550,
                essential: true,
              });
            } catch {
              mapRef.current?.easeTo({
                center: coords,
                zoom: Math.min(viewport.zoom + 2.5, 15),
                duration: 550,
                essential: true,
              });
            }
          }
          return;
        }

        // 2. Jika klik pada titik masjid tunggal di zoom jauh -> pilih masjid & terbang ke lokasinya
        if (topFeature.layer?.id === 'mosque-unclustered-point') {
          const clickedId = topFeature.properties?.id;
          const found = mosques.find((m) => m.id === clickedId);
          if (found) {
            onSelectMosque(found);
            flyToMosque(found);
            return;
          }
        }
      }

      if (selectedMosque && !activeRoute && !isNavigating) {
        onSelectMosque(null);
      }
    },
    [mosques, selectedMosque, activeRoute, isNavigating, onSelectMosque, flyToMosque, viewport.zoom]
  );

  return (
    <div className={`w-full h-full relative ${className}`}>
      <Map
        ref={mapRef}
        cursor={mapCursor}
        interactiveLayerIds={['mosque-clusters', 'mosque-unclustered-point']}
        initialViewState={{
          longitude:
            selectedMosque && typeof selectedMosque.lng === 'number'
              ? selectedMosque.lng
              : userLocation
              ? userLocation.lng
              : 106.816666,
          latitude:
            selectedMosque && typeof selectedMosque.lat === 'number'
              ? selectedMosque.lat
              : userLocation
              ? userLocation.lat
              : -6.2,
          zoom:
            selectedMosque && typeof selectedMosque.lng === 'number'
              ? 15
              : userLocation
              ? 13
              : 11,
        }}
        onLoad={handleMapLoad}
        onClick={handleMapClick}
        onMouseEnter={() => setMapCursor('pointer')}
        onMouseLeave={() => setMapCursor('grab')}
        onDragStart={() => {
          if (isNavigating) {
            setIsFollowingUser(false);
          }
        }}
        onMoveStart={(evt) => {
          if (isNavigating && evt.originalEvent) {
            setIsFollowingUser(false);
          }
        }}
        onMoveEnd={syncViewport}
        mapStyle={
          isSatelliteMode
            ? `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
            : resolvedTheme === 'dark'
            ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
            : `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
        }
      >
        {!isNavigating && <NavigationControl position="bottom-right" showCompass={false} />}

        {/* LAYER LINGKARAN AREA RADIUS PENGGUNA */}
        {radiusCircleGeoJson && (
          <Source id="user-radius-circle" type="geojson" data={radiusCircleGeoJson}>
            <Layer
              id="user-radius-circle-fill"
              type="fill"
              paint={{
                'fill-color': '#10b981',
                'fill-opacity': resolvedTheme === 'dark' ? 0.12 : 0.08,
              }}
            />
            <Layer
              id="user-radius-circle-stroke"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': '#10b981',
                'line-width': 2,
                'line-opacity': 0.75,
                'line-dasharray': [3, 2],
              }}
            />
          </Source>
        )}

        {/* LAYER RUTE ALTERNATIF OSRM */}
        {inactiveAlternativeRoutes.map((altRoute, altIdx) => (
          <Source
            key={`alt-route-${altRoute.routeIndex ?? altIdx}`}
            id={`alt-route-source-${altRoute.routeIndex ?? altIdx}`}
            type="geojson"
            data={{
              type: 'Feature',
              properties: {},
              geometry: altRoute.geometry,
            }}
          >
            <Layer
              id={`alt-route-casing-${altRoute.routeIndex ?? altIdx}`}
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': resolvedTheme === 'dark' ? '#1e293b' : '#64748b',
                'line-width': activeRoute?.mode === 'walking' ? 8 : 7,
                'line-opacity': 0.4,
                ...(activeRoute?.mode === 'walking' ? { 'line-dasharray': [0, 1.8] } : {}),
              }}
            />
            <Layer
              id={`alt-route-line-${altRoute.routeIndex ?? altIdx}`}
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': resolvedTheme === 'dark' ? '#94a3b8' : '#cbd5e1',
                'line-width': activeRoute?.mode === 'walking' ? 5 : 4.5,
                'line-opacity': 0.75,
                ...(activeRoute?.mode === 'walking' ? { 'line-dasharray': [0, 1.8] } : {}),
              }}
            />
          </Source>
        ))}

        {/* LAYER RUTE UTAMA OSRM */}
        {routeGeoJson && (
          <Source id="active-mosque-route" type="geojson" data={routeGeoJson}>
            <Layer
              id="active-mosque-route-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': resolvedTheme === 'dark' ? '#064e3b' : '#047857',
                'line-width': activeRoute?.mode === 'walking' ? 9 : 8,
                'line-opacity': activeRoute?.mode === 'walking' ? 0.75 : 0.85,
                ...(activeRoute?.mode === 'walking' ? { 'line-dasharray': [0, 1.8] } : {}),
              }}
            />
            <Layer
              id="active-mosque-route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': '#10b981',
                'line-width': activeRoute?.mode === 'walking' ? 6 : 5,
                'line-opacity': 0.95,
                ...(activeRoute?.mode === 'walking' ? { 'line-dasharray': [0, 1.8] } : {}),
              }}
            />
          </Source>
        )}

        {/* MARKER LOKASI PARKIR SAYA */}
        {savedParkingSpot && (
          <Marker
            longitude={savedParkingSpot.lng}
            latitude={savedParkingSpot.lat}
            anchor="bottom"
            style={{ zIndex: 14 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedParkingPopup(true);
            }}
          >
            <div className="flex flex-col items-center cursor-pointer group animate-bounce">
              <div className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] shadow-lg flex items-center gap-1 border-2 border-white ring-2 ring-amber-400/40">
                <span className="material-symbols-outlined text-[14px]">local_parking</span>
                <span>Parkir Saya</span>
              </div>
              <div className="w-2.5 h-2.5 bg-amber-500 rotate-45 -mt-1.5 border-r-2 border-b-2 border-white" />
            </div>
          </Marker>
        )}

        {savedParkingSpot && selectedParkingPopup && (
          <Popup
            longitude={savedParkingSpot.lng}
            latitude={savedParkingSpot.lat}
            anchor="top"
            onClose={() => setSelectedParkingPopup(false)}
            closeButton={false}
            offset={12}
            className="z-25 font-geist"
          >
            <div className="p-3 bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container-high max-w-[220px]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <span className="material-symbols-outlined text-[16px]">local_parking</span>
                <span>Lokasi Parkir Anda</span>
              </div>
              {savedParkingSpot.venueName && (
                <p className="text-[11px] font-semibold text-on-surface mt-1 truncate">
                  {savedParkingSpot.venueName}
                </p>
              )}
              <p className="text-[10px] text-outline mt-0.5">
                Ditandai{' '}
                {new Date(savedParkingSpot.savedAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                WIB
              </p>
              <button
                type="button"
                onClick={() => {
                  clearParkingSpot();
                  setSelectedParkingPopup(false);
                  onClearParkingSpot?.();
                }}
                className="mt-2 w-full py-1.5 px-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 text-[10px] font-bold border border-red-200 dark:border-red-800 transition-colors cursor-pointer"
              >
                Hapus Tanda Parkir
              </button>
            </div>
          </Popup>
        )}

        {/* MARKER LOKASI PENGGUNA (TITIK BIRU ATAU KURSOR KENDARAAN NAVIGASI) */}
        {userLocation && (
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="center"
            style={{ zIndex: 15 }}
          >
            {isNavigating ? (
              <div
                className="relative flex items-center justify-center transition-transform duration-300 cursor-pointer group"
                style={{
                  transform:
                    typeof userHeading === 'number' && !isNaN(userHeading)
                      ? `rotate(${userHeading}deg)`
                      : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeRoute?.mode !== 'walking' && activeVehicle !== 'person') {
                    setIsVehiclePickerOpen(true);
                  }
                }}
                title={
                  activeRoute?.mode === 'walking' || activeVehicle === 'person'
                    ? 'Kursor: Pejalan Kaki'
                    : `Kursor: ${currentVehicleConfig.label} (Klik untuk ganti)`
                }
              >
                <div className="absolute -inset-3 rounded-full bg-blue-500/25 animate-ping pointer-events-none" />
                <div className="absolute -top-1.5 w-0 h-0 border-x-4 border-x-transparent border-b-[6px] border-b-white dark:border-b-slate-900 z-10 drop-shadow-xs" />
                <div
                  className={`w-9 h-9 rounded-full ${currentVehicleConfig.badgeBg} border-2 border-white dark:border-slate-900 shadow-xl flex items-center justify-center text-white transition-transform active:scale-90 group-hover:scale-105`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {currentVehicleConfig.icon}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative flex items-center justify-center" title="Lokasi Saya">
                <div className="absolute -inset-2.5 rounded-full bg-blue-500/30 animate-ping pointer-events-none" />
                <div className="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-md transition-transform" />
              </div>
            )}
          </Marker>
        )}

        {/* LAYER GPU SUPERCLUSTER MASJID (AKTIF SAAT ZOOM JAUH < 12.2 DAN DATA > 80) */}
        {!isNavigating && mosques.length > 80 && (
          <Source
            id="mosques-cluster-source"
            type="geojson"
            data={mosquesGeoJson}
            cluster={true}
            clusterMaxZoom={12}
            clusterRadius={48}
          >
            <Layer
              id="mosque-clusters"
              type="circle"
              filter={['has', 'point_count']}
              maxzoom={12.2}
              paint={{
                'circle-color': [
                  'step',
                  ['get', 'point_count'],
                  '#10b981',
                  30,
                  '#059669',
                  150,
                  '#047857',
                ],
                'circle-radius': [
                  'step',
                  ['get', 'point_count'],
                  17,
                  30,
                  22,
                  150,
                  27,
                ],
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.92,
              }}
            />
            <Layer
              id="mosque-cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              maxzoom={12.2}
              layout={{
                'text-field': '{point_count_abbreviated}',
                'text-size': 12,
                'text-allow-overlap': true,
              }}
              paint={{
                'text-color': '#ffffff',
              }}
            />
            <Layer
              id="mosque-unclustered-point"
              type="circle"
              filter={['!', ['has', 'point_count']]}
              maxzoom={12.2}
              paint={{
                'circle-color': '#10b981',
                'circle-radius': 7,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.95,
              }}
            />
          </Source>
        )}

        {/* MOSQUE MARKERS (MEMOIZED VIEWPORT DOM PINS) */}
        {domMosques.map((mosque) => (
          <MosqueMapMarker
            key={mosque.id}
            mosque={mosque}
            isSelected={selectedMosque?.id === mosque.id}
            onSelect={onSelectMosque}
            onFlyTo={flyToMosque}
          />
        ))}

        {/* FLOATING CARD INFORMASI MASJID DI TITIK MASJID PETA */}
        {selectedMosque &&
          typeof selectedMosque.lat === 'number' &&
          typeof selectedMosque.lng === 'number' &&
          !activeRoute &&
          !isNavigating && (
            <Popup
              anchor="bottom"
              longitude={selectedMosque.lng}
              latitude={selectedMosque.lat}
              onClose={() => onSelectMosque(null)}
              closeButton={false}
              closeOnClick={false}
              className="z-25"
              offset={38}
              maxWidth="none"
            >
              <MosquePopupCard
                key={selectedMosque.id}
                mosque={selectedMosque}
                onClose={() => onSelectMosque(null)}
                onStartRoute={onStartRoute}
                onOpenProfile={onOpenProfile}
              />
            </Popup>
          )}
      </Map>

      {/* Floating Map Navigation Controls (Kompas, Mode Satelit, Switch Dark Mode) */}
      {(isNavigating || activeRoute) && (
        <div
          className={`fixed md:absolute right-3 md:right-6 z-40 flex flex-col gap-2 items-center animate-in fade-in zoom-in-95 duration-200 ${
            isNavigating ? 'top-[164px] md:top-6' : 'top-16 sm:top-6'
          }`}
        >
          {/* 1. Tombol Kompas (Hanya saat Live Navigation) */}
          {isNavigating && (
            <button
              type="button"
              onClick={toggleCameraOrientation}
              className="w-10 h-10 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md hover:bg-surface-container text-primary flex items-center justify-center shadow-xl border border-surface-container-high/80 transition-all active:scale-95 cursor-pointer"
              title={
                cameraOrientation === 'heads-up'
                  ? 'Orientasi: Mengikuti Arah Kendaraan (Klik untuk Hadap Utara)'
                  : 'Orientasi: Menghadap Utara (Klik untuk Mengikuti Arah Kendaraan)'
              }
              aria-label="Ubah Orientasi Kamera Kompas"
            >
              <span
                className="material-symbols-outlined text-[22px] transition-transform duration-300"
                style={{
                  transform:
                    cameraOrientation === 'heads-up'
                      ? `rotate(${-(userHeading || 0)}deg)`
                      : 'rotate(0deg)',
                }}
              >
                explore
              </span>
            </button>
          )}

          {/* 2. Tombol Toggle Mode Satelit Hybrid */}
          <button
            type="button"
            onClick={toggleSatelliteMode}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl border transition-all active:scale-95 cursor-pointer backdrop-blur-md ${
              isSatelliteMode
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30 ring-2 ring-emerald-400'
                : 'bg-surface-container-lowest/95 hover:bg-surface-container text-on-surface border-surface-container-high/80'
            }`}
            title={
              isSatelliteMode
                ? 'Mode Satelit: Aktif (Klik untuk Mode Jalanan)'
                : 'Beralih ke Tampilan Citra Satelit Hybrid'
            }
            aria-label="Toggle Mode Satelit"
          >
            <span className="material-symbols-outlined text-[20px]">satellite_alt</span>
          </button>

          {/* 3. Tombol Switch Dark Mode / Light Mode (Hanya di Mobile) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="sm:hidden w-10 h-10 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md hover:bg-surface-container text-on-surface flex items-center justify-center shadow-xl border border-surface-container-high/80 transition-all active:scale-95 cursor-pointer"
            title={
              resolvedTheme === 'dark'
                ? 'Tema: Gelap (Klik untuk Mode Terang)'
                : 'Tema: Terang (Klik untuk Mode Gelap)'
            }
            aria-label="Toggle Dark Mode"
          >
            <span className="material-symbols-outlined text-[20px] text-amber-500 dark:text-amber-400">
              {resolvedTheme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>
      )}

      {/* Floating Tombol Pusatkan saat Navigasi Langsung Sedang Tidak Mengikuti Pengguna */}
      {isNavigating && !isFollowingUser && userLocation && (
        <div className="fixed md:absolute bottom-[calc(155px+env(safe-area-inset-bottom,0px))] md:bottom-24 right-4 md:right-6 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            type="button"
            onClick={handleRecenter}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md hover:bg-surface-container text-primary font-bold text-xs shadow-xl border border-surface-container-high/90 transition-all active:scale-95 cursor-pointer"
            title="Pusatkan kembali ke posisi saya"
          >
            <span
              className="material-symbols-outlined text-[18px] text-primary"
              style={{
                transform: `rotate(${userHeading || 0}deg)`,
                transition: 'transform 0.3s ease',
              }}
            >
              navigation
            </span>
            <span>Pusatkan</span>
          </button>
        </div>
      )}

      {/* Modal Pemilih Kustomisasi Kendaraan */}
      <VehiclePickerModal
        isOpen={isVehiclePickerOpen}
        onClose={() => setIsVehiclePickerOpen(false)}
        currentIcon={activeVehicle}
        onSelect={handleSelectVehicle}
      />
    </div>
  );
}
