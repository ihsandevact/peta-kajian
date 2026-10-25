'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { DAILY_HADITHS, type DailyHadith } from '@/data/dailyHadiths';

export default function DailyHadithCard() {
  // Hitung indeks hadits harian otomatis berdasarkan hari dalam tahun (Day of Year)
  const defaultIndex = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff =
      now.getTime() -
      start.getTime() +
      (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000;
    const day = Math.floor(diff / (1000 * 60 * 60 * 24));
    return Math.abs(day) % DAILY_HADITHS.length;
  }, []);

  const [currentIndex, setCurrentIndex] = useState<number>(defaultIndex);
  const [isFading, setIsFading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const hadith: DailyHadith = DAILY_HADITHS[currentIndex] || DAILY_HADITHS[0];

  // Ganti hadits secara acak dengan animasi halus
  const handleShuffle = useCallback(() => {
    setIsFading(true);
    setTimeout(() => {
      let nextIndex = Math.floor(Math.random() * DAILY_HADITHS.length);
      if (nextIndex === currentIndex && DAILY_HADITHS.length > 1) {
        nextIndex = (currentIndex + 1) % DAILY_HADITHS.length;
      }
      setCurrentIndex(nextIndex);
      setIsFading(false);
    }, 150);
  }, [currentIndex]);

  // Salin teks kutipan ke clipboard
  const handleCopy = useCallback(async () => {
    const textToCopy = `"${hadith.translation}"\n\n(${hadith.narrator})\n\n— Dikutip dari Peta Kajian Indonesia\nhttps://petakajian.id`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [hadith]);

  // Bagikan ke WhatsApp dengan format rapi
  const handleShareWhatsApp = useCallback(() => {
    const shareText = `*Mutiara Hadits — Peta Kajian Indonesia*\n\n"${hadith.translation}"\n\n_${hadith.narrator}_\n\n📲 Temukan jadwal kajian sunnah & direktori masjid di: https://petakajian.id`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  }, [hadith]);

  return (
    <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pb-4 sm:pb-6 w-full">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-600/10 via-surface to-surface-container-low/50 border border-emerald-500/25 p-3.5 sm:p-5 shadow-xs">
        {/* Dekorasi Watermark Kutipan di Latar Belakang */}
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[90px] sm:text-[130px] text-emerald-600/5 dark:text-emerald-400/5 absolute -right-3 -bottom-5 select-none pointer-events-none"
        >
          format_quote
        </span>

        {/* Baris Atas: Badge Topik & Tombol Interaktif */}
        <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3 relative z-10">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[15px] sm:text-[17px]">auto_stories</span>
            </div>
            <span className="text-[11px] sm:text-xs font-black text-on-surface tracking-tight uppercase">
              Mutiara Hadits
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-[10px] sm:text-[11px] font-extrabold truncate">
              {hadith.topic}
            </span>
          </div>

          {/* Tombol Aksi (Acak, Salin, Share WA) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Tombol Ganti Hadits / Shuffle */}
            <button
              type="button"
              onClick={handleShuffle}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg sm:rounded-xl bg-surface hover:bg-surface-container border border-outline-variant/60 text-on-surface-variant hover:text-on-surface text-[11px] font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
              title="Ganti Hadits Lain (Acak)"
            >
              <span
                className={`material-symbols-outlined text-[14px] sm:text-[16px] text-emerald-600 transition-transform ${
                  isFading ? 'rotate-180' : ''
                }`}
              >
                shuffle
              </span>
              <span className="hidden sm:inline">Acak</span>
            </button>

            {/* Tombol Salin */}
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg sm:rounded-xl border text-[11px] font-bold shadow-2xs transition-all cursor-pointer active:scale-95 ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-surface hover:bg-surface-container border-outline-variant/60 text-on-surface-variant hover:text-on-surface'
              }`}
              title="Salin Kutipan Hadits"
            >
              <span className="material-symbols-outlined text-[14px] sm:text-[16px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span className="hidden sm:inline">{copied ? 'Tersalin' : 'Salin'}</span>
            </button>

            {/* Tombol Bagikan ke WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg sm:rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
              title="Bagikan Hadits ke WhatsApp"
            >
              <span className="material-symbols-outlined text-[14px] sm:text-[16px]">share</span>
              <span className="hidden sm:inline">Bagikan</span>
            </button>
          </div>
        </div>

        {/* Konten Hadits */}
        <div
          className={`relative z-10 transition-opacity duration-150 ${
            isFading ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
          }`}
        >
          {/* Teks Arab (Jika ada) */}
          {hadith.arabic && (
            <p
              dir="rtl"
              className="font-serif text-sm sm:text-base text-right text-emerald-950 dark:text-emerald-200/90 leading-relaxed mb-1.5 selection:bg-emerald-500/30"
            >
              {hadith.arabic}
            </p>
          )}

          {/* Terjemahan */}
          <blockquote className="text-xs sm:text-sm font-medium text-on-surface leading-relaxed italic">
            &ldquo;{hadith.translation}&rdquo;
          </blockquote>

          {/* Perawi */}
          <p className="text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
            <span>{hadith.narrator}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
