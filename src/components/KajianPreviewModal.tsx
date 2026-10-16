'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { StudySession } from '@/lib/services/kajian';
import { hasPhysicalLocation } from '@/lib/services/kajian';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { useAttendance } from '@/utils/attendance';
import { subscribeToPushNotifications } from '@/utils/webPushClient';
import { isSessionReminded, toggleSessionReminder } from '@/utils/reminders';
import ShareModal, { shareSessionNative } from '@/components/ShareModal';
import NotificationReminderToggle from '@/components/NotificationReminderToggle';

interface KajianPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StudySession | null;
}

export default function KajianPreviewModal({
  isOpen,
  onClose,
  session,
}: KajianPreviewModalProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const { isAttending, toggle: toggleAttendance, getExtraCount } = useAttendance();

  // Reset img error saat session berganti
  useEffect(() => {
    setImgError(false);
  }, [session?.id, session?.poster_url]);

  // Kunci scroll body saat modal terbuka
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Tutup modal dengan tombol Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !session || !mounted) return null;

  const bookmarked = isBookmarked(session.id);
  const attending = isAttending(session.id);
  const totalAttendees = Math.max(
    0,
    (session.attendees_count || 0) + getExtraCount(session.id)
  );

  const handleToggleAttendance = async () => {
    if (!session) return;
    const willAttend = !attending;
    toggleAttendance(session.id);
    if (willAttend) {
      if (!isSessionReminded(session.id)) {
        toggleSessionReminder(session.id);
      }
    }
  };

  const now = new Date();
  const info = getEffectiveSessionInfo(session, now);
  const dateObj = info.effectiveDate;
  const hasDate = !!dateObj;

  // Format Tanggal
  const dateStr = dateObj
    ? dateObj.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : session.recurring_pattern || 'Jadwal Rutin';

  // Format Waktu
  const timeStr = dateObj
    ? dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
    : '';

  const hasPoster = Boolean(
    session.poster_url &&
    session.poster_url.trim() !== '' &&
    session.poster_url.toLowerCase() !== 'null' &&
    !imgError
  );

  const hasRoute = hasPhysicalLocation(session);
  const hasLive = Boolean(
    session.stream_url &&
    session.stream_url.trim() !== '' &&
    session.stream_url.toLowerCase() !== 'null'
  );

  // Google Calendar URL Generator
  const gCalUrl = new URL('https://calendar.google.com/calendar/render');
  if (hasDate && dateObj) {
    const endDateObj = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000);
    const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    gCalUrl.searchParams.append('action', 'TEMPLATE');
    gCalUrl.searchParams.append('text', session.title);
    gCalUrl.searchParams.append(
      'dates',
      `${formatGoogleDate(dateObj)}/${formatGoogleDate(endDateObj)}`
    );
    gCalUrl.searchParams.append(
      'details',
      `Pemateri: ${session.speaker_name}\nKitab: ${
        session.book_title && session.book_title !== 'null' ? session.book_title : '-'
      }\n\nDitemukan via Peta Kajian Seluruh Indonesia.`
    );
    gCalUrl.searchParams.append(
      'location',
      `${session.venues?.name || ''}, ${session.venues?.address || ''}`
    );
  }

  const handleShare = () => {
    shareSessionNative(session, () => setIsShareModalOpen(true));
  };

  const handleOpenFullImage = () => {
    if (session.poster_url) {
      window.open(session.poster_url, '_blank', 'noopener,noreferrer');
    }
  };

  return createPortal(
    <>
      {/* Modal Dialog Backdrop Seluas Layar / Peta */}
      <div
        className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
        onClick={onClose}
      >
        {/* Modal Container: Split Kiri (Poster) & Kanan (Deskripsi) di layar md: ke atas */}
        <div
          className="relative w-full max-w-5xl bg-surface-container-lowest rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-surface-container-high/80 flex flex-col md:flex-row max-h-[94vh] md:h-[84vh] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ================= SISI KIRI: POSTER VISUAL ================= */}
          <div className="w-full md:w-1/2 lg:w-[48%] bg-neutral-950 flex flex-col items-center justify-center relative p-3 sm:p-5 select-none shrink-0 max-h-[40vh] md:max-h-none md:h-full overflow-hidden">
            {/* Tombol Tutup Floating Khusus Mobile */}
            <button
              type="button"
              onClick={onClose}
              className="md:hidden absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-md active:scale-95 cursor-pointer"
              title="Tutup Modal"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {hasPoster ? (
              <>
                <img
                  src={session.poster_url}
                  alt={`Poster ${session.title}`}
                  className="max-h-[32vh] md:max-h-[72vh] w-auto h-auto max-w-full object-contain rounded-xl sm:rounded-2xl shadow-2xl transition-transform duration-300 hover:scale-[1.02]"
                  onError={() => setImgError(true)}
                />

                {/* Tombol Aksi Gambar di Bawah Poster */}
                <div className="mt-2.5 flex items-center gap-2 z-10">
                  <button
                    type="button"
                    onClick={handleOpenFullImage}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-md"
                    title="Buka gambar ukuran penuh di tab baru"
                  >
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                    <span>Buka Ukuran Asli</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-400 gap-2 p-8 text-center">
                <span className="material-symbols-outlined text-[48px] text-neutral-600">
                  image_not_supported
                </span>
                <span className="text-xs font-medium">Gambar poster tidak tersedia</span>
              </div>
            )}
          </div>

          {/* ================= SISI KANAN: DESKRIPSI & AKSI ================= */}
          <div className="w-full md:w-1/2 lg:w-[52%] flex flex-col p-4 sm:p-6 overflow-y-auto no-scrollbar justify-between space-y-4 md:h-full">
            <div className="space-y-4">
              {/* Header Badges & Tombol Tutup */}
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/60">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    <span>Kajian Aktif</span>
                  </span>

                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container px-2.5 py-1 rounded-full border border-surface-container-high">
                    {session.audience_type}
                  </span>

                  {session.is_online && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-800">
                      <span className="material-symbols-outlined text-[14px]">videocam</span>
                      <span>Live Streaming</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-surface-container text-outline hover:text-on-surface transition-colors cursor-pointer"
                  title="Tutup Modal"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Judul & Pemateri */}
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-on-surface leading-snug">
                  {session.title}
                </h2>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-primary mt-1">
                  <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
                  <span>{session.speaker_name}</span>
                </div>

                {/* Kitab Bahasan */}
                {session.book_title &&
                  session.book_title.trim() !== '' &&
                  session.book_title.toLowerCase() !== 'null' && (
                    <div className="flex items-center gap-1.5 text-xs text-outline mt-1 font-medium">
                      <span className="material-symbols-outlined text-[16px] shrink-0 text-amber-600">
                        menu_book
                      </span>
                      <span>Kitab: <strong className="text-on-surface">{session.book_title}</strong></span>
                    </div>
                  )}
              </div>

              {/* Rincian Waktu & Lokasi Box */}
              <div className="space-y-2.5 p-3.5 sm:p-4 rounded-2xl bg-surface-container-low/70 border border-surface-container-high text-xs">
                {/* Waktu Pelaksanaan */}
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-primary mt-0.5 shrink-0">
                    {hasDate ? 'calendar_month' : 'event_repeat'}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-bold text-on-surface text-xs sm:text-sm">
                      {hasDate ? dateStr : 'Kajian Rutin'}
                    </span>
                    <span className="text-[11px] text-outline font-medium mt-0.5">
                      {hasDate ? timeStr : dateStr}
                    </span>
                  </div>
                </div>

                {/* Lokasi Masjid */}
                {session.venues && (
                  <div className="flex items-start gap-2.5 pt-2 border-t border-surface-container-high/60">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600 mt-0.5 shrink-0">
                      location_on
                    </span>
                    <div className="flex flex-col leading-relaxed">
                      <span className="font-bold text-on-surface text-xs sm:text-sm">
                        {session.venues.name}
                      </span>
                      {session.venues.address && (
                        <span className="text-[11px] text-outline mt-0.5">
                          {session.venues.address}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Live Stream URL Link */}
                {hasLive && (
                  <div className="flex items-center justify-between pt-2 border-t border-surface-container-high/60">
                    <div className="flex items-center gap-2 text-red-600 font-semibold text-xs">
                      <span className="material-symbols-outlined text-[18px]">smart_display</span>
                      <span>Siaran Langsung</span>
                    </div>
                    <a
                      href={session.stream_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-2xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                      <span>Tonton Siaran</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Kehadiran Jamaah (RSVP) */}
              <div className="p-3 rounded-2xl bg-surface-container/60 border border-surface-container-high/70 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">groups</span>
                  </div>
                  <div>
                    <span className="block font-bold text-on-surface">
                      {totalAttendees} Jamaah
                    </span>
                    <span className="text-[10px] text-outline">Berencana menghadiri kajian</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleAttendance}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border ${
                    attending
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-surface-container-lowest text-primary hover:bg-primary/10 border-primary/30'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {attending ? 'check_circle' : 'how_to_reg'}
                  </span>
                  <span>{attending ? 'Saya Hadir' : 'Insya Allah Hadir'}</span>
                </button>
              </div>

              {/* Pengingat Notifikasi HP (Web Push) */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-on-surface block">Pengingat Notifikasi HP</span>
                    <span className="text-[10px] text-outline">Dapatkan alarm push 2 jam sebelum kajian dimulai</span>
                  </div>
                </div>
                <NotificationReminderToggle sessionId={session.id} className="w-full sm:w-auto shrink-0 justify-center" />
              </div>
            </div>

            {/* ================= TOMBOL AKSI UTAMA DI FOOTER ================= */}
            <div className="pt-4 border-t border-surface-container-high/60 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {hasRoute && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-on-surface hover:text-primary bg-surface-container hover:bg-surface-container-high border border-surface-container-high py-2.5 px-3 rounded-xl transition-all active:scale-95 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">directions_car</span>
                    <span>Petunjuk Rute</span>
                  </a>
                )}

                {hasDate && (
                  <a
                    href={gCalUrl.toString()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:text-on-primary bg-primary/10 hover:bg-primary border border-primary/20 py-2.5 px-3 rounded-xl transition-all active:scale-95 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">event_available</span>
                    <span>Ke Kalender</span>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Tombol Bagikan */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface bg-surface-container hover:bg-surface-container-high border border-surface-container-high py-2 px-3 rounded-xl transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">share</span>
                  <span>Bagikan</span>
                </button>

                {/* Tombol Bookmark */}
                <button
                  type="button"
                  onClick={() => toggleBookmark(session.id, session)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl border transition-colors cursor-pointer ${
                    bookmarked
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high border-surface-container-high'
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: bookmarked ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    bookmark
                  </span>
                  <span>{bookmarked ? 'Tersimpan' : 'Simpan'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal Fallback */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        session={session}
      />
    </>,
    document.body
  );
}
