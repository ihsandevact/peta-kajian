'use client';

import React, { useState } from 'react';
import type { StudySession } from '@/lib/services/kajian';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { useAttendance } from '@/utils/attendance';
import { subscribeToPushNotifications } from '@/utils/webPushClient';
import { isSessionReminded, toggleSessionReminder } from '@/utils/reminders';
import NotificationReminderToggle from '@/components/NotificationReminderToggle';
import ShareModal, { shareSessionNative } from '@/components/ShareModal';
import KajianPreviewModal from '@/components/KajianPreviewModal';
import { useLivePlayer } from '@/context/LivePlayerContext';
import { extractYouTubeVideoId } from '@/utils/youtube';

interface OnlineStreamingOverlayProps {
  session: StudySession;
  onClose: () => void;
}

export default function OnlineStreamingOverlay({ session, onClose }: OnlineStreamingOverlayProps) {
  const { playStream } = useLivePlayer();
  const [imgError, setImgError] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const { isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const { isAttending, toggle: toggleAttendance, getExtraCount } = useAttendance();

  const bookmarked = isBookmarked(session.id);
  const attending = isAttending(session.id);
  const totalAttendees = Math.max(
    0,
    (session.attendees_count || 0) + getExtraCount(session.id)
  );

  const now = new Date();
  const info = getEffectiveSessionInfo(session, now);
  const dateObj = info.effectiveDate;
  const hasDate = !!dateObj;

  const dateStr = dateObj
    ? dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : session.recurring_pattern || 'Jadwal Rutin';

  const timeStr = dateObj
    ? dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
    : '';

  const isLive = info.isLive;

  const hasPoster = Boolean(
    session.poster_url &&
    session.poster_url.trim() !== '' &&
    session.poster_url.toLowerCase() !== 'null' &&
    !imgError
  );

  // Deteksi Platform Siaran
  const streamUrl = session.stream_url || '';
  let platformLabel = 'Live Streaming';
  let platformIcon = 'videocam';

  if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
    platformLabel = 'YouTube Live';
    platformIcon = 'smart_display';
  } else if (streamUrl.includes('zoom.us')) {
    platformLabel = 'Zoom Meeting';
    platformIcon = 'video_camera_front';
  } else if (streamUrl.includes('instagram.com')) {
    platformLabel = 'Instagram Live';
    platformIcon = 'photo_camera';
  }

  // Google Calendar URL Generator
  const gCalUrl = new URL('https://calendar.google.com/calendar/render');
  if (hasDate && dateObj) {
    const endDateObj = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000);
    const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    gCalUrl.searchParams.append('action', 'TEMPLATE');
    gCalUrl.searchParams.append('text', `[Online] ${session.title}`);
    gCalUrl.searchParams.append(
      'dates',
      `${formatGoogleDate(dateObj)}/${formatGoogleDate(endDateObj)}`
    );
    gCalUrl.searchParams.append(
      'details',
      `Kajian Daring / Live Streaming\nPemateri: ${session.speaker_name}\nLink Siaran: ${streamUrl || '-'}\n\nDitemukan via Peta Kajian.`
    );
    gCalUrl.searchParams.append('location', 'Online / Live Streaming');
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

  const handleShare = () => {
    shareSessionNative(session, () => {
      setIsShareModalOpen(true);
    });
  };

  return (
    <div 
      className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Studio Showcase Card */}
      <div 
        className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-surface-container-high/70 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poster Header (Jika ada) - Klik untuk membuka Preview Modal */}
        {hasPoster ? (
          <div
            onClick={() => setIsPreviewModalOpen(true)}
            className="w-full h-48 sm:h-56 bg-slate-900 relative shrink-0 overflow-hidden cursor-pointer group"
            title="Klik untuk melihat poster penuh & detail kajian"
          >
            <img
              src={session.poster_url}
              alt={session.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Hover Zoom Indicator */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-semibold text-xs pointer-events-none">
              <span className="material-symbols-outlined text-[20px]">zoom_in</span>
              <span>Klik untuk Perbesar Poster & Detail</span>
            </div>

            {/* Close Button Absolute */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-colors shadow-md z-10 cursor-pointer"
              title="Tutup & Kembali ke Peta"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {/* Live Indicator on Poster */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-none">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow-md ${
                isLive ? 'bg-red-600 animate-pulse' : 'bg-red-700/90'
              }`}>
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                {isLive ? 'Sedang Live' : platformLabel}
              </span>
              <span className="text-[11px] font-semibold text-white/90 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-xs capitalize">
                {session.audience_type}
              </span>
            </div>
          </div>
        ) : (
          /* Header Banner tanpa poster */
          <div className="p-4 bg-gradient-to-r from-red-700 to-rose-600 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {isLive ? 'Sedang Live Sekarang' : 'Kajian Daring / Online'}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Tutup"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 no-scrollbar">
          {/* Header Badges & Actions Row (Disamping Kategori) */}
          <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/60 gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-semibold">
                <span className="material-symbols-outlined text-[16px]">{platformIcon}</span>
                <span>Siaran Daring</span>
              </span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container px-2 py-0.5 rounded-full border border-surface-container-high">
                {session.audience_type}
              </span>

              {/* Toggle Pengingat Notifikasi Tepat di Samping Kategori */}
              <NotificationReminderToggle sessionId={session.id} variant="inline" />
            </div>

            {/* Quick Actions: Bookmark & Share */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(session.id, session);
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  bookmarked
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'
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
                  handleShare();
                }}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors cursor-pointer"
                title="Bagikan Info Kajian"
              >
                <span className="material-symbols-outlined text-[14px]">share</span>
              </button>
            </div>
          </div>

          <div>
            <h2 
              onClick={() => setIsPreviewModalOpen(true)}
              className="text-base sm:text-lg font-bold text-on-surface leading-snug hover:text-primary transition-colors cursor-pointer"
              title="Klik untuk membuka detail kajian"
            >
              {session.title}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-primary mt-1">
              {session.speaker_name}
            </p>

            {hasPoster && (
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold mt-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">open_in_full</span>
                <span>Buka Poster Penuh & Info Lengkap</span>
              </button>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="p-3 rounded-2xl bg-surface-container-low/80 border border-surface-container-high/60 space-y-2 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-outline text-[18px] shrink-0 mt-0.5">
                calendar_month
              </span>
              <div>
                <p className="font-semibold text-on-surface">{dateStr}</p>
                {timeStr && <p className="text-outline text-[11px]">{timeStr}</p>}
              </div>
            </div>

            {session.book_title && session.book_title !== 'null' && (
              <div className="flex items-start gap-2.5 pt-1.5 border-t border-surface-container-high/40">
                <span className="material-symbols-outlined text-outline text-[18px] shrink-0 mt-0.5">
                  menu_book
                </span>
                <p className="text-on-surface-variant font-medium">{session.book_title}</p>
              </div>
            )}
          </div>

          {/* Kehadiran Jamaah (RSVP) */}
          <div className="p-2 px-3 rounded-2xl bg-surface-container/60 border border-surface-container-high/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant min-w-0">
              <span className="material-symbols-outlined text-[17px] text-primary shrink-0">groups</span>
              <span className="truncate">
                <strong className="text-on-surface font-semibold">{totalAttendees}</strong> Jamaah hadir
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleAttendance}
              className={`shrink-0 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer flex items-center gap-1 border ${
                attending
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-surface-container-lowest text-primary hover:bg-primary/10 border-primary/30'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">
                {attending ? 'check_circle' : 'how_to_reg'}
              </span>
              <span>{attending ? 'Saya Hadir' : 'Insya Allah Hadir'}</span>
            </button>
          </div>

          {/* Primary CTA: Watch Live Button */}
          {streamUrl ? (() => {
            const ytId = extractYouTubeVideoId(streamUrl);
            return (
              <div className="space-y-1.5 pt-0.5">
                {ytId ? (
                  <button
                    type="button"
                    onClick={() => {
                      playStream({
                        videoId: ytId,
                        title: session.title,
                        speakerName: session.speaker_name,
                        channelName: session.venues?.name || session.speaker_name,
                      });
                    }}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-red-600/25 hover:shadow-red-600/40 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">play_circle</span>
                    <span>Tonton di Pemutar Mengambang</span>
                    <span className="material-symbols-outlined text-[16px] opacity-80">picture_in_picture_alt</span>
                  </button>
                ) : (
                  <a
                    href={streamUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-red-600/25 hover:shadow-red-600/40 transition-all active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[20px]">play_circle</span>
                    <span>Buka & Tonton {platformLabel}</span>
                    <span className="material-symbols-outlined text-[15px] opacity-75">open_in_new</span>
                  </a>
                )}
                {ytId ? (
                  <div className="flex items-center justify-between px-2 text-[10px] text-outline">
                    <span className="truncate max-w-[170px] sm:max-w-[200px]">Tautan: {streamUrl}</span>
                    <a
                      href={streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-0.5 text-primary hover:underline ml-2 font-medium"
                    >
                      <span>Buka Web YouTube</span>
                      <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                    </a>
                  </div>
                ) : (
                  <p className="text-[10px] text-center text-outline truncate px-2">
                    Tautan: {streamUrl}
                  </p>
                )}
              </div>
            );
          })() : (
            <div className="p-3 bg-surface-container rounded-xl text-center text-xs text-outline">
              Tautan siaran langsung belum dicantumkan oleh kontributor.
            </div>
          )}

          {/* Secondary Actions */}
          <div className="flex items-center gap-2 pt-1">
            {hasDate && (
              <a
                href={gCalUrl.toString()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 rounded-xl border border-surface-container-high hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">event_available</span>
                <span>Simpan Kalender</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-surface-container-high hover:bg-surface-container text-outline text-xs font-semibold transition-colors cursor-pointer"
            >
              Kembali ke Peta
            </button>
          </div>
        </div>
      </div>

      {/* Full Preview Modal */}
      <KajianPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        session={session}
      />

      {/* Share Modal Fallback */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        session={session}
      />
    </div>
  );
}
