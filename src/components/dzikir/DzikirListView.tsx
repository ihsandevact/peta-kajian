'use client';

import React, { useMemo } from 'react';
import type { DzikirItem } from '@/data/dzikirData';

interface DzikirListViewProps {
  items: DzikirItem[];
  counts: Record<string, number>;
  onIncrement: (id: string, target: number) => void;
  onReset: (id: string) => void;
  arabicFontSize: 'normal' | 'large' | 'xlarge';
  showLatin: boolean;
}

export default function DzikirListView({
  items,
  counts,
  onIncrement,
  onReset,
  arabicFontSize,
  showLatin,
}: DzikirListViewProps) {
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

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {items.map((item, idx) => {
        const count = counts[item.id] || 0;
        const isCompleted = count >= item.targetCount;

        return (
          <div
            key={item.id}
            id={item.id}
            className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all ${
              isCompleted
                ? 'bg-surface border-emerald-500/40 shadow-xs'
                : 'bg-surface border-outline-variant/60 shadow-xs'
            }`}
          >
            {/* Header: Nomor, Judul & Badge Target */}
            <div className="flex items-start justify-between gap-2 border-b border-outline-variant/30 pb-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="w-6 h-6 rounded-full bg-surface-container text-on-surface-variant text-xs font-black flex items-center justify-center shrink-0 mt-0.5 font-mono">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm sm:text-base text-on-surface truncate">
                    {item.title}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5">
                    {item.narrator}
                  </p>
                </div>
              </div>

              {/* Counter Button Mini di Atas */}
              <button
                type="button"
                onClick={() => onIncrement(item.id, item.targetCount)}
                disabled={isCompleted}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shrink-0 ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white'
                }`}
              >
                {isCompleted ? (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span>Selesai ({item.targetCount}x)</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[15px]">touch_app</span>
                    <span className="font-mono">
                      {count} / {item.targetCount}x
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Teks Arab */}
            <div className="my-4 text-right" dir="rtl">
              <p
                className={`font-serif text-on-surface selection:bg-emerald-500/25 ${arabicTextClass}`}
              >
                {item.arabic}
              </p>
            </div>

            {/* Transliterasi Latin */}
            {showLatin && item.transliteration && (
              <div className="mb-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant italic leading-relaxed">
                {item.transliteration}
              </div>
            )}

            {/* Terjemahan */}
            <div className="border-t border-outline-variant/30 pt-3">
              <p className="text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-line font-medium">
                {item.translation}
              </p>
            </div>

            {/* Faedah */}
            {item.faedah && (
              <div className="mt-3.5 p-3 rounded-xl bg-emerald-600/5 dark:bg-emerald-950/40 border border-emerald-500/20 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                  lightbulb
                </span>
                <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">Faedah: </span>
                  {item.faedah}
                </p>
              </div>
            )}

            {/* Tombol Ulangi jika sedang berjalan */}
            {count > 0 && !isCompleted && (
              <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-end">
                <button
                  type="button"
                  onClick={() => onReset(item.id)}
                  className="text-[11px] font-bold text-on-surface-variant hover:text-red-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">refresh</span>
                  <span>Ulangi hitungan</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
