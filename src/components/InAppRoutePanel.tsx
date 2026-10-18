'use client';

import React from 'react';
import type { StudySession } from '@/lib/services/kajian';
import { type RouteResult, formatDurationText, formatDistanceText } from '@/lib/services/routing';

interface InAppRoutePanelProps {
  session: StudySession;
  routeResult: RouteResult | null;
  isLoading: boolean;
  mode: 'driving' | 'walking';
  onModeChange: (mode: 'driving' | 'walking') => void;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
  errorMessage?: string | null;
  onStartLiveNavigation?: () => void;
}

export default function InAppRoutePanel({
  session,
  routeResult,
  isLoading,
  mode,
  onModeChange,
  onClose,
  userLocation,
  errorMessage,
  onStartLiveNavigation,
}: InAppRoutePanelProps) {
  const [showSteps, setShowSteps] = React.useState<boolean>(false);
  const steps = routeResult?.steps || [];
  const venue = session.venues;
  const destinationLat = venue?.lat;
  const destinationLng = venue?.lng;

  const googleMapsUrl = destinationLat && destinationLng
    ? `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`
    : null;

  return (
    <div className="fixed md:absolute bottom-20 md:bottom-6 left-3 right-3 md:left-6 md:right-auto md:w-[380px] z-30 bg-surface-container-lowest/95 backdrop-blur-md border border-surface-container-high/80 rounded-2xl shadow-xl p-3.5 sm:p-4 font-geist transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      {/* Header Info */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-surface-container-high/60">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary mb-0.5">
            <span className="material-symbols-outlined text-[15px]">directions</span>
            <span>Petunjuk Arah Rute In-App</span>
          </div>
          <h4 className="font-bold text-xs sm:text-sm text-on-surface truncate" title={venue?.name || session.title}>
            {venue?.name || session.title}
          </h4>
          {venue?.address && (
            <p className="text-[10px] sm:text-[11px] text-outline truncate" title={venue.address}>
              {venue.address}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Tutup Petunjuk Rute"
          aria-label="Tutup Rute"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>

      {/* Konten Rute & Durasi */}
      <div className="py-2.5">
        {isLoading ? (
          <div className="flex items-center gap-3 py-1.5">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-xs text-on-surface-variant font-medium animate-pulse">
              Menghitung rute tercepat...
            </p>
          </div>
        ) : routeResult ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">
                  {formatDurationText(routeResult.durationMinutes)}
                </span>
                <span className="text-xs font-semibold text-outline">
                  ({formatDistanceText(routeResult.distanceMeters)})
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-on-surface-variant mt-1">
                Jalur tercepat via jalan raya
              </p>
            </div>

            {/* Selector Moda Transportasi */}
            <div className="inline-flex items-center p-1 rounded-xl bg-surface-container border border-surface-container-high shrink-0">
              <button
                type="button"
                onClick={() => onModeChange('driving')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  mode === 'driving'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-outline hover:text-on-surface'
                }`}
                title="Moda Berkendara (Mobil / Motor)"
              >
                <span className="material-symbols-outlined text-[16px]">directions_car</span>
              </button>
              <button
                type="button"
                onClick={() => onModeChange('walking')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  mode === 'walking'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-outline hover:text-on-surface'
                }`}
                title="Moda Jalan Kaki"
              >
                <span className="material-symbols-outlined text-[16px]">directions_walk</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 py-1">
            <span className="material-symbols-outlined text-[16px] shrink-0">warning</span>
            <span>{errorMessage || 'Tidak dapat memuat rute darat dari lokasi saat ini.'}</span>
          </div>
        )}

        {/* Accordion Rincian Belokan */}
        {routeResult && steps.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowSteps(!showSteps)}
              className="w-full mt-2 py-1.5 px-2.5 rounded-xl bg-surface-container/60 hover:bg-surface-container flex items-center justify-between text-xs font-semibold text-on-surface-variant transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">alt_route</span>
                <span>Petunjuk Belokan ({steps.length} langkah)</span>
              </span>
              <span className="material-symbols-outlined text-[16px] text-outline">
                {showSteps ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {showSteps && (
              <div className="mt-2 max-h-44 overflow-y-auto space-y-1.5 pr-1 no-scrollbar border-t border-surface-container-high/40 pt-2 animate-in fade-in duration-200">
                {steps.map((st, i) => (
                  <div key={st.id} className="flex items-start gap-2 text-xs py-0.5">
                    <span className="w-5 h-5 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-on-surface-variant mt-0.5">
                      <span className="material-symbols-outlined text-[12px]">{st.iconName}</span>
                    </span>
                    <div className="flex-1 min-w-0 leading-tight">
                      <p className="font-medium text-on-surface line-clamp-1">{st.instruction}</p>
                      <span className="text-[10px] text-outline">{formatDistanceText(st.distanceMeters)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-surface-container-high/60 flex flex-col gap-2">
        {onStartLiveNavigation && routeResult && (
          <button
            type="button"
            onClick={onStartLiveNavigation}
            className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Mulai Panduan Navigasi Langsung di Peta"
          >
            <span className="material-symbols-outlined text-[16px]">navigation</span>
            <span>Mulai Navigasi Langsung</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-high text-on-surface text-[11px] font-semibold transition-all active:scale-95 shadow-2xs cursor-pointer"
              title="Buka Navigasi Suara GPS di Google Maps"
            >
              <span className="material-symbols-outlined text-[14px] text-primary">open_in_new</span>
              <span>Google Maps</span>
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
            title="Tutup Rute & Kembali ke Detail Kajian"
          >
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            <span>Kembali</span>
          </button>
        </div>
      </div>
    </div>
  );
}
