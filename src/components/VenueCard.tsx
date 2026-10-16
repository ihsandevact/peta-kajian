import React, { useState, useEffect } from 'react';
import { type StudySession, hasPhysicalLocation } from '@/lib/services/kajian';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { useAttendance } from '@/utils/attendance';
import { subscribeToPushNotifications } from '@/utils/webPushClient';
import { isSessionReminded, toggleSessionReminder } from '@/utils/reminders';
import NotificationReminderToggle from '@/components/NotificationReminderToggle';
import ShareModal, { shareSessionNative } from '@/components/ShareModal';
import KajianPreviewModal from '@/components/KajianPreviewModal';
import { useLivePlayer } from '@/context/LivePlayerContext';

interface VenueCardProps {
  session: StudySession;
  onClose?: () => void;
}

export default function VenueCard({ session, onClose }: VenueCardProps) {
  const { playStream } = useLivePlayer();
  const [imgError, setImgError] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const { isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const { isAttending, toggle: toggleAttendance, getExtraCount } = useAttendance();

  const ytVideoId = session.stream_url
    ? session.stream_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]
    : null;

  const handleWatchLive = () => {
    if (ytVideoId) {
      playStream({
        videoId: ytVideoId,
        title: session.title,
        speakerName: session.speaker_name,
        channelName: session.venues?.name || session.speaker_name,
      });
    } else if (session.stream_url) {
      window.open(session.stream_url, '_blank', 'noopener,noreferrer');
    }
  };

  const bookmarked = isBookmarked(session.id);
  const attending = isAttending(session.id);
  const totalAttendees = Math.max(
    0,
    (session.attendees_count || 0) + getExtraCount(session.id)
  );

  const handleShare = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    shareSessionNative(session, () => setIsShareModalOpen(true));
  };

  useEffect(() => {
    setImgError(false);
  }, [session.id, session.poster_url]);

  const now = new Date();
  const info = getEffectiveSessionInfo(session, now);
  const dateObj = info.effectiveDate;
  const hasDate = !!dateObj;

  // Format Tanggal
  const dateStr = dateObj
    ? dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
    : session.recurring_pattern || 'Waktu Rutin Belum Ditentukan';

  // Format Waktu
  const timeStr = dateObj
    ? dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
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
  const hasCalendar = hasDate;

  // --- GOOGLE CALENDAR GENERATOR ---
  const gCalUrl = new URL('https://calendar.google.com/calendar/render');
  if (hasDate && dateObj) {
    const endDateObj = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000);
    const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    gCalUrl.searchParams.append('action', 'TEMPLATE');
    gCalUrl.searchParams.append('text', session.title);
    gCalUrl.searchParams.append('dates', `${formatGoogleDate(dateObj)}/${formatGoogleDate(endDateObj)}`);
    gCalUrl.searchParams.append(
      'details',
      `Pemateri: ${session.speaker_name}\nKitab: ${session.book_title && session.book_title !== 'null' ? session.book_title : '-'}\n\nDitemukan via Peta Kajian Seluruh Indonesia.`
    );
    gCalUrl.searchParams.append('location', `${session.venues?.name || ''}, ${session.venues?.address || ''}`);
  }

  const handleToggleAttendance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const willAttend = !attending;
    toggleAttendance(session.id);
    if (willAttend) {
      if (!isSessionReminded(session.id)) {
        toggleSessionReminder(session.id);
      }
    }
  };

  return (
    <div className="relative font-geist pointer-events-auto filter drop-shadow-xl w-[305px] sm:w-[320px]">
      <div className="w-full max-h-[min(580px,calc(100vh-60px))] no-scrollbar overflow-y-auto bg-surface-container-lowest rounded-2xl border border-surface-container-high/80 transition-all transform origin-bottom flex flex-col relative overflow-x-hidden">
        {/* Gambar Poster Header - Dapat diklik untuk membuka Preview Modal */}
        {hasPoster && (
          <div
            onClick={() => setIsPreviewModalOpen(true)}
            className="w-full h-[88px] sm:h-[94px] bg-surface-container shrink-0 relative overflow-hidden cursor-pointer group"
            title="Klik untuk melihat poster penuh & detail kajian"
          >
            <img
              src={session.poster_url}
              alt={`Poster ${session.title}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
            {/* Vignette Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

            {/* Hover Zoom Indicator */}
            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-semibold text-[11px] pointer-events-none">
              <span className="material-symbols-outlined text-[16px]">zoom_in</span>
              <span>Lihat Poster</span>
            </div>

            {/* Tombol Aksi Absolute Floating (Jika ada gambar) */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(session.id, session);
                }}
                className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-md active:scale-90 cursor-pointer ${
                  bookmarked
                    ? 'bg-amber-500 text-white'
                    : 'bg-black/50 text-white hover:bg-black/75'
                }`}
                title={bookmarked ? 'Hapus dari Tersimpan' : 'Simpan Kajian (Bookmark)'}
              >
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: bookmarked ? "'FILL' 1" : "'FILL' 0" }}>
                  bookmark
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare(e);
                }}
                className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/75 transition-all shadow-md active:scale-90 cursor-pointer"
                title="Bagikan Info Kajian"
              >
                <span className="material-symbols-outlined text-[14px]">share</span>
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/75 transition-all shadow-md active:scale-90 cursor-pointer"
                  title="Tutup"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="p-2.5 sm:p-3">
          {/* Header Badges & Action Buttons */}
          <div className="flex items-center justify-between pb-1.5 border-b border-surface-container-high/60 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Kajian Aktif
            </span>
            <div className="flex items-center gap-1.5">
              {/* Badge Kategori */}
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container px-2 py-0.5 rounded-full border border-surface-container-high">
                {session.audience_type}
              </span>

              {/* Toggle Pengingat Notifikasi Tepat di Samping Kategori */}
              <NotificationReminderToggle sessionId={session.id} variant="inline" />

              {/* Aksi Tambahan jika TIDAK ADA poster */}
              {!hasPoster && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleBookmark(session.id, session)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      bookmarked
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'
                    }`}
                    title={bookmarked ? 'Hapus dari Tersimpan' : 'Simpan Kajian'}
                  >
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: bookmarked ? "'FILL' 1" : "'FILL' 0" }}>
                      bookmark
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors cursor-pointer"
                    title="Bagikan Kajian"
                  >
                    <span className="material-symbols-outlined text-[13px]">share</span>
                  </button>

                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
                      title="Tutup"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Konten Utama */}
          <h3 className="text-[14px] sm:text-[15px] font-bold text-on-surface line-clamp-2 leading-snug" title={session.title}>
            {session.title}
          </h3>
          <p className="text-xs font-semibold text-primary mt-0.5 truncate">
            {session.speaker_name}
          </p>

          {/* Baris Kitab (Jika Ada) */}
          {session.book_title && session.book_title.trim() !== '' && session.book_title.toLowerCase() !== 'null' && (
            <div className="flex items-center gap-1.5 text-xs text-outline mt-1 font-medium truncate">
              <span className="material-symbols-outlined text-[15px] shrink-0">menu_book</span>
              <span className="truncate">{session.book_title}</span>
            </div>
          )}

          {/* Informasi Detail Box */}
          <div className="mt-2 flex flex-col gap-1 p-2 sm:p-2.5 rounded-xl bg-surface-container-low/60 border border-surface-container-high/50 text-xs">
            {/* Baris Waktu */}
            <div className="flex items-start gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[15px] text-outline mt-0.5 shrink-0">
                {hasDate ? 'calendar_month' : 'event_repeat'}
              </span>
              <span className="leading-tight font-medium text-on-surface">
                {hasDate ? `${dateStr} • ${timeStr} WIB` : dateStr}
              </span>
            </div>

            {/* Baris Lokasi */}
            {session.venues && (
              <div className="flex items-start gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[15px] text-outline mt-0.5 shrink-0">location_on</span>
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-on-surface">{session.venues.name}</span>
                  {session.venues.address && (
                    <span className="text-[11px] text-outline line-clamp-1 mt-0.5">{session.venues.address}</span>
                  )}
                </div>
              </div>
            )}

            {/* Baris Live Streaming (Online / Hybrid) */}
            {session.is_online && (
              <div className="flex items-center gap-2 text-red-600 font-semibold text-[11px]">
                <span className="material-symbols-outlined text-[15px] shrink-0">videocam</span>
                <span>Disiarkan secara live</span>
              </div>
            )}
          </div>

          {/* Kehadiran Jamaah (RSVP) */}
          <div className="mt-2 p-1.5 px-2.5 rounded-xl bg-surface-container/60 border border-surface-container-high/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant min-w-0">
              <span className="material-symbols-outlined text-[16px] text-primary shrink-0">groups</span>
              <span className="truncate whitespace-nowrap">
                <strong className="text-on-surface font-semibold">{totalAttendees}</strong> Jamaah hadir
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleAttendance}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1 border ${
                attending
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-surface-container-lowest text-primary hover:bg-primary/10 border-primary/30'
              }`}
            >
              {attending ? (
                <>
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  <span>Saya Hadir</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[13px]">how_to_reg</span>
                  <span>Insya Allah Hadir</span>
                </>
              )}
            </button>
          </div>

          {/* Aksi Bawah */}
          <div className="mt-2 pt-2 border-t border-surface-container-high/60 flex flex-col gap-1.5">
          {/* Skenario 1: Hybrid (Ada Rute Maps DAN Ada Tonton Live) */}
          {hasRoute && hasLive ? (
            <>
              <div className="grid grid-cols-2 gap-1.5 w-full">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary bg-surface-container hover:bg-surface-container-high border border-surface-container-high py-1.5 px-2 rounded-xl transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[15px]">directions_car</span>
                  <span>Rute Maps</span>
                </a>

                <button
                  type="button"
                  onClick={handleWatchLive}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 py-1.5 px-2 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-red-600">play_circle</span>
                  <span>Tonton Live</span>
                </button>
              </div>

              {hasCalendar && (
                <a
                  href={gCalUrl.toString()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-on-primary bg-primary/10 hover:bg-primary border border-primary/20 py-1.5 px-3 rounded-xl transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[15px]">event_available</span>
                  <span>Simpan ke Kalender</span>
                </a>
              )}
            </>
          ) : hasRoute && hasCalendar ? (
            /* Skenario 2: Offline di Masjid (Ada Rute + Kalender, Tanpa Stream) */
            <div className="grid grid-cols-2 gap-1.5 w-full">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary bg-surface-container hover:bg-surface-container-high border border-surface-container-high py-1.5 px-2 rounded-xl transition-all active:scale-95 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[15px]">directions_car</span>
                <span>Rute Maps</span>
              </a>

              <a
                href={gCalUrl.toString()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-on-primary bg-primary/10 hover:bg-primary border border-primary/20 py-1.5 px-2 rounded-xl transition-all active:scale-95 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[15px]">event_available</span>
                <span>Simpan Kalender</span>
              </a>
            </div>
          ) : hasLive && hasCalendar ? (
            /* Skenario 3: Murni Online Streaming (Ada Live + Kalender, Tanpa Masjid Fisik) */
            <div className="grid grid-cols-2 gap-1.5 w-full">
              <button
                type="button"
                onClick={handleWatchLive}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 py-1.5 px-2 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-red-600">play_circle</span>
                <span>Tonton Live</span>
              </button>

              <a
                href={gCalUrl.toString()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-on-primary bg-primary/10 hover:bg-primary border border-primary/20 py-1.5 px-2 rounded-xl transition-all active:scale-95 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[15px]">event_available</span>
                <span>Simpan Kalender</span>
              </a>
            </div>
          ) : (
            /* Skenario 4: Sisa tombol tunggal jika yang lain tidak tersedia */
            <div className="flex flex-col gap-1.5 w-full">
              {hasRoute && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary bg-surface-container hover:bg-surface-container-high border border-surface-container-high py-1.5 px-3 rounded-xl transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[15px]">directions_car</span>
                  <span>Petunjuk Rute Maps</span>
                </a>
              )}
              {hasLive && (
                <button
                  type="button"
                  onClick={handleWatchLive}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 py-1.5 px-3 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-red-600">play_circle</span>
                  <span>Tonton Siaran Live</span>
                </button>
              )}
              {hasCalendar && (
                <a
                  href={gCalUrl.toString()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-on-primary bg-primary/10 hover:bg-primary border border-primary/20 py-1.5 px-3 rounded-xl transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[15px]">event_available</span>
                  <span>Simpan ke Google Calendar</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Segitiga Penunjuk (Pointer Tip) - Berada tepat di bawah kartu tanpa overlap konten */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px pointer-events-none z-10 flex flex-col items-center">
        <svg
          width="18"
          height="9"
          viewBox="0 0 18 9"
          className="text-surface-container-lowest fill-current"
          style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.08))' }}
        >
          <path d="M0 0 L9 9 L18 0 Z" />
          <path d="M0 0 L9 9 L18 0" fill="none" stroke="currentColor" className="stroke-surface-container-high/80" strokeWidth="1" />
        </svg>
      </div>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        session={session}
      />

      {/* Preview Modal Poster & Detail Kajian */}
      <KajianPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        session={session}
      />
    </div>
  );
}
