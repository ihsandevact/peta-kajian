'use client';

import React from 'react';
import type { MosqueVenue } from '@/lib/services/venues';
import { estimateTravelTime } from '@/utils/distance';

interface MosqueCardItemProps {
  mosque: MosqueVenue;
  isSelected?: boolean;
  onSelect?: (mosque: MosqueVenue) => void;
  onRoute?: (mosque: MosqueVenue) => void;
  onFlyTo?: (mosque: MosqueVenue) => void;
  onOpenProfile?: (mosque: MosqueVenue) => void;
}

const MosqueCardItem = React.memo(function MosqueCardItem({
  mosque,
  isSelected = false,
  onSelect,
  onRoute,
  onFlyTo,
  onOpenProfile,
}: MosqueCardItemProps) {
  const hasActiveSessions = (mosque.active_sessions_count || 0) > 0;
  const fac = mosque.facilities || {};
  const travelEstimate =
    mosque.distance_km !== undefined ? estimateTravelTime(mosque.distance_km) : null;

  return (
    <div
      data-mosque-id={mosque.id}
      onClick={() => {
        onSelect?.(mosque);
        onFlyTo?.(mosque);
      }}
      className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer [content-visibility:auto] [contain-intrinsic-size:0_132px] ${
        isSelected
          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
          : 'bg-surface hover:bg-surface-container-low border-outline-variant/60 hover:border-emerald-300 dark:hover:border-emerald-700/60 shadow-xs'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Ikon Kubah Masjid */}
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 group-hover:bg-emerald-600 group-hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[22px] sm:text-[24px]">mosque</span>
        </div>

        {/* Konten Utama */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5">
            <h3 className="font-bold text-sm sm:text-base text-on-surface truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {mosque.name}
            </h3>
            {mosque.distance_km !== undefined && (
              <div className="shrink-0 inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                <span>{mosque.distance_km} km</span>
                {travelEstimate && (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold">
                      <span className="material-symbols-outlined text-[12px]">
                        {travelEstimate.mode === 'walk' ? 'directions_walk' : 'directions_car'}
                      </span>
                      <span>{travelEstimate.label}</span>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5 leading-relaxed">
            {mosque.address}
          </p>

          {/* Badges Fasilitas & Status Kajian */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {mosque.is_test && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded-md">
                <span className="material-symbols-outlined text-[11px]">science</span>
                Test Admin
              </span>
            )}
            {hasActiveSessions ? (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-100/80 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {mosque.active_sessions_count} Kajian Aktif
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] text-on-surface-variant/70 bg-surface-container px-1.5 py-0.5 rounded-md">
                Belum ada jadwal kajian
              </span>
            )}

            {fac.parking_car && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-md"
                title="Tersedia Parkir Mobil"
              >
                <span className="material-symbols-outlined text-[12px]">local_parking</span>
                Mobil
              </span>
            )}

            {(fac.kids_friendly || fac.akhwat_area) && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-md"
                title="Ramah Keluarga & Anak"
              >
                <span className="material-symbols-outlined text-[12px]">family_restroom</span>
                Keluarga
              </span>
            )}

            {fac.wheelchair_accessible && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-md"
                title="Akses Ramah Kursi Roda"
              >
                <span className="material-symbols-outlined text-[12px]">accessible</span>
                Ramp
              </span>
            )}

            {fac.air_conditioned && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-md"
                title="Ruangan Ber-AC"
              >
                <span className="material-symbols-outlined text-[12px]">ac_unit</span>
                AC
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tombol Aksi Bawah */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-outline-variant/30">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(mosque);
            onOpenProfile?.(mosque);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-emerald-600 dark:hover:text-emerald-400 py-1 px-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
        >
          <span>Profil &amp; Jadwal</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRoute?.(mosque);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-3 py-1.5 rounded-xl shadow-xs transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">directions</span>
          <span>Rute Maps</span>
        </button>
      </div>
    </div>
  );
});

export default MosqueCardItem;
