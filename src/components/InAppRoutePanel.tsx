'use client';

import React from 'react';
import { Drawer } from 'vaul';
import type { StudySession } from '@/lib/services/kajian';
import {
  type RouteResult,
  formatDurationText,
  formatDistanceText,
  calculateEtaComparison,
} from '@/lib/services/routing';

interface InAppRoutePanelProps {
  session: StudySession;
  routeResult: RouteResult | null;
  isLoading: boolean;
  mode: 'driving' | 'walking';
  onModeChange: (mode: 'driving' | 'walking') => void;
  onSelectAlternativeRoute?: (route: RouteResult) => void;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
  errorMessage?: string | null;
  onStartLiveNavigation?: () => void;
  isDesktop?: boolean;
}

export default function InAppRoutePanel({
  session,
  routeResult,
  isLoading,
  mode,
  onModeChange,
  onSelectAlternativeRoute,
  onClose,
  errorMessage,
  onStartLiveNavigation,
  isDesktop = false,
}: InAppRoutePanelProps) {
  const [showSteps, setShowSteps] = React.useState<boolean>(false);

  const steps = routeResult?.steps || [];
  const venue = session.venues;
  const destinationLat = venue?.lat;
  const destinationLng = venue?.lng;

  const googleMapsUrl =
    destinationLat && destinationLng
      ? `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`
      : null;

  const allRouteOptions = React.useMemo(() => {
    if (!routeResult) return [];
    if (routeResult.allRoutes && routeResult.allRoutes.length > 0) {
      return routeResult.allRoutes;
    }
    const list = [routeResult];
    if (routeResult.alternatives && routeResult.alternatives.length > 0) {
      list.push(...routeResult.alternatives);
    }
    return list;
  }, [routeResult]);

  const defaultSnapPoint = React.useMemo(() => {
    // Jika ada 2 rute atau lebih, gunakan 520px agar tombol Mulai Navigasi terlihat utuh sempurna
    if (allRouteOptions.length > 1) {
      return '520px';
    }
    // Jika hanya 1 rute (tanpa kartu pilihan jalur), 440px sudah sangat cukup
    return '440px';
  }, [allRouteOptions.length]);

  const [snapPoint, setSnapPoint] = React.useState<number | string | null>(defaultSnapPoint);

  React.useEffect(() => {
    setSnapPoint(defaultSnapPoint);
  }, [defaultSnapPoint]);

  const etaInfo = React.useMemo(() => {
    if (!routeResult) return null;
    return calculateEtaComparison(routeResult.durationMinutes, session.start_datetime);
  }, [routeResult, session.start_datetime]);

  // Handler buka/tutup rincian belokan dengan auto-adjust snap point drawer
  const handleToggleSteps = React.useCallback(() => {
    setShowSteps((prev) => {
      const nextState = !prev;
      // Di mobile: jika dibuka, otomatis naikkan drawer ke snap point 1 (penuh tanpa pergeseran); jika ditutup, kembali ke defaultSnapPoint
      if (!isDesktop) {
        if (nextState) {
          setSnapPoint(1);
        } else {
          setSnapPoint(defaultSnapPoint);
        }
      }
      return nextState;
    });
  }, [isDesktop, defaultSnapPoint]);

  // 1. Header Info (Nama Masjid, Alamat, Tombol Tutup)
  const renderHeader = () => (
    <div className="flex items-start justify-between gap-2">
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
  );

  // 2. Middle Body: Durasi, Moda, Komparasi ETA, Pilihan Jalur, & Petunjuk Belokan
  const renderBody = () => (
    <div className="space-y-2.5">
      {/* Konten Rute & Durasi */}
      <div>
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
      </div>

      {/* Komparasi Estimasi Jam Tiba vs Jadwal Kajian */}
      {routeResult && etaInfo && (
        <div
          className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-semibold ${etaInfo.badgeClass}`}
        >
          <span className="material-symbols-outlined text-[18px] shrink-0">
            {etaInfo.status === 'early'
              ? 'task_alt'
              : etaInfo.status === 'late'
              ? 'warning'
              : 'schedule'}
          </span>
          <div className="flex-1 min-w-0 leading-snug">
            <span className="font-bold">Tiba ~{etaInfo.etaTimeFormatted} WIB</span>
            <span className="mx-1 opacity-60">•</span>
            <span className="text-[11px] font-medium">{etaInfo.message}</span>
          </div>
        </div>
      )}

      {/* Pilihan Rute Alternatif OSRM */}
      {routeResult && allRouteOptions.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">alt_route</span>
            <span>Pilihan Jalur Rute ({allRouteOptions.length})</span>
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {allRouteOptions.map((rt, idx) => {
              const isSelected =
                (rt.routeIndex !== undefined && rt.routeIndex === routeResult.routeIndex) ||
                rt.geometry === routeResult.geometry;
              const baseRoute = allRouteOptions[0];
              const timeDiff = rt.durationMinutes - baseRoute.durationMinutes;
              const diffLabel =
                idx === 0
                  ? 'Utama'
                  : timeDiff > 0
                  ? `+${timeDiff} mnt`
                  : timeDiff < 0
                  ? `${timeDiff} mnt`
                  : 'Sama';

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectAlternativeRoute?.(rt)}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-2xs ring-1 ring-emerald-500'
                      : 'bg-surface-container/60 hover:bg-surface-container border-surface-container-high/60 text-on-surface'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span
                      className={
                        isSelected
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-on-surface'
                      }
                    >
                      Jalur {idx + 1}
                    </span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded font-semibold ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-surface-container-high text-outline'
                      }`}
                    >
                      {diffLabel}
                    </span>
                  </div>
                  <div className="text-[11px] font-extrabold text-on-surface mt-0.5">
                    {formatDurationText(rt.durationMinutes)}
                    <span className="text-[10px] font-normal text-outline ml-1">
                      ({formatDistanceText(rt.distanceMeters)})
                    </span>
                  </div>
                  {rt.summary && (
                    <p className="text-[9px] text-outline truncate mt-0.5" title={rt.summary}>
                      {rt.summary}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Accordion Rincian Belokan */}
      {routeResult && steps.length > 0 && (
        <div>
          <button
            type="button"
            onClick={handleToggleSteps}
            className="w-full py-1.5 px-2.5 rounded-xl bg-surface-container/60 hover:bg-surface-container flex items-center justify-between text-xs font-semibold text-on-surface-variant transition-colors cursor-pointer"
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
            <div className="mt-2 space-y-1.5 pr-1 border-t border-surface-container-high/40 pt-2 animate-in fade-in duration-200">
              {steps.map((st) => (
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
        </div>
      )}
    </div>
  );

  // 3. Action Buttons: Tombol Mulai Navigasi, Google Maps, & Kembali
  const renderFooter = () => (
    <div className="flex flex-col gap-2">
      {onStartLiveNavigation && routeResult && (
        <button
          type="button"
          onClick={onStartLiveNavigation}
          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
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
  );

  // Konten utuh berurutan secara natural
  const renderAllSections = () => (
    <div className="flex flex-col gap-2.5">
      <div className="pb-2.5 border-b border-surface-container-high/60">
        {renderHeader()}
      </div>
      <div>
        {renderBody()}
      </div>
      <div className="pt-2.5 border-t border-surface-container-high/60">
        {renderFooter()}
      </div>
    </div>
  );

  return (
    <>
      {/* ======================================================== */}
      {/* 1. TAMPILAN DESKTOP (Layar md ke atas): Floating Card   */}
      {/* ======================================================== */}
      <div className="hidden md:flex flex-col absolute bottom-6 left-6 w-[380px] max-h-[calc(100vh-120px)] z-30 bg-surface-container-lowest/95 backdrop-blur-md border border-surface-container-high/80 rounded-2xl shadow-xl p-3.5 sm:p-4 font-geist transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 overflow-y-auto">
        {renderAllSections()}
      </div>

      {/* ====================================================================== */}
      {/* 2. TAMPILAN MOBILE (Layar HP): Vaul Bottom Sheet dengan Sticky Header   */}
      {/* ====================================================================== */}
      {!isDesktop && (
        <Drawer.Root
          snapPoints={['140px', defaultSnapPoint, 1]}
          activeSnapPoint={snapPoint}
          setActiveSnapPoint={setSnapPoint}
          modal={false}
          dismissible={false}
          open={true}
        >
          <Drawer.Portal>
            <Drawer.Content className="md:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col h-[90dvh] max-h-[90dvh] bg-surface-container-lowest/98 backdrop-blur-md rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.15)] border-t border-surface-container-high/80 focus:outline-none font-geist">
              <Drawer.Title className="sr-only">Petunjuk Arah Rute In-App</Drawer.Title>
              <Drawer.Description className="sr-only">
                Rincian rute, pilihan jalur alternatif, dan navigasi langsung ke lokasi kajian
              </Drawer.Description>

              {/* Drag Handle Indicator */}
              <div
                className="w-full flex justify-center pt-3 pb-1.5 shrink-0 cursor-pointer hover:bg-surface-container-low transition-colors touch-none"
                onClick={() => setSnapPoint((prev) => (prev === '140px' ? defaultSnapPoint : '140px'))}
              >
                <Drawer.Handle className="w-12 h-1.5 rounded-full bg-outline/60 hover:bg-outline/80 transition-colors" />
              </div>

              {/* Sticky Header: Tetap berada di atas sampai garis pembatas */}
              <div className="shrink-0 px-4 pb-2.5 border-b border-surface-container-high/60 bg-surface-container-lowest/98">
                {renderHeader()}
              </div>

              {/* Konten Scroll: Body & Footer Tombol Aksi mengalir leluasa di bawah garis */}
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-[calc(56px+env(safe-area-inset-bottom,24px))] min-h-0 overscroll-contain">
                <div className="flex flex-col gap-3">
                  {renderBody()}
                  <div className="pt-2.5 border-t border-surface-container-high/60">
                    {renderFooter()}
                  </div>
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </>
  );
}
