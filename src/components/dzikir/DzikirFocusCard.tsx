'use client';

import React, { useCallback, useMemo } from 'react';
import type { DzikirItem } from '@/data/dzikirData';

interface DzikirFocusCardProps {
  item: DzikirItem;
  currentIndex: number;
  totalItems: number;
  currentCount: number;
  isCompleted: boolean;
  onIncrement: () => void;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  arabicFontSize: 'normal' | 'large' | 'xlarge';
  showLatin: boolean;
}

export default function DzikirFocusCard({
  item,
  currentIndex,
  totalItems,
  currentCount,
  isCompleted,
  onIncrement,
  onReset,
  onPrev,
  onNext,
  arabicFontSize,
  showLatin,
}: DzikirFocusCardProps) {
  // Hitung persentase progress untuk SVG circle ring
  const percentage = useMemo(() => {
    return Math.min(100, Math.round((currentCount / item.targetCount) * 100));
  }, [currentCount, item.targetCount]);

  // Radius & circumference untuk progress circle
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Ukuran font Arab
  const arabicTextClass = useMemo(() => {
    switch (arabicFontSize) {
      case 'xlarge':
        return 'text-2xl sm:text-3xl leading-[2.6] sm:leading-[2.8]';
      case 'large':
        return 'text-xl sm:text-2xl leading-[2.3] sm:leading-[2.5]';
      case 'normal':
      default:
        return 'text-lg sm:text-xl leading-[2.1] sm:leading-[2.3]';
    }
  }, [arabicFontSize]);

  // Handle tap with haptic
  const handleTap = useCallback(() => {
    onIncrement();
  }, [onIncrement]);

  return (
    <div className="w-full flex flex-col items-center max-w-2xl mx-auto space-y-4">
      {/* Header Info & Progress Bar */}
      <div className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>
            Dzikir {currentIndex + 1} dari {totalItems}
          </span>
        </span>
        <span className="px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/60 font-mono text-[11px]">
          Target: {item.targetCount}x
        </span>
      </div>

      {/* Main Focus Card */}
      <div className="w-full bg-surface border border-outline-variant/60 shadow-md rounded-2xl sm:rounded-3xl p-4 sm:p-7 flex flex-col justify-between relative overflow-hidden transition-all">
        {/* Judul & Badge Waktu */}
        <div className="flex items-start justify-between gap-2 border-b border-outline-variant/40 pb-3">
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm sm:text-base text-on-surface truncate">
              {item.title}
            </h3>
            <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5">
              {item.narrator}
            </p>
          </div>

          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
              isCompleted
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {isCompleted ? '✓ Selesai' : `${currentCount}/${item.targetCount}`}
          </span>
        </div>

        {/* Teks Bacaan Arab */}
        <div className="my-5 text-right" dir="rtl">
          <p
            className={`font-serif text-on-surface selection:bg-emerald-500/25 ${arabicTextClass}`}
          >
            {item.arabic}
          </p>
        </div>

        {/* Transliterasi Latin (Opsional) */}
        {showLatin && item.transliteration && (
          <div className="mb-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant italic leading-relaxed">
            {item.transliteration}
          </div>
        )}

        {/* Terjemahan Bahasa Indonesia */}
        <div className="border-t border-outline-variant/30 pt-3">
          <p className="text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-line font-medium">
            {item.translation}
          </p>
        </div>

        {/* Kotak Faedah & Keutamaan */}
        {item.faedah && (
          <div className="mt-4 p-3 rounded-xl sm:rounded-2xl bg-emerald-600/5 dark:bg-emerald-950/40 border border-emerald-500/20 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              lightbulb
            </span>
            <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed">
              <span className="font-bold text-emerald-700 dark:text-emerald-300">Faedah: </span>
              {item.faedah}
            </p>
          </div>
        )}
      </div>

      {/* AREA TASBIH DIGITAL INTERAKTIF (COUNTER TOUCH BUTTON) */}
      <div className="w-full flex items-center justify-between gap-3 pt-2">
        {/* Tombol Sebelumnya */}
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="flex-1 py-3 px-3 rounded-2xl bg-surface border border-outline-variant/60 hover:bg-surface-container text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        {/* Tombol Tasbih Bulat Utama */}
        <button
          type="button"
          onClick={handleTap}
          disabled={isCompleted}
          className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer select-none shrink-0 ${
            isCompleted
              ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-4 ring-emerald-500/20'
              : 'bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-emerald-700/25'
          }`}
          aria-label={`Hitung bacaan, saat ini ${currentCount} dari ${item.targetCount}`}
        >
          {/* SVG Progress Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r={radius}
              className="text-white/20 stroke-current"
              strokeWidth="5"
              fill="transparent"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              className="text-white stroke-current transition-all duration-150 ease-out"
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {isCompleted ? (
            <span className="material-symbols-outlined text-[36px] sm:text-[42px] animate-in zoom-in-75 duration-200">
              check
            </span>
          ) : (
            <>
              <span className="text-xl sm:text-2xl font-black font-mono leading-none">
                {currentCount}
              </span>
              <span className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider mt-1">
                / {item.targetCount}x
              </span>
            </>
          )}
        </button>

        {/* Tombol Selanjutnya / Selesai */}
        <button
          type="button"
          onClick={onNext}
          disabled={currentIndex === totalItems - 1}
          className="flex-1 py-3 px-3 rounded-2xl bg-surface border border-outline-variant/60 hover:bg-surface-container text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <span className="hidden sm:inline">Selanjutnya</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>

      {/* Tombol Reset Counter untuk Dzikir Ini */}
      {currentCount > 0 && !isCompleted && (
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-bold text-on-surface-variant hover:text-red-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">refresh</span>
          <span>Ulangi hitungan dzikir ini</span>
        </button>
      )}
    </div>
  );
}
