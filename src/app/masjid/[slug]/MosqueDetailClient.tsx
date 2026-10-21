'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { MosqueVenue } from '@/lib/services/venues';
import type { StudySession } from '@/lib/services/kajian';
import ThemeToggle from '@/components/ThemeToggle';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { useAttendance } from '@/utils/attendance';

const MASJID_STATE_STORAGE_KEY = 'peta_kajian_masjid_state';

interface MosqueDetailClientProps {
  venue: MosqueVenue;
  sessions: StudySession[];
}

export default function MosqueDetailClient({ venue, sessions }: MosqueDetailClientProps) {
  const [activeTab, setActiveTab] = useState<'jadwal' | 'fasilitas'>('jadwal');
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const { isAttending, toggle: toggleAttendance } = useAttendance();

  // Pastikan saat kembali (Back) ke /masjid, masjid ini tetap tercatat sebagai masjid aktif terakhir
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(MASJID_STATE_STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(
        MASJID_STATE_STORAGE_KEY,
        JSON.stringify({
          ...prev,
          selectedMosqueId: venue.id,
        })
      );
    } catch {}
  }, [venue.id]);

  const fac = venue.facilities || {};
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    venue.name + ' ' + venue.address
  )}`;
  const wazeUrl = `https://waze.com/ul?ll=${venue.lat},${venue.lng}&navigate=yes`;

  // Filter kajian tematik / mendatang vs rutin
  const { upcomingSessions, recurringSessions } = React.useMemo(() => {
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

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col">
      {/* HEADER NAV */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 border-b border-outline-variant/40 bg-surface/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/masjid"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container text-on-surface transition-colors"
            title="Kembali ke Direktori Masjid"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>

          <Link href="/masjid" className="flex items-center gap-2">
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-on-surface">
              Direktori Masjid
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-xs font-semibold text-on-surface-variant hover:text-emerald-600 px-3 py-1.5 rounded-xl hover:bg-surface-container transition-colors"
          >
            Peta Beranda
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* HERO SECTION PROFIL MASJID */}
      <div className="bg-surface border-b border-outline-variant/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            {/* Foto / Ikon Cover */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-sm border border-emerald-500/20">
              <span className="material-symbols-outlined text-[36px] sm:text-[44px]">mosque</span>
            </div>

            {/* Nama & Alamat */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/50 px-2.5 py-0.5 rounded-full">
                  {venue.city || 'Indonesia'}
                </span>
                {venue.is_verified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                    <span className="material-symbols-outlined text-[13px]">verified</span>
                    Terverifikasi
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-on-surface tracking-tight">
                {venue.name}
              </h1>

              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                {venue.address}
              </p>

              {/* ACTION BUTTONS NAVIGASI */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Link
                  href={`/masjid?route=${venue.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">directions</span>
                  <span>Rute Maps</span>
                </Link>

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

                {venue.contact_wa && (
                  <a
                    href={`https://wa.me/${venue.contact_wa.replace(/[^0-9]/g, '')}`}
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
          </div>
        </div>
      </div>

      {/* TABS MENU */}
      <div className="bg-surface border-b border-outline-variant/40 sticky top-14 sm:top-16 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('jadwal')}
            className={`py-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
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
            className={`py-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'fasilitas'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span>Fasilitas Masjid</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'jadwal' && (
          <div className="space-y-6">
            {/* Kajian Mendatang / Tematik */}
            <div className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Kajian Mendatang</span>
              </h2>

              {upcomingSessions.length === 0 ? (
                <div className="p-6 rounded-2xl border border-outline-variant/40 bg-surface text-center text-on-surface-variant text-xs sm:text-sm space-y-1">
                  <p className="font-medium">Belum ada jadwal kajian tematik mendatang di masjid ini.</p>
                  <p className="text-xs text-on-surface-variant/70">
                    Punya info kajian di masjid ini? Silakan ajukan melalui menu Kontributor.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingSessions.map((session) => {
                    const info = getEffectiveSessionInfo(session, new Date());
                    const booked = isBookmarked(session.id);
                    const attend = isAttending(session.id);
                    const timeStr = info.effectiveDate
                      ? info.effectiveDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                      : '';

                    return (
                      <div
                        key={session.id}
                        className="p-4 sm:p-5 rounded-2xl border border-outline-variant/50 bg-surface hover:border-emerald-400 transition-colors space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 px-2.5 py-0.5 rounded-full">
                              {info.dateLabel} {timeStr ? `• ${timeStr}` : ''}
                            </span>
                            <h3 className="text-sm sm:text-base font-bold text-on-surface mt-1.5 leading-snug">
                              {session.title}
                            </h3>
                            <p className="text-xs sm:text-sm font-semibold text-on-surface-variant mt-0.5">
                              Pemateri: {session.speaker_name}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/20">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleAttendance(session.id)}
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
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
                              className={`p-1.5 rounded-lg border transition-colors ${
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
                            <span>Lihat di Peta Utama</span>
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
              <div className="space-y-3 pt-4 border-t border-outline-variant/40">
                <h2 className="text-base sm:text-lg font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[20px]">event_repeat</span>
                  <span>Agenda Kajian Rutin Pekanan</span>
                </h2>

                <div className="space-y-3">
                  {recurringSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 rounded-2xl border border-outline-variant/50 bg-surface space-y-2"
                    >
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-md">
                        {session.recurring_pattern || 'Kajian Rutin'}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-on-surface">
                        {session.title}
                      </h3>
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

        {/* TAB FASILITAS */}
        {activeTab === 'fasilitas' && (
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-on-surface">
              Kelengkapan & Fasilitas Masjid
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px] text-emerald-600">local_parking</span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-on-surface">Parkir Kendaraan</h4>
                  <p className="text-xs text-on-surface-variant">
                    {fac.parking_car ? 'Tersedia area parkir mobil dan motor.' : 'Area parkir terbatas / standar.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px] text-emerald-600">family_restroom</span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-on-surface">Keluarga & Laktasi</h4>
                  <p className="text-xs text-on-surface-variant">
                    {fac.kids_friendly
                      ? 'Ramah anak, tersedia ruang menyusui/laktasi.'
                      : 'Kapasitas keluarga standar.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px] text-emerald-600">accessible</span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-on-surface">Akses Ramah Disabilitas</h4>
                  <p className="text-xs text-on-surface-variant">
                    {fac.wheelchair_accessible
                      ? 'Tersedia ramp/jalur landai untuk kursi roda.'
                      : 'Akses tangga standar.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px] text-emerald-600">ac_unit</span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-on-surface">Tata Udara / Pendingin</h4>
                  <p className="text-xs text-on-surface-variant">
                    {fac.air_conditioned ? 'Ruang sholat utama ber-AC.' : 'Kipas angin / ventilasi alami.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
