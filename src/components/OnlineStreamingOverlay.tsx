'use client';

import React, { useState } from 'react';
import type { StudySession } from '@/lib/services/kajian';

import { getEffectiveSessionInfo } from '@/utils/recurring';

interface OnlineStreamingOverlayProps {
  session: StudySession;
  onClose: () => void;
}

export default function OnlineStreamingOverlay({ session, onClose }: OnlineStreamingOverlayProps) {
  const [imgError, setImgError] = useState(false);

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

  return (
    <div 
      className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Studio Showcase Card */}
      <div 
        className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-surface-container-high/70 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poster Header (Jika ada) */}
        {hasPoster ? (
          <div className="w-full h-44 sm:h-52 bg-slate-900 relative shrink-0 overflow-hidden">
            <img
              src={session.poster_url}
              alt={session.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Close Button Absolute */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-colors shadow-md z-10"
              title="Tutup & Kembali ke Peta"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {/* Live Indicator on Poster */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
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
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
              title="Tutup"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mb-1">
              <span className="material-symbols-outlined text-[16px]">{platformIcon}</span>
              <span>Siaran Daring Tanpa Lokasi Fisik</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-on-surface leading-snug">
              {session.title}
            </h2>
            <p className="text-sm font-semibold text-primary mt-1">
              {session.speaker_name}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low/80 border border-surface-container-high/60 space-y-2 text-xs">
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

          {/* Primary CTA: Watch Live Button */}
          {streamUrl ? (
            <div className="space-y-2 pt-1">
              <a
                href={streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-red-600/25 hover:shadow-red-600/40 transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[22px]">play_circle</span>
                <span>Buka & Tonton {platformLabel}</span>
                <span className="material-symbols-outlined text-[16px] opacity-75">open_in_new</span>
              </a>
              <p className="text-[11px] text-center text-outline truncate px-2">
                Tautan: {streamUrl}
              </p>
            </div>
          ) : (
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
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-surface-container-high hover:bg-surface-container text-outline text-xs font-semibold transition-colors"
            >
              Kembali ke Peta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
