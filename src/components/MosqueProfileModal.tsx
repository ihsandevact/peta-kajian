'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Drawer } from 'vaul';
import type { MosqueVenue } from '@/lib/services/venues';
import type { StudySession } from '@/lib/services/kajian';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { useAttendance } from '@/utils/attendance';

interface MosqueProfileModalProps {
  isOpen: boolean;
  mosque: MosqueVenue | null;
  onClose: () => void;
  onStartRoute?: (mosque: MosqueVenue) => void;
}

export default function MosqueProfileModal({
  isOpen,
  mosque,
  onClose,
  onStartRoute,
}: MosqueProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'jadwal' | 'fasilitas'>('jadwal');
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const { isAttending, toggle: toggleAttendance } = useAttendance();

  // Deteksi ukuran layar (Desktop >= 640px vs Mobile < 640px untuk Vaul Bottom Sheet)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Reset tab ke 'jadwal' setiap kali membuka masjid yang berbeda
  useEffect(() => {
    if (mosque?.id) {
      setActiveTab('jadwal');
    }
  }, [mosque?.id]);

  // Tutup dengan tombol Escape di Desktop
  useEffect(() => {
    if (!isOpen || !isDesktop) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDesktop, onClose]);

  const sessions: StudySession[] = useMemo(() => {
    return mosque?.upcoming_sessions || [];
  }, [mosque]);

  const { upcomingSessions, recurringSessions } = useMemo(() => {
    const upcoming: StudySession[] = [];
    const recurring: StudySession[] = [];
    const now = new Date();

    for (const s of sessions) {
      if (s.is_recurring) {
        recurring.push(s);
      } else {
        const info = getEffectiveSessionInfo(s, now);
        if (!info.isPast) {
          upcoming.push(s);
        }
      }
    }
    return { upcomingSessions: upcoming, recurringSessions: recurring };
  }, [sessions]);

  if (!isOpen || !mosque) return null;

  const fac = mosque.facilities || {};
  const gmapsUrl =
    typeof mosque.lat === 'number' && typeof mosque.lng === 'number'
      ? `https://www.google.com/maps/dir/?api=1&destination=${mosque.lat},${mosque.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${mosque.name} ${mosque.address}`
        )}`;
  const wazeUrl = `https://waze.com/ul?ll=${mosque.lat},${mosque.lng}&navigate=yes`;

  const renderHeroHeader = () => (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Ikon Masjid */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-xs border border-emerald-500/20">
            <span className="material-symbols-outlined text-[28px] sm:text-[32px]">mosque</span>
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/50 px-2.5 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[13px]">location_on</span>
                <span>{mosque.city || 'Indonesia'}</span>
              </span>

              {typeof mosque.distance_km === 'number' && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                  <span className="material-symbols-outlined text-[13px]">near_me</span>
                  <span>{mosque.distance_km} km</span>
                </span>
              )}

              {mosque.is_verified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                  <span className="material-symbols-outlined text-[13px]">verified</span>
                  <span>Terverifikasi</span>
                </span>
              )}

              {mosque.is_test && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full">
                  <span className="material-symbols-outlined text-[13px]">science</span>
                  <span>Test Admin</span>
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-xl font-extrabold text-on-surface tracking-tight leading-snug">
              {mosque.name}
            </h2>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              {mosque.address || 'Alamat belum dilengkapi'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors shrink-0 cursor-pointer"
          title="Tutup Profil Masjid"
          aria-label="Tutup Profil Masjid"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Tombol Aksi Navigasi */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {onStartRoute && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onStartRoute(mosque);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">directions</span>
            <span>Rute Maps</span>
          </button>
        )}

        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface bg-surface-container hover:bg-surface-container-high px-3 py-2 rounded-xl border border-outline-variant/60 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">map</span>
          <span>Google Maps</span>
        </a>

        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface bg-surface-container hover:bg-surface-container-high px-3 py-2 rounded-xl border border-outline-variant/60 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">near_me</span>
          <span>Waze</span>
        </a>

        {mosque.contact_wa && (
          <a
            href={`https://wa.me/${mosque.contact_wa.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 px-3 py-2 rounded-xl border border-emerald-500/30 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">chat</span>
            <span>DKM WhatsApp</span>
          </a>
        )}
      </div>
    </div>
  );

  const renderTabsBar = () => (
    <div className="flex gap-4 border-b border-outline-variant/40 px-4 sm:px-6 bg-surface-container-lowest shrink-0">
      <button
        type="button"
        onClick={() => setActiveTab('jadwal')}
        className={`py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
          activeTab === 'jadwal'
            ? 'border-emerald-600 text-emerald-600'
            : 'border-transparent text-on-surface-variant hover:text-on-surface'
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">calendar_month</span>
        <span>Jadwal Kajian ({sessions.length})</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('fasilitas')}
        className={`py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
          activeTab === 'fasilitas'
            ? 'border-emerald-600 text-emerald-600'
            : 'border-transparent text-on-surface-variant hover:text-on-surface'
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">info</span>
        <span>Fasilitas Masjid</span>
      </button>
    </div>
  );

  const renderBody = () => (
    <div className="space-y-5">
      {activeTab === 'jadwal' && (
        <div className="space-y-5">
          {/* Kajian Mendatang / Tematik */}
          <div className="space-y-2.5">
            <h3 className="text-xs sm:text-sm font-extrabold text-on-surface flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Kajian Mendatang</span>
            </h3>

            {upcomingSessions.length === 0 ? (
              <div className="p-5 rounded-2xl border border-outline-variant/40 bg-surface text-center text-on-surface-variant text-xs space-y-1">
                <p className="font-semibold">Belum ada jadwal kajian tematik mendatang di masjid ini.</p>
                <p className="text-[11px] text-on-surface-variant/70">
                  Punya info kajian di masjid ini? Silakan ajukan melalui menu Kontributor di Beranda.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingSessions.map((session) => {
                  const info = getEffectiveSessionInfo(session, new Date());
                  const booked = isBookmarked(session.id);
                  const attend = isAttending(session.id);
                  const timeStr = info.effectiveDate
                    ? info.effectiveDate.toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }) + ' WIB'
                    : '';

                  return (
                    <div
                      key={session.id}
                      className="p-3.5 sm:p-4 rounded-2xl border border-outline-variant/50 bg-surface hover:border-emerald-400 transition-colors space-y-2.5"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 px-2.5 py-0.5 rounded-full">
                            {info.dateLabel} {timeStr ? `• ${timeStr}` : ''}
                          </span>
                          {session.is_test && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-[11px]">science</span>
                              <span>Test Admin</span>
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-on-surface mt-1.5 leading-snug">
                          {session.title}
                        </h4>
                        <p className="text-xs font-semibold text-on-surface-variant mt-0.5">
                          Pemateri: {session.speaker_name}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/20">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleAttendance(session.id)}
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                              attend
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-surface text-on-surface-variant border-outline-variant/60 hover:bg-surface-container'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px]">how_to_reg</span>
                            <span>{attend ? 'Hadir' : 'Saya Hadir'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleBookmark(session.id)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              booked
                                ? 'bg-amber-100 text-amber-700 border-amber-400 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-surface text-on-surface-variant border-outline-variant/60 hover:bg-surface-container'
                            }`}
                            title={booked ? 'Hapus Simpanan' : 'Simpan Kajian'}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {booked ? 'bookmark_added' : 'bookmark'}
                            </span>
                          </button>
                        </div>

                        <Link
                          href="/"
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
                        >
                          <span>Lihat di Peta Kajian</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kajian Rutin Pekanan */}
          {recurringSessions.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-outline-variant/40">
              <h3 className="text-xs sm:text-sm font-extrabold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                  event_repeat
                </span>
                <span>Agenda Kajian Rutin Pekanan</span>
              </h3>

              <div className="space-y-2.5">
                {recurringSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3.5 rounded-2xl border border-outline-variant/50 bg-surface space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-block text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-md">
                        {session.recurring_pattern || 'Kajian Rutin'}
                      </span>
                      {session.is_test && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-md">
                          <span className="material-symbols-outlined text-[11px]">science</span>
                          <span>Test Admin</span>
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-on-surface">{session.title}</h4>
                    <p className="text-xs text-on-surface-variant">
                      Pemateri: {session.speaker_name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'fasilitas' && (
        <div className="space-y-3">
          <h3 className="text-xs sm:text-sm font-extrabold text-on-surface">
            Kelengkapan &amp; Fasilitas Masjid
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px] text-emerald-600">
                local_parking
              </span>
              <div>
                <h4 className="text-xs font-bold text-on-surface">Parkir Kendaraan</h4>
                <p className="text-[11px] text-on-surface-variant">
                  {fac.parking_car
                    ? 'Tersedia area parkir mobil dan motor.'
                    : 'Area parkir terbatas / standar.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px] text-emerald-600">
                family_restroom
              </span>
              <div>
                <h4 className="text-xs font-bold text-on-surface">Keluarga &amp; Laktasi</h4>
                <p className="text-[11px] text-on-surface-variant">
                  {fac.kids_friendly
                    ? 'Ramah anak, tersedia ruang menyusui/laktasi.'
                    : 'Kapasitas keluarga standar.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px] text-emerald-600">
                accessible
              </span>
              <div>
                <h4 className="text-xs font-bold text-on-surface">Akses Ramah Disabilitas</h4>
                <p className="text-[11px] text-on-surface-variant">
                  {fac.wheelchair_accessible
                    ? 'Tersedia ramp/jalur landai untuk kursi roda.'
                    : 'Akses tangga standar.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px] text-emerald-600">ac_unit</span>
              <div>
                <h4 className="text-xs font-bold text-on-surface">Tata Udara / Pendingin</h4>
                <p className="text-[11px] text-on-surface-variant">
                  {fac.air_conditioned
                    ? 'Ruang sholat utama ber-AC.'
                    : 'Kipas angin / ventilasi alami.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* 1. DESKTOP (>= 640px): Centered Modal */}
      {isDesktop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 font-geist">
          <div className="absolute inset-0" onClick={onClose} />
          <div className="relative w-full max-w-xl bg-surface-container-lowest rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-surface-container-high/60 z-10 animate-in zoom-in-95 duration-200">
            {/* Hero Header */}
            <div className="p-5 pb-4 bg-surface-container-lowest shrink-0">
              {renderHeroHeader()}
            </div>

            {/* Tabs */}
            {renderTabsBar()}

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5">{renderBody()}</div>
          </div>
        </div>
      )}

      {/* 2. MOBILE (< 640px): Vaul Bottom Sheet */}
      {!isDesktop && (
        <Drawer.Root
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
          dismissible={true}
        >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />

            <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[86dvh] max-h-[88dvh] bg-surface-container-lowest rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.18)] border-t border-surface-container-high/80 focus:outline-none font-geist">
              {/* Drag Handle */}
              <div className="w-full flex justify-center pt-3 pb-1.5 shrink-0 cursor-pointer touch-none">
                <Drawer.Handle className="w-12 h-1.5 rounded-full bg-outline/40 hover:bg-outline/60 transition-colors" />
              </div>

              <Drawer.Title className="sr-only">{mosque.name}</Drawer.Title>
              <Drawer.Description className="sr-only">
                Profil fasilitas dan jadwal kajian di {mosque.name}
              </Drawer.Description>

              {/* Sticky Hero Header */}
              <div className="shrink-0 px-4 pt-1 pb-3.5 bg-surface-container-lowest">
                {renderHeroHeader()}
              </div>

              {/* Sticky Tabs */}
              {renderTabsBar()}

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 overscroll-contain pb-[calc(32px+env(safe-area-inset-bottom,16px))]">
                {renderBody()}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </>
  );
}
