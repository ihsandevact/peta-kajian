import * as React from 'react';
import Map, { NavigationControl, Marker, Popup, Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type StudySession, hasPhysicalLocation } from '@/lib/services/kajian';
import type { SelectedRegion } from '@/utils/regions';
import type { RouteResult } from '@/lib/services/routing';
import VenueCard from './VenueCard';
import OnlineStreamingOverlay from './OnlineStreamingOverlay';
import { useTheme } from '@/context/ThemeContext';
import {
  type NavigationVehicleIcon,
  getStoredVehicleIcon,
  setStoredVehicleIcon,
  VEHICLE_OPTIONS,
  ALL_VEHICLE_OPTIONS,
} from '@/utils/navigationVehicle';
import { clearParkingSpot, type SavedParkingSpot } from '@/utils/parkingSpot';
import VehiclePickerModal from './VehiclePickerModal';

setWorkerUrl('/lib/maplibre/maplibre-gl-worker.mjs');

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'get_your_own_OpIi9ZULNHzrESv6T2vL';

interface AppMapProps {
  sessions: StudySession[];
  selectedSession: StudySession | null;
  onSelectSession: (s: StudySession | null) => void;
  flyToRegion?: SelectedRegion | null;
  activeRoute?: RouteResult | null;
  userLocation?: { lat: number; lng: number } | null;
  onStartRoute?: (session: StudySession) => void;
  isNavigating?: boolean;
  userHeading?: number | null;
  vehicleIcon?: NavigationVehicleIcon;
  onVehicleIconChange?: (icon: NavigationVehicleIcon) => void;
  savedParkingSpot?: SavedParkingSpot | null;
  onClearParkingSpot?: () => void;
  onSelectAlternativeRoute?: (route: RouteResult) => void;
}

export default function AppMap({
  sessions,
  selectedSession,
  onSelectSession,
  flyToRegion,
  activeRoute,
  userLocation,
  onStartRoute,
  isNavigating = false,
  userHeading = null,
  vehicleIcon,
  onVehicleIconChange,
  savedParkingSpot,
  onClearParkingSpot,
  onSelectAlternativeRoute,
}: AppMapProps) {
  const mapRef = React.useRef<MapRef>(null);
  const { resolvedTheme, toggleTheme } = useTheme();
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

  const [isMapLoaded, setIsMapLoaded] = React.useState(false);
  const [isFollowingUser, setIsFollowingUser] = React.useState(true);
  const [cameraOrientation, setCameraOrientation] = React.useState<'heads-up' | 'north-up'>('heads-up');
  const [selectedParkingPopup, setSelectedParkingPopup] = React.useState(false);
  const prevRegionRef = React.useRef<SelectedRegion | null | undefined>(undefined);

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
  
  const [viewState, setViewState] = React.useState({
    longitude: 118.0, // Titik Tengah Indonesia
    latitude: -2.0,
    zoom: 4.5
  });

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

    // Tempatkan di bawah layer label teks pertama
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
    } catch {
      // Abaikan jika tidak didukung oleh style tertentu
    }
  }, [resolvedTheme]);

  const handleMapLoad = React.useCallback(() => {
    setIsMapLoaded(true);
    mapRef.current?.resize();
    add3DBuildings();
  }, [add3DBuildings]);

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

  // Fungsi toggle orientasi kamera (Heads-Up vs North-Up)
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

  // Fungsi untuk memusatkan kamera kembali ke posisi GPS dan arah kemudi
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

  const getLat = (s: StudySession) => s.venues?.lat || 0;
  const getLng = (s: StudySession) => s.venues?.lng || 0;

  // Kajian online murni tidak punya titik di peta
  const mappableSessions = React.useMemo(() => sessions.filter(hasPhysicalLocation), [sessions]);
  const selectedHasLocation = !!selectedSession && hasPhysicalLocation(selectedSession);

  // Fungsi helper untuk terbang ke kajian dengan offset adaptif
  const flyToSession = React.useCallback((session: StudySession) => {
    if (!hasPhysicalLocation(session) || !mapRef.current) return;
    let offsetY = 210;
    if (typeof window !== 'undefined') {
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop) {
        // Desktop: offset Y positif (200px - 260px) agar card & poster berada aman di bawah pill info live
        offsetY = Math.min(260, Math.max(200, Math.round(window.innerHeight * 0.28)));
      } else {
        // Mobile: naikkan posisi card secara adaptif (45px - 85px) agar berada di tengah area pandang aktif dan aman di atas bottom sheet (224px)
        offsetY = Math.min(85, Math.max(45, Math.round(window.innerHeight * 0.085)));
      }
    }

    mapRef.current.flyTo({
      center: [getLng(session), getLat(session)],
      offset: [0, offsetY],
      zoom: 14,
      pitch: 0,
      bearing: 0,
      duration: 1200,
      essential: true
    });
  }, []);

  // Reset sudut kamera 3D kembali ke 2D rata saat navigasi langsung selesai (hanya jika tidak sedang fokus terbang ke kajian)
  React.useEffect(() => {
    if (isMapLoaded && !isNavigating && !selectedSession && mapRef.current) {
      mapRef.current.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 800,
      });
    }
  }, [isMapLoaded, isNavigating, selectedSession]);

  // Terbang ke kajian terpilih saat diklik atau saat peta pertama kali selesai dimuat
  React.useEffect(() => {
    if (isMapLoaded && selectedSession && hasPhysicalLocation(selectedSession)) {
      flyToSession(selectedSession);
    }
  }, [isMapLoaded, selectedSession, flyToSession]);

  // Terbang ke wilayah/kota yang dipilih dari filter
  React.useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;

    if (flyToRegion) {
      mapRef.current.flyTo({
        center: [flyToRegion.center[0], flyToRegion.center[1]],
        zoom: flyToRegion.zoom,
        duration: 1600,
        essential: true
      });
    } else if (prevRegionRef.current && flyToRegion === null && !selectedSession) {
      // Hanya reset ke Indonesia jika sebelumnya ada wilayah yang dipilih lalu dihapus,
      // dan saat ini tidak sedang membuka kartu kajian aktif
      mapRef.current.flyTo({
        center: [118.0, -2.0],
        zoom: 4.5,
        duration: 1400,
        essential: true
      });
    }

    prevRegionRef.current = flyToRegion;
  }, [isMapLoaded, flyToRegion, selectedSession]);

  // Auto fitBounds saat rute in-app aktif (hanya saat tidak dalam mode navigasi 3D)
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

        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
        mapRef.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: isDesktop
              ? { top: 90, bottom: 90, left: 430, right: 90 }
              : { top: 70, bottom: 330, left: 25, right: 25 },
            duration: 1200,
            essential: true,
          }
        );
      }
    }
  }, [isMapLoaded, activeRoute, isNavigating]);

  // Kamera Mengemudi saat Live Navigasi Aktif (mengikuti posisi GPS & arah hadap pengguna)
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
        // North-Up: Kamera tegak 2D, selalu menghadap Utara (bearing 0, pitch 0)
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

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        {...viewState}
        onLoad={handleMapLoad}
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
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={
          isSatelliteMode
            ? `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
            : resolvedTheme === 'dark'
            ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
            : `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
        }
      >
        {!isNavigating && <NavigationControl position="bottom-right" showCompass={false} />}

        {/* LAYER RUTE ALTERNATIF OSRM (JIKA ADA) */}
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
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
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
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
              paint={{
                'line-color': resolvedTheme === 'dark' ? '#94a3b8' : '#cbd5e1',
                'line-width': activeRoute?.mode === 'walking' ? 5 : 4.5,
                'line-opacity': 0.75,
                ...(activeRoute?.mode === 'walking' ? { 'line-dasharray': [0, 1.8] } : {}),
              }}
            />
          </Source>
        ))}

        {/* LAYER RUTE IN-APP UTAMA (GEOJSON LINESTRING) */}
        {routeGeoJson && (
          <Source id="in-app-route-source" type="geojson" data={routeGeoJson}>
            {/* Layer Casing / Outline Gelap Kontras */}
            <Layer
              id="route-casing"
              type="line"
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
              paint={{
                'line-color': resolvedTheme === 'dark' ? '#064e3b' : '#047857',
                'line-width': activeRoute?.mode === 'walking' ? 9 : 8,
                'line-opacity': activeRoute?.mode === 'walking' ? 0.75 : 0.85,
                ...(activeRoute?.mode === 'walking' ? { 'line-dasharray': [0, 1.8] } : {}),
              }}
            />
            {/* Layer Inti Rute (Emerald Solid untuk Kendaraan, Bulat Putus-putus untuk Pejalan Kaki) */}
            <Layer
              id="route-line"
              type="line"
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
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
            style={{ zIndex: 38 }}
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
            className="z-50 font-geist"
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
                Ditandai {new Date(savedParkingSpot.savedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
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
            style={{ zIndex: 45 }}
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
                  // Modal pemilihan kendaraan hanya untuk mode berkendara
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

                {/* Paruh Penunjuk Arah */}
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
              // Saat tidak sedang navigasi aktif, tampilkan Titik Biru standar (Clean Blue Dot)
              <div
                className="relative flex items-center justify-center"
                title="Lokasi Saya"
              >
                <div className="absolute -inset-2.5 rounded-full bg-blue-500/30 animate-ping pointer-events-none" />
                <div className="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-md transition-transform" />
              </div>
            )}
          </Marker>
        )}
        
        {mappableSessions.map(session => {
          const isSelected = selectedSession?.id === session.id;
          const hasDate = !!session.start_datetime;
          const sessionTime = hasDate 
            ? new Date(session.start_datetime!).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : 'Rutin';
          const isAkhwat = session.audience_type === 'akhwat';
          
          return (
            <Marker 
              key={session.id} 
              longitude={getLng(session)} 
              latitude={getLat(session)} 
              anchor="center"
              style={{ zIndex: isSelected ? 35 : 20 }}
              onClick={e => {
                e.originalEvent.stopPropagation();
                onSelectSession(session);
                flyToSession(session);
              }}
            >
              {isSelected ? (
                <div className="relative cursor-pointer group">
                  <div className={`absolute -inset-2 rounded-full animate-ping ${session.is_test ? 'bg-amber-500/30' : 'bg-primary-container/30'}`}></div>
                  <div className={`relative flex items-center gap-1 px-2.5 py-1 rounded-full shadow-md transition-transform group-hover:scale-105 ${
                    session.is_test
                      ? 'bg-amber-600 text-white ring-2 ring-amber-300'
                      : 'bg-primary-container text-on-primary'
                  }`}>
                    <span className="material-symbols-outlined text-[14px]">{session.is_test ? 'science' : 'mosque'}</span>
                    <span className="text-[13px] font-semibold tracking-tight">{session.is_test ? 'TEST' : sessionTime}</span>
                  </div>
                </div>
              ) : (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full shadow transition-all group-hover:scale-105 cursor-pointer
                  ${session.is_test
                    ? 'bg-amber-500 text-white ring-1 ring-amber-300'
                    : isAkhwat 
                      ? 'bg-tertiary-container hover:bg-tertiary text-on-tertiary' 
                      : 'bg-slate-900 dark:bg-slate-800 hover:bg-primary dark:hover:bg-emerald-600 text-white'
                  }
                `}>
                  <span className="material-symbols-outlined text-[12px]">{session.is_test ? 'science' : isAkhwat ? 'female' : 'schedule'}</span>
                  <span className="text-[11px] font-medium">{session.is_test ? 'TEST' : sessionTime}</span>
                </div>
              )}
            </Marker>
          );
        })}

        {selectedSession && selectedHasLocation && (
          <Popup
            anchor="bottom"
            longitude={getLng(selectedSession)}
            latitude={getLat(selectedSession)}
            onClose={() => onSelectSession(null)}
            closeButton={false}
            closeOnClick={false}
            className="z-50"
            offset={12}
            maxWidth="none"
          >
            <VenueCard
              key={selectedSession.id}
              session={selectedSession}
              onClose={() => onSelectSession(null)}
              onStartRoute={onStartRoute}
            />
          </Popup>
        )}
      </Map>

      {/* Floating Studio Overlay untuk Kajian Online tanpa Titik Peta */}
      {selectedSession && !selectedHasLocation && (
        <OnlineStreamingOverlay
          session={selectedSession}
          onClose={() => onSelectSession(null)}
        />
      )}

      {/* Floating Map Navigation Controls (Kompas, Mode Satelit, Switch Dark Mode) */}
      {(isNavigating || activeRoute) && (
        <div
          className={`fixed md:absolute right-3 md:right-6 z-40 flex flex-col gap-2 items-center animate-in fade-in zoom-in-95 duration-200 ${
            isNavigating ? 'top-[164px] md:top-6' : 'top-4 md:top-6'
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
            <span className="material-symbols-outlined text-[20px]">
              satellite_alt
            </span>
          </button>

          {/* 3. Tombol Switch Dark Mode / Light Mode (Hanya di Mobile, karena Desktop sudah ada di sidebar) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="md:hidden w-10 h-10 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md hover:bg-surface-container text-on-surface flex items-center justify-center shadow-xl border border-surface-container-high/80 transition-all active:scale-95 cursor-pointer"
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
