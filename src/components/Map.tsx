import * as React from 'react';
import Map, { NavigationControl, Marker, Popup, type MapRef } from 'react-map-gl/maplibre';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type StudySession } from '@/lib/services/kajian';
import VenueCard from './VenueCard';

setWorkerUrl('/lib/maplibre/maplibre-gl-worker.mjs');

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'get_your_own_OpIi9ZULNHzrESv6T2vL';

interface AppMapProps {
  sessions: StudySession[];
  selectedSession: StudySession | null;
  onSelectSession: (s: StudySession | null) => void;
}

export default function AppMap({ sessions, selectedSession, onSelectSession }: AppMapProps) {
  const mapRef = React.useRef<MapRef>(null);
  
  const [viewState, setViewState] = React.useState({
    longitude: 118.0, // Titik Tengah Indonesia
    latitude: -2.0,
    zoom: 4.5
  });

  const getLat = (s: StudySession) => s.venues?.lat || 0;
  const getLng = (s: StudySession) => s.venues?.lng || 0;

  React.useEffect(() => {
    if (selectedSession && mapRef.current) {
      mapRef.current.flyTo({
        center: [getLng(selectedSession), getLat(selectedSession)],
        zoom: 14,
        duration: 1500,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
      });
    }
  }, [selectedSession]);

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={`https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        
        {sessions.map(session => {
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

        {selectedSession && (
          <Popup
            anchor="bottom"
            longitude={getLng(selectedSession)}
            latitude={getLat(selectedSession)}
            onClose={() => onSelectSession(null)}
            closeButton={false}
            closeOnClick={false}
            className="z-50"
            offset={20}
          >
            <div className="-m-3 pb-3">
              <VenueCard key={selectedSession.id} session={selectedSession} onClose={() => onSelectSession(null)} />
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
