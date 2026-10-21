'use client';

import React from 'react';
import type { MosqueVenue } from '@/lib/services/venues';
import { estimateTravelTime } from '@/utils/distance';

interface MosquePopupCardProps {
  mosque: MosqueVenue;
  onClose?: () => void;
  onStartRoute?: (mosque: MosqueVenue) => void;
  onOpenProfile?: (mosque: MosqueVenue) => void;
}

export default function MosquePopupCard({
  mosque,
  onClose,
  onStartRoute,
  onOpenProfile,
}: MosquePopupCardProps) {
  const fac = mosque.facilities || {};
  const activeCount = mosque.active_sessions_count || 0;
  const nextSession = mosque.upcoming_sessions?.[0] || null;
  const travelEstimate =
    typeof mosque.distance_km === 'number' ? estimateTravelTime(mosque.distance_km) : null;

  const googleMapsUrl =
    typeof mosque.lat === 'number' && typeof mosque.lng === 'number'
      ? `https://www.google.com/maps/dir/?api=1&destination=${mosque.lat},${mosque.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${mosque.name} ${mosque.address}`
        )}`;

  const hasFacilities =
    fac.parking_car || fac.kids_friendly || fac.wheelchair_accessible || fac.air_conditioned;

  return (
    <div
      className="relative font-geist pointer-events-auto filter drop-shadow-xl w-[295px] sm:w-[320px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-surface-container-lowest/98 backdrop-blur-md text-on-surface rounded-2xl border border-outline-variant/50 overflow-hidden shadow-2xl">
        {/* Top Accent & Header Badges */}
        <div className="px-3.5 pt-3 pb-2 flex items-start justify-between gap-2 border-b border-outline-variant/30 bg-emerald-600/5">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[12px]">location_on</span>
              <span className="truncate max-w-[120px]">{mosque.city || 'Indonesia'}</span>
            </span>

            {mosque.is_test && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[11px]">science</span>
                <span>Test Admin</span>
              </span>
            )}

            {typeof mosque.distance_km === 'number' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[12px]">near_me</span>
                <span>{mosque.distance_km} km</span>
                {travelEstimate && (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300">
                      <span className="material-symbols-outlined text-[12px]">
                        {travelEstimate.mode === 'walk' ? 'directions_walk' : 'directions_car'}
                      </span>
                      <span>{travelEstimate.label}</span>
                    </span>
                  </>
                )}
              </span>
            )}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-6 h-6 rounded-full bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="Tutup kartu info"
              aria-label="Tutup kartu info"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-3.5 space-y-2.5">
          {/* Nama & Alamat Masjid */}
          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenProfile?.(mosque);
              }}
              className="text-left font-extrabold text-sm text-on-surface hover:text-emerald-600 transition-colors line-clamp-2 leading-snug cursor-pointer"
            >
              {mosque.name}
            </button>
            <p className="text-[11px] text-on-surface-variant line-clamp-2 mt-1 leading-relaxed">
              {mosque.address || 'Alamat belum dilengkapi'}
            </p>
          </div>

          {/* Status Kajian Aktif */}
          {activeCount > 0 ? (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{activeCount} Kajian Aktif</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfile?.(mosque);
                  }}
                  className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  Lihat Semua →
                </button>
              </div>
              {nextSession && (
                <div className="text-[11px] text-on-surface pt-0.5 border-t border-emerald-500/15">
                  <p className="font-bold truncate">{nextSession.title}</p>
                  {nextSession.speaker_name && (
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {nextSession.speaker_name}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center gap-1.5 text-[11px] text-outline">
              <span className="material-symbols-outlined text-[14px]">event_busy</span>
              <span>Belum ada jadwal kajian aktif</span>
            </div>
          )}

          {/* Fasilitas (Jika Ada) */}
          {hasFacilities && (
            <div className="flex flex-wrap gap-1">
              {fac.parking_car && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-medium">
                  🅿️ Parkir Mobil
                </span>
              )}
              {fac.kids_friendly && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-medium">
                  🍼 Ramah Anak
                </span>
              )}
              {fac.wheelchair_accessible && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-medium">
                  ♿ Akses Kursi Roda
                </span>
              )}
              {fac.air_conditioned && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-medium">
                  ❄️ Full AC
                </span>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-1 flex items-center gap-1.5">
            {onStartRoute && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRoute(mosque);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">directions</span>
                <span>Rute Maps</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenProfile?.(mosque);
              }}
              className="py-2 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold border border-outline-variant/50 flex items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">mosque</span>
              <span>Profil</span>
            </button>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka di Google Maps"
              className="w-8 h-8 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant/50 flex items-center justify-center transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Caret Pointer */}
      <div className="w-full flex justify-center -mt-1.5 pointer-events-none">
        <div className="w-3.5 h-3.5 bg-surface-container-lowest rotate-45 border-r border-b border-outline-variant/50 shadow-xs" />
      </div>
    </div>
  );
}
