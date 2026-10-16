'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { StudySession } from '@/lib/services/kajian';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StudySession | null;
}

/**
 * Format teks pesan kajian yang rapi untuk dibagikan ke WhatsApp, Telegram, dll.
 */
export function formatKajianShareText(session: StudySession, shareUrl: string): string {
  const lines: string[] = [
    `🕌 *Kajian: ${session.title}*`,
    `🎙 Pemateri: ${session.speaker_name}`,
  ];

  if (session.book_title && session.book_title.trim() !== '' && session.book_title.toLowerCase() !== 'null') {
    lines.push(`📖 Kitab: ${session.book_title}`);
  }

  if (session.start_datetime) {
    const d = new Date(session.start_datetime);
    const dateStr = d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    lines.push(`🗓 Waktu: ${dateStr} • ${timeStr} WIB`);
  } else if (session.recurring_pattern) {
    lines.push(`🗓 Jadwal Rutin: ${session.recurring_pattern}`);
  }

  if (session.venues?.name) {
    lines.push(`📍 Lokasi: ${session.venues.name}${session.venues.address ? `, ${session.venues.address}` : ''}`);
  } else if (session.is_online) {
    lines.push(`🌐 Disiarkan Online / Live Streaming`);
  }

  lines.push('');
  lines.push(`Lihat lokasi di peta & petunjuk rute:`);
  lines.push(shareUrl);

  return lines.join('\n');
}

/**
 * Helper untuk mencoba Web Share API (native mobile/desktop), atau fallback ke modal
 */
export async function shareSessionNative(
  session: StudySession,
  onFallback: () => void
) {
  if (typeof window === 'undefined') return;
  const shareUrl = `${window.location.origin}/?session=${session.id}`;
  const shareText = formatKajianShareText(session, shareUrl);

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: session.title,
        text: shareText,
        url: shareUrl,
      });
      return;
    } catch (err: any) {
      // Jika pengguna membatalkan (AbortError), abaikan saja
      if (err.name === 'AbortError') return;
      console.warn('Native share error, falling back to modal', err);
    }
  }

  // Jika Web Share API tidak didukung atau gagal, buka modal
  onFallback();
}

export default function ShareModal({ isOpen, onClose, session }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !session || !mounted) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/?session=${session.id}`;
  const shareText = formatKajianShareText(session, shareUrl);

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy link', e);
    }
  };

  const handleWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTwitter = () => {
    const tweetText = `Kajian: ${session.title} bersama ${session.speaker_name}. Info detail di Peta Kajian:`;
    const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twUrl, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 font-geist">
      <div
        className="w-full max-w-sm bg-surface-container-lowest rounded-3xl border border-surface-container-high/80 shadow-2xl p-5 flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">share</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">Bagikan Info Kajian</h3>
              <p className="text-[11px] text-outline">Ajak keluarga & rekan hadir di majelis ilmu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Ringkasan Kajian */}
        <div className="p-3 rounded-2xl bg-surface-container-low/60 border border-surface-container-high/50 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Kajian Terpilih</span>
          <p className="text-xs font-bold text-on-surface line-clamp-1">{session.title}</p>
          <p className="text-[11px] text-on-surface-variant line-clamp-1">{session.speaker_name}</p>
        </div>

        {/* Tombol Opsi Bagikan */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer active:scale-95 group"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">chat</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">WhatsApp</span>
          </button>

          {/* Telegram */}
          <button
            type="button"
            onClick={handleTelegram}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 border border-sky-200 dark:border-sky-800 transition-all cursor-pointer active:scale-95 group"
          >
            <div className="w-9 h-9 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">send</span>
            </div>
            <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300">Telegram</span>
          </button>

          {/* Twitter / X */}
          <button
            type="button"
            onClick={handleTwitter}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-surface-container-high transition-all cursor-pointer active:scale-95 group"
          >
            <div className="w-9 h-9 rounded-full bg-on-surface text-surface flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">tag</span>
            </div>
            <span className="text-[11px] font-bold text-on-surface">Twitter (X)</span>
          </button>
        </div>

        {/* Salin Tautan (Copy Link Box) */}
        <div className="flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-surface-container border border-surface-container-high">
          <span className="material-symbols-outlined text-[16px] text-outline shrink-0">link</span>
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="w-full text-xs text-on-surface bg-transparent outline-none truncate select-all"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-primary text-on-primary hover:bg-primary/90'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Tersalin' : 'Salin'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
