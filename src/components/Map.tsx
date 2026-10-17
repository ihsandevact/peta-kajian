import * as React from 'react';
import Map, { NavigationControl, Marker, Popup, type MapRef } from 'react-map-gl/maplibre';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type StudySession, hasPhysicalLocation } from '@/lib/services/kajian';
import type { SelectedRegion } from '@/utils/regions';
import VenueCard from './VenueCard';
import OnlineStreamingOverlay from './OnlineStreamingOverlay';

setWorkerUrl('/lib/maplibre/maplibre-gl-worker.mjs');

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'get_your_own_OpIi9ZULNHzrESv6T2vL';

interface AppMapProps {
  sessions: StudySession[];
  selectedSession: StudySession | null;
  onSelectSession: (s: StudySession | null) => void;
  flyToRegion?: SelectedRegion | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export default function AppMap({
  sessions,
  selectedSession,
  onSelectSession,
  flyToRegion,
  isRefreshing = false,
  onRefresh,
}: AppMapProps) {
  const mapRef = React.useRef<MapRef>(null);
  
  const [viewState, setViewState] = React.useState({
    longitude: 118.0, // Titik Tengah Indonesia
    latitude: -2.0,
    zoom: 4.5
  });

  const getLat = (s: StudySession) => s.venues?.lat || 0;
  const getLng = (s: StudySession) => s.venues?.lng || 0;

  // Kajian online murni tidak punya titik di peta
  const mappableSessions = React.useMemo(() => sessions.filter(hasPhysicalLocation), [sessions]);
  const selectedHasLocation = !!selectedSession && hasPhysicalLocation(selectedSession);

  // Fungsi helper untuk terbang ke kajian dengan offset adaptif
  const flyToSession = React.useCallback((session: StudySession) => {
    if (!hasPhysicalLocation(session) || !mapRef.current) return;
    let offsetY = 160;
    if (typeof window !== 'undefined') {
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop) {
        // Desktop: offset Y positif (140px - 190px) agar card kompak pas di tengah
        offsetY = Math.min(190, Math.max(140, Math.round(window.innerHeight * 0.22)));
      } else {
        // Mobile: offset Y positif (80px - 115px) agar card & poster di atas marker
        // tidak terpotong di tepi atas layar dan pas di ruang terbuka atas bottom sheet
        offsetY = Math.min(115, Math.max(80, Math.round(window.innerHeight * 0.11)));
      }
    }

    mapRef.current.flyTo({
      center: [getLng(session), getLat(session)],
      offset: [0, offsetY],
      zoom: 14,
      duration: 1200,
      essential: true
    });
  }, []);

  // Terbang ke kajian terpilih saat diklik
  React.useEffect(() => {
    if (selectedSession && hasPhysicalLocation(selectedSession)) {
      flyToSession(selectedSession);
    }
  }, [selectedSession, flyToSession]);

  // Terbang ke wilayah/kota yang dipilih dari filter
  React.useEffect(() => {
    if (flyToRegion && mapRef.current) {
      mapRef.current.flyTo({
        center: [flyToRegion.center[0], flyToRegion.center[1]],
        zoom: flyToRegion.zoom,
        duration: 1600,
        essential: true
      });
    } else if (flyToRegion === null && mapRef.current) {
      mapRef.current.flyTo({
        center: [118.0, -2.0],
        zoom: 4.5,
        duration: 1400,
        essential: true
      });
    }
  }, [flyToRegion]);

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={`https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Floating Refresh Control tepat di atas NavigationControl */}
        {onRefresh && (
          <div className="absolute right-[10px] bottom-[78px] z-20 hidden md:block">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="w-[29px] h-[29px] bg-white dark:bg-neutral-800 rounded shadow-md border border-black/10 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all flex items-center justify-center text-gray-700 dark:text-gray-200 cursor-pointer disabled:opacity-50 active:scale-95"
              title="Segarkan peta kajian"
            >
              <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`}>
                refresh
              </span>
            </button>
          </div>
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
                  <div className="absolute -inset-2 rounded-full bg-primary-container/30 animate-ping"></div>
                  <div className="relative flex items-center gap-1 bg-primary-container text-on-primary px-2.5 py-1 rounded-full shadow-md transition-transform group-hover:scale-105">
                    <span className="material-symbols-outlined text-[14px]">mosque</span>
                    <span className="text-[13px] font-semibold tracking-tight">{sessionTime}</span>
                  </div>
                </div>
              ) : (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full shadow transition-all group-hover:scale-105 cursor-pointer
                  ${isAkhwat 
                    ? 'bg-tertiary-container hover:bg-tertiary text-on-tertiary' 
                    : 'bg-on-surface hover:bg-primary text-on-primary'
                  }
                `}>
                  <span className="material-symbols-outlined text-[12px]">{isAkhwat ? 'female' : 'schedule'}</span>
                  <span className="text-[11px] font-medium">{sessionTime}</span>
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
            offset={20}
            maxWidth="none"
          >
            <VenueCard key={selectedSession.id} session={selectedSession} onClose={() => onSelectSession(null)} />
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
    </div>
  );
}
