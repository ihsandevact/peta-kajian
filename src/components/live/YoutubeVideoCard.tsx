'use client';

import React, { useState } from 'react';
import { ChannelVerifiedBadge } from './ChannelVerifiedBadge';

export interface YoutubeVideoCardProps {
  videoId: string;
  title: string;
  channelName: string;
  channelHandle?: string;
  avatarUrl?: string;
  speakerName?: string;
  isLive?: boolean;
  timeText?: string;
  onWatch: () => void;
  onOpenStudyMode?: () => void;
  onShare?: () => void;
  className?: string;
}

export default function YoutubeVideoCard({
  videoId,
  title,
  channelName,
  channelHandle,
  avatarUrl,
  speakerName,
  isLive = false,
  timeText,
  onWatch,
  onOpenStudyMode,
  onShare,
  className = '',
}: YoutubeVideoCardProps) {
  const [imgError, setImgError] = useState(false);
  const posterUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div className={`group flex flex-col gap-2.5 font-geist select-none ${className}`}>
      {/* 1. THUMBNAIL 16:9 DENGAN HOVER EFFECT & STATUS BADGES */}
      <div
        onClick={onWatch}
        className="relative aspect-video w-full rounded-2xl overflow-hidden bg-surface-container cursor-pointer shadow-xs group-hover:shadow-md transition-all duration-300 group-hover:-translate-y-0.5"
      >
        {!imgError ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex flex-col items-center justify-center p-4 text-center">
            <span className="material-symbols-outlined text-3xl text-neutral-500 mb-1">
              smart_display
            </span>
            <span className="text-xs text-neutral-400 font-medium line-clamp-1">{channelName}</span>
          </div>
        )}

        {/* Hover Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
            <span className="material-symbols-outlined text-[24px]">play_arrow</span>
          </div>
        </div>

        {/* Badge Status (Pojok Kanan Bawah Khas YouTube) */}
        <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
          {isLive ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-black uppercase tracking-wider shadow-md animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>LIVE</span>
            </div>
          ) : timeText ? (
            <div className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-xs text-white text-[10px] font-semibold shadow-md">
              <span>{timeText}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 2. BARIS DETAIL: AVATAR SALURAN + INFORMASI TEKS */}
      <div className="flex items-start gap-2.5 px-0.5">
        {/* Avatar Saluran YouTube */}
        <div
          onClick={onWatch}
          className="w-9 h-9 rounded-full overflow-hidden bg-surface-container shrink-0 mt-0.5 border border-surface-container-high/60 cursor-pointer"
          title={channelName}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={channelName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-red-600/10 text-red-600 dark:text-red-400 font-bold flex items-center justify-center text-xs">
              {channelName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* Kolom Teks: Judul, Saluran, Pemateri, Status */}
        <div className="flex-1 min-w-0">
          {/* Judul Kajian 2 Baris */}
          <h3
            onClick={onWatch}
            className="font-bold text-xs sm:text-[13px] text-on-surface group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-2 leading-snug cursor-pointer"
            title={title}
          >
            {title}
          </h3>

          {/* Nama Saluran / Channel YouTube */}
          <p
            onClick={onWatch}
            className="text-[11px] text-on-surface-variant/90 font-medium mt-1 truncate hover:text-on-surface transition-colors cursor-pointer flex items-center gap-1"
          >
            <span className="truncate">{channelName}</span>
            <ChannelVerifiedBadge size="xs" />
          </p>

          {/* Pemateri & Waktu */}
          <div className="flex items-center gap-1 text-[11px] text-outline font-medium truncate mt-0.5">
            {speakerName && (
              <>
                <span className="truncate">{speakerName}</span>
                {timeText && !isLive && <span>•</span>}
              </>
            )}
            {timeText && !isLive && (
              <span className="shrink-0">{timeText}</span>
            )}
          </div>
        </div>

        {/* Quick Menu Actions (Muncul saat hover di desktop) */}
        {(onOpenStudyMode || onShare) && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 pt-0.5">
            {onOpenStudyMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenStudyMode();
                }}
                className="w-7 h-7 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-emerald-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Buka Mode Belajar / Catat Faidah"
              >
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
              </button>
            )}
            {onShare && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare();
                }}
                className="w-7 h-7 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                title="Bagikan Kajian"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
