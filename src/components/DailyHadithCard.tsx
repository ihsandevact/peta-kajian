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
    const shareText = `*Renungan Harian — Peta Kajian Indonesia*\n\n"${hadith.translation}"\n\n_${hadith.narrator}_\n\n📲 Temukan jadwal kajian sunnah & direktori masjid di: https://petakajian.id`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  }, [hadith]);

  return (
    <section aria-labelledby="renungan-harian-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2
          id="renungan-harian-heading"
          className="text-[18px] font-extrabold text-on-surface tracking-tight"
        >
          Renungan harian
        </h2>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest border border-outline-variant/25 p-4 sm:p-5 shadow-2xs">
        {/* Baris Atas: Topik & Ikon Aksi Kecil Netral */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="px-2.5 py-1 rounded-full bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 text-[12px] font-bold truncate">
            {hadith.topic}
          </span>

          {/* Tombol Aksi Ikon Kecil (Touch target 44x44px, tanpa tombol hijau mencolok) */}
          <div className="flex items-center gap-0.5 -mr-1.5 shrink-0">
            <button
              type="button"
              onClick={handleShuffle}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer active:scale-95"
              title="Ganti hadits lain"
              aria-label="Ganti hadits lain"
            >
              <span
                className={`material-symbols-outlined text-[19px] transition-transform duration-200 ${
                  isFading ? 'rotate-180' : ''
                }`}
              >
                shuffle
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
                copied
                  ? 'text-[#126947] dark:text-emerald-400 bg-[#e4eee8]/60 dark:bg-emerald-950/50'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              title={copied ? 'Tersalin ke clipboard' : 'Salin kutipan hadits'}
              aria-label="Salin kutipan hadits"
            >
              <span className="material-symbols-outlined text-[19px]">
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer active:scale-95"
              title="Bagikan hadits"
              aria-label="Bagikan hadits"
            >
              <span className="material-symbols-outlined text-[19px]">share</span>
            </button>
          </div>
        </div>

        {/* Konten Hadits dengan Tipografi Serif */}
        <div
          className={`transition-opacity duration-150 ${
            isFading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {hadith.arabic && (
            <p
              dir="rtl"
              className="font-serif text-[18px] text-right text-on-surface leading-loose mb-2.5 selection:bg-emerald-500/20"
            >
              {hadith.arabic}
            </p>
          )}

          <blockquote className="font-serif text-[16px] text-on-surface leading-relaxed italic">
            &ldquo;{hadith.translation}&rdquo;
          </blockquote>

          <p className="text-[12px] font-semibold text-on-surface-variant mt-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#126947] dark:bg-emerald-400 shrink-0" />
            <span>{hadith.narrator}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
