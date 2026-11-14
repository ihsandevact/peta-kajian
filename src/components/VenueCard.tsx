import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { type StudySession, hasPhysicalLocation } from '@/lib/services/kajian';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { useAttendance } from '@/utils/attendance';
import { subscribeToPushNotifications } from '@/utils/webPushClient';
import { isSessionReminded, toggleSessionReminder } from '@/utils/reminders';
import NotificationReminderToggle from '@/components/NotificationReminderToggle';
import dynamic from 'next/dynamic';
import { shareSessionNative } from '@/components/ShareModal';

const ShareModal = dynamic(() => import('@/components/ShareModal'), { ssr: false });
const KajianPreviewModal = dynamic(() => import('@/components/KajianPreviewModal'), { ssr: false });
import { useLivePlayer } from '@/context/LivePlayerContext';
import { extractYouTubeVideoId } from '@/utils/youtube';
import { triggerLoginNudge } from '@/components/LoginNudgePrompt';

interface VenueCardProps {
  session: StudySession;
  onClose?: () => void;
  onStartRoute?: (session: StudySession) => void;
}

export default function VenueCard({ session, onClose, onStartRoute }: VenueCardProps) {
  const { playStream } = useLivePlayer();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const { isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const { isAttending, toggle: toggleAttendance, getExtraCount } = useAttendance();

  const ytVideoId = extractYouTubeVideoId(session.stream_url);

  const thumbnailUrl = React.useMemo(() => {
    const rawPoster = session.poster_url?.trim();
    if (
      rawPoster &&
      rawPoster !== '' &&
      rawPoster.toLowerCase() !== 'null' &&
      rawPoster.toLowerCase() !== 'undefined'
    ) {
      return rawPoster;
    }
    if (ytVideoId) {
      return `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`;
    }
    return null;
  }, [session.poster_url, ytVideoId]);

  const handleWatchLive = () => {
    if (ytVideoId) {
      playStream({
        videoId: ytVideoId,
        title: session.title,
        speakerName: session.speaker_name,
        channelName: session.venues?.name || session.speaker_name,
      });
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
    setImgLoaded(false);
  }, [session.id, thumbnailUrl]);

  const now = new Date();
  const info = getEffectiveSessionInfo(session, now);
  const dateObj = info.effectiveDate;
  const hasDate = !!dateObj;
  const isPast = info.isPast && !session.is_recurring;

  // Format Tanggal
  const dateStr = dateObj
    ? dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
    : session.recurring_pattern || 'Waktu Rutin Belum Ditentukan';

  // Format Waktu
  const timeStr = dateObj
    ? dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '';

  const hasValidImage = Boolean(thumbnailUrl && !imgError);

  const hasRoute = hasPhysicalLocation(session);
  const hasLive = Boolean(ytVideoId) && !isPast;
  const hasCalendar = hasDate && !isPast;

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
    if (isPast) return;
    const willAttend = !attending;
    toggleAttendance(session.id);
    if (willAttend) {
      if (!isSessionReminded(session.id)) {
        toggleSessionReminder(session.id);
      }
      triggerLoginNudge({ type: 'attendance', title: session.title });
    }
  };

  return (
    <div className="relative font-geist pointer-events-auto filter drop-shadow-xl w-[305px] sm:w-[320px]">
      <div className={`w-full max-h-[min(470px,calc(100dvh-170px))] flex flex-col bg-surface-container-lowest rounded-2xl border transition-all transform origin-bottom overflow-hidden ${
        isPast ? 'border-surface-container-highest shadow-md' : 'border-surface-container-high/80'
      }`}>
        {/* Gambar Thumbnail Header (Selalu Tampil) - Dapat diklik untuk membuka Preview Modal */}
        <div
          onClick={() => setIsPreviewModalOpen(true)}
          className="w-full h-[84px] sm:h-[90px] bg-surface-container shrink-0 relative overflow-hidden cursor-pointer group"
          title="Klik untuk melihat gambar poster penuh & detail kajian"
        >
          {hasValidImage ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 bg-surface-container-high animate-pulse flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px] text-outline/40">
                    image
                  </span>
                </div>
              )}
              <img
                src={thumbnailUrl!}
                alt={`Poster ${session.title}`}
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                  imgLoaded ? 'opacity-100' : 'opacity-0'
                } ${isPast ? 'grayscale-[35%] brightness-90' : ''}`}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
              {/* Vignette Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/25 pointer-events-none" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0c432d] via-[#126947] to-[#0a3826] flex items-center justify-between px-4 text-white select-none relative overflow-hidden">
              <div className="flex items-center gap-2.5 z-10 min-w-0 pr-16">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px] text-emerald-100">
                    {session.venues ? 'mosque' : 'smart_display'}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200/90">
                    {session.venues ? 'Majelis Ilmu' : 'Kajian Online'}
                  </p>
                  <p className="text-[11px] font-semibold text-white/90 truncate">
                    {session.venues ? session.venues.name : session.speaker_name}
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[68px] text-white/10 absolute -bottom-3 right-3 pointer-events-none">
                {session.venues ? 'mosque' : 'menu_book'}
              </span>
            </div>
          )}

          {/* Tombol/Badge "Lihat Gambar" Selalu Tampil di Kiri Bawah Thumbnail */}
          <div className="absolute bottom-2 left-2.5 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/55 group-hover:bg-[#126947] backdrop-blur-md text-white text-[10px] font-bold tracking-wide transition-colors shadow-sm border border-white/15">
              <span className="material-symbols-outlined text-[13px]">zoom_in</span>
              <span>{hasValidImage ? 'Lihat Gambar' : 'Lihat Detail'}</span>
            </span>
          </div>

          {/* Tombol Aksi Absolute Floating (Kanan Atas) */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const willBookmark = !bookmarked;
                toggleBookmark(session.id, session);
                if (willBookmark) {
                  triggerLoginNudge({ type: 'bookmark', title: session.title });
                }
              }}
              className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-md active:scale-90 cursor-pointer ${
                bookmarked
                  ? 'bg-amber-500 text-white'
                  : 'bg-black/50 text-white hover:bg-black/75'
              }`}
              title={bookmarked ? 'Hapus dari Tersimpan' : 'Simpan Kajian (Bookmark)'}
            >
              <span
                className="material-symbols-outlined text-[15px]"
                style={{ fontVariationSettings: bookmarked ? "'FILL' 1" : "'FILL' 0" }}
              >
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

        {/* Banner Mode Pengujian Khusus Admin */}
        {session.is_test && (
          <div className="px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between text-amber-800 dark:text-amber-300 text-[11px] font-bold shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-amber-600">science</span>
              <span>MODE PENGUJIAN (KHUSUS ADMIN)</span>
            </span>
            <span className="text-[10px] font-medium opacity-80 hidden xs:inline">Hanya Anda yg melihat</span>
          </div>
        )}

        <div className="p-2.5 sm:p-3 overflow-y-auto no-scrollbar flex-1 min-h-0">
          {/* Header Badges & Action Buttons */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-surface-container-high/60 mb-1.5">
            {isPast ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-surface-container-highest whitespace-nowrap shrink-0">
                <span className="material-symbols-outlined text-[13px] text-outline">history</span>
                Kajian Selesai
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 whitespace-nowrap shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                Kajian Aktif
              </span>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Badge Kategori */}
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container px-2 py-0.5 rounded-full border border-surface-container-high">
                {session.audience_type}
              </span>

              {/* Toggle Pengingat Notifikasi Tepat di Samping Kategori (Hanya jika belum selesai) */}
              {!isPast && (
                <NotificationReminderToggle sessionId={session.id} variant="inline" />
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
                  <Link
                    href={`/masjid/${session.venues.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-on-surface hover:text-emerald-600 transition-colors inline-flex items-center gap-1 group/masjid"
                    title="Lihat Profil & Semua Jadwal di Masjid Ini"
                  >
                    <span>{session.venues.name}</span>
                    <span className="material-symbols-outlined text-[13px] opacity-0 group-hover/masjid:opacity-100 transition-opacity">open_in_new</span>
                  </Link>
                  {session.venues.address && (
                    <span className="text-[11px] text-outline line-clamp-1 mt-0.5">{session.venues.address}</span>
                  )}
                </div>
              </div>
            )}

            {/* Baris Live Streaming (Online / Hybrid) - Hanya tampil jika stream_url valid & aktif */}
            {session.is_online && hasLive && (
              <div className="flex items-center gap-2 text-red-600 font-semibold text-[11px]">
                <span className="material-symbols-outlined text-[15px] shrink-0">videocam</span>
                <span>Disiarkan secara live</span>
              </div>
            )}
          </div>

          {/* Kehadiran Jamaah (RSVP) */}
          <div className="mt-2 p-1.5 px-2.5 rounded-xl bg-surface-container/60 border border-surface-container-high/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant min-w-0">
              <span className={`material-symbols-outlined text-[16px] shrink-0 ${isPast ? 'text-outline' : 'text-primary'}`}>groups</span>
              <span className="truncate whitespace-nowrap">
                <strong className="text-on-surface font-semibold">{totalAttendees}</strong> {isPast ? 'Jamaah tercatat' : 'Jamaah hadir'}
              </span>
            </div>
            {isPast ? (
              <button
                type="button"
                disabled
                className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-surface-container-high text-on-surface-variant/60 border border-surface-container-highest cursor-not-allowed select-none"
                title="Kajian ini telah berakhir, presensi telah ditutup"
              >
                {attending ? (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-emerald-600">check_circle</span>
                    <span>Telah Hadir</span>
                  </span>
                ) : (
                  <span>Selesai</span>
                )}
              </button>
            ) : (
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
            )}
          </div>
        </div>

        {/* Aksi Bawah (Fixed Footer Actions - Selalu utuh di bawah kartu, tidak akan terpotong) */}
        <div className="p-2.5 sm:p-3 pt-2 border-t border-surface-container-high/60 flex flex-col gap-1.5 bg-surface-container-lowest shrink-0">
          {/* Skenario Khusus: Kajian Selesai/Arsip (Hanya Aktifkan Link Rute Maps ke Masjid) */}
          {isPast ? (
            <div className="flex flex-col gap-1.5 w-full">
              {hasRoute ? (
                onStartRoute ? (
                  <button
                    type="button"
                    onClick={() => onStartRoute(session)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-2.5 px-3 rounded-xl transition-all shadow-md shadow-emerald-600/25 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">directions</span>
                    <span>Petunjuk Rute ke Lokasi</span>
                  </button>
                ) : (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-2.5 px-3 rounded-xl transition-all shadow-md shadow-emerald-600/25"
                  >
                    <span className="material-symbols-outlined text-[16px]">directions</span>
                    <span>Petunjuk Rute ke Lokasi</span>
                  </a>
                )
              ) : (
                <div className="w-full py-1.5 px-3 text-center text-xs font-medium text-on-surface-variant bg-surface-container rounded-xl border border-surface-container-high">
                  Kajian Online Telah Selesai
                </div>
              )}
            </div>
          ) : hasRoute && hasLive ? (
            /* Skenario 1: Hybrid (Ada Rute Maps DAN Ada Tonton Live) */
            <>
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {onStartRoute ? (
                  <button
                    type="button"
                    onClick={() => onStartRoute(session)}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-2 px-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/25 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">directions</span>
                    <span>Rute Maps</span>
                  </button>
                ) : (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-2 px-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/25"
                  >
                    <span className="material-symbols-outlined text-[16px]">directions</span>
                    <span>Rute Maps</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleWatchLive}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 py-2 px-2.5 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-red-600">play_circle</span>
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
              {onStartRoute ? (
                <button
                  type="button"
                  onClick={() => onStartRoute(session)}
                  className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-2 px-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/25 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">directions</span>
                  <span>Rute Maps</span>
                </button>
              ) : (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-2 px-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/25"
                >
                  <span className="material-symbols-outlined text-[16px]">directions</span>
                  <span>Rute Maps</span>
                </a>
              )}

              <a
                href={gCalUrl.toString()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-on-primary bg-primary/10 hover:bg-primary border border-primary/20 py-2 px-2.5 rounded-xl transition-all active:scale-95 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">event_available</span>
                <span>Simpan Kalender</span>
              </a>
            </div>
          ) : hasLive && hasCalendar ? (
            /* Skenario 3: Murni Online Streaming (Ada Live + Kalender, Tanpa Masjid Fisik) */
            <div className="flex flex-col gap-1.5 w-full">
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
            </div>
          ) : (
            /* Skenario 4: Sisa tombol tunggal jika yang lain tidak tersedia */
            <div className="flex flex-col gap-1.5 w-full">
              {hasRoute && (
                onStartRoute ? (
                  <button
                    type="button"
                    onClick={() => onStartRoute(session)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-2.5 px-3 rounded-xl transition-all shadow-md shadow-emerald-600/25 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">directions</span>
                    <span>Petunjuk Rute Maps</span>
                  </button>
                ) : (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${session.venues?.lat},${session.venues?.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-2.5 px-3 rounded-xl transition-all shadow-md shadow-emerald-600/25"
                  >
                    <span className="material-symbols-outlined text-[16px]">directions</span>
                    <span>Petunjuk Rute Maps</span>
                  </a>
                )
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
        onStartRoute={onStartRoute}
      />
    </div>
  );
}
