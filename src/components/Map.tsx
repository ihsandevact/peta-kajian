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
}: AppMapProps) {
  const mapRef = React.useRef<MapRef>(null);
  const { resolvedTheme } = useTheme();
  const [isMapLoaded, setIsMapLoaded] = React.useState(false);
  const [isFollowingUser, setIsFollowingUser] = React.useState(true);
  const prevRegionRef = React.useRef<SelectedRegion | null | undefined>(undefined);
  
  const [viewState, setViewState] = React.useState({
    longitude: 118.0, // Titik Tengah Indonesia
    latitude: -2.0,
    zoom: 4.5
  });

  const handleMapLoad = React.useCallback(() => {
    setIsMapLoaded(true);
    mapRef.current?.resize();
  }, []);

  // Reset mode mengikuti pengguna saat navigasi dimulai
  React.useEffect(() => {
    if (isNavigating) {
      setIsFollowingUser(true);
    }
  }, [isNavigating]);

  // Fungsi untuk memusatkan kamera kembali ke posisi GPS dan arah kemudi
  const handleRecenter = React.useCallback(() => {
    if (!userLocation || !mapRef.current) return;
    setIsFollowingUser(true);
    const heading = typeof userHeading === 'number' && !isNaN(userHeading) ? userHeading : 0;
    mapRef.current.easeTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 17.5,
      pitch: 50,
      bearing: heading,
      duration: 800,
      essential: true,
    });
  }, [userLocation, userHeading]);

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
              : { top: 70, bottom: 250, left: 35, right: 35 },
            duration: 1200,
            essential: true,
          }
        );
      }
    }
  }, [isMapLoaded, activeRoute, isNavigating]);

  // Kamera Mengemudi 3D saat Live Navigasi Aktif (hanya saat mode mengikuti pengguna aktif)
  React.useEffect(() => {
    if (isMapLoaded && isNavigating && isFollowingUser && userLocation && mapRef.current) {
      const heading = typeof userHeading === 'number' && !isNaN(userHeading) ? userHeading : 0;
      mapRef.current.easeTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 17.5,
        pitch: 50,
        bearing: heading,
        duration: 800,
        essential: true,
      });
    }
  }, [isMapLoaded, isNavigating, isFollowingUser, userLocation, userHeading]);

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
          resolvedTheme === 'dark'
            ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
            : `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
        }
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* LAYER RUTE IN-APP (GEOJSON LINESTRING) */}
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
                'line-width': 8,
                'line-opacity': 0.85,
              }}
            />
            {/* Layer Inti Rute Jalan Raya (Warna Emerald Cerah) */}
            <Layer
              id="route-line"
              type="line"
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
              paint={{
                'line-color': '#10b981',
                'line-width': 5,
                'line-opacity': 0.95,
              }}
            />
          </Source>
        )}

        {/* MARKER LOKASI PENGGUNA (TITIK BIRU ATAU PANAH NAVIGASI) */}
        {userLocation && (
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="center"
            style={{ zIndex: 45 }}
          >
            {isNavigating ? (
              <div
                className="relative flex items-center justify-center transition-transform duration-300"
                style={{
                  transform: typeof userHeading === 'number' && !isNaN(userHeading) ? `rotate(${userHeading}deg)` : undefined,
                }}
              >
                <div className="absolute -inset-3 rounded-full bg-blue-500/25 animate-ping pointer-events-none" />
                <div className="w-9 h-9 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-xl flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[20px]">navigation</span>
                </div>
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                <div className="absolute -inset-2.5 rounded-full bg-blue-500/30 animate-ping pointer-events-none" />
                <div className="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-md" />
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
    </div>
  );
}
