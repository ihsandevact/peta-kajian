'use client';

import React from 'react';
import type { CalendarDayCell, FastingType } from '@/utils/hijri';

interface HijriCalendarGridProps {
  cells: CalendarDayCell[];
  selectedDate: Date | null;
  onSelectDate: (cell: CalendarDayCell) => void;
  fastingFilter: 'all' | 'ayyamul_bidh' | 'senin_kamis' | 'khusus';
}

const DAY_NAMES = [
  { short: 'Ahd', full: 'Ahad' },
  { short: 'Sen', full: 'Senin' },
  { short: 'Sel', full: 'Selasa' },
  { short: 'Rab', full: 'Rabu' },
  { short: 'Kam', full: 'Kamis' },
  { short: 'Jum', full: "Jum'at" },
  { short: 'Sab', full: 'Sabtu' },
];

export default function HijriCalendarGrid({
  cells,
  selectedDate,
  onSelectDate,
  fastingFilter,
}: HijriCalendarGridProps) {
  const isSameDay = (d1: Date, d2: Date | null) => {
    if (!d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Cek apakah puasa pada sel ini sesuai dengan filter yang aktif
  const isFastingMatchFilter = (type?: FastingType) => {
    if (!type) return false;
    if (fastingFilter === 'all') return true;
    if (fastingFilter === 'ayyamul_bidh') return type === 'ayyamul_bidh';
    if (fastingFilter === 'senin_kamis') return type === 'senin_kamis';
    if (fastingFilter === 'khusus') {
      return ['arafah', 'tarwiyah', 'asyura', 'tasua', 'syawal'].includes(type);
    }
    return false;
  };

  return (
    <div className="w-full bg-surface border border-outline-variant/60 rounded-3xl p-3 sm:p-5 shadow-xs select-none">
      {/* 1. HEADER NAMA HARI (7 KOLOM) */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
        {DAY_NAMES.map((day, idx) => (
          <div
            key={day.full}
            className={`py-1 text-xs font-black uppercase tracking-wider ${
              idx === 0
                ? 'text-red-600 dark:text-red-400'
                : idx === 5
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-on-surface-variant'
            }`}
          >
            <span className="hidden sm:inline">{day.full}</span>
            <span className="sm:hidden">{day.short}</span>
          </div>
        ))}
      </div>

      {/* 2. GRID SEL TANGGAL (MASEHI & HIJRIYAH + BADGE PUASA) */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {cells.map((cell) => {
          const isSelected = isSameDay(cell.date, selectedDate);
          const hasFasting = Boolean(cell.hijri.fastingInfo);
          const matchesFilter = isFastingMatchFilter(cell.hijri.fastingInfo?.type);
          const isHighlightedFasting = hasFasting && matchesFilter;

          // Label singkatan puasa untuk tampilan mobile & desktop
          let fastingShortLabel = '';
          let badgeColorClass = '';

          if (cell.hijri.fastingInfo) {
            const { type, isForbidden } = cell.hijri.fastingInfo;
            if (isForbidden) {
              fastingShortLabel = 'Haram';
              badgeColorClass = 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30';
            } else if (type === 'ayyamul_bidh') {
              fastingShortLabel = 'Bidh';
              badgeColorClass = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
            } else if (type === 'senin_kamis') {
              fastingShortLabel = cell.date.getDay() === 1 ? 'Senin' : 'Kamis';
              badgeColorClass = 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
            } else if (type === 'arafah') {
              fastingShortLabel = 'Arafah';
              badgeColorClass = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
            } else if (type === 'asyura' || type === 'tasua') {
              fastingShortLabel = type === 'asyura' ? 'Asyura' : "Tasu'a";
              badgeColorClass = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
            } else if (type === 'syawal') {
              fastingShortLabel = 'Syawwal';
              badgeColorClass = 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
            } else if (type === 'tarwiyah') {
              fastingShortLabel = 'Dz-Hij';
              badgeColorClass = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
            }
          }

          return (
            <button
              key={cell.date.toISOString()}
              type="button"
              onClick={() => onSelectDate(cell)}
              className={`min-h-[72px] sm:min-h-[92px] p-1.5 sm:p-2 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group ${
                cell.isCurrentMonth ? 'opacity-100' : 'opacity-30'
              } ${
                isSelected
                  ? 'bg-surface-container-high border-emerald-600 ring-2 ring-emerald-500/50 shadow-md'
                  : cell.isToday
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/40'
                  : isHighlightedFasting
                  ? 'bg-surface-container-low border-outline-variant/60 hover:border-emerald-500/40'
                  : 'bg-surface border-outline-variant/40 hover:bg-surface-container-low'
              }`}
            >
              {/* Baris Atas: Tanggal Masehi & Indikator Hari Ini */}
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] sm:text-xs font-semibold text-on-surface-variant font-mono">
                  {cell.dayNumber}
                </span>

                {cell.isToday && (
                  <span
                    className="relative flex h-2 w-2 shrink-0"
                    title="Hari Ini"
                    aria-label="Hari Ini"
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 dark:bg-emerald-400" />
                  </span>
                )}
              </div>

              {/* Baris Tengah: Tanggal Hijriyah Besar & Tebal */}
              <div className="my-auto text-center py-0.5">
                <span
                  className={`text-base sm:text-xl font-black tracking-tight ${
                    cell.isToday
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : isHighlightedFasting
                      ? 'text-on-surface'
                      : 'text-on-surface'
                  }`}
                >
                  {cell.hijri.day}
                </span>
                <span className="block text-[8px] sm:text-[10px] text-on-surface-variant font-medium truncate leading-none">
                  {cell.hijri.monthName}
                </span>
              </div>

              {/* Baris Bawah: Badge Puasa Sunnah Terpadu */}
              <div className="w-full mt-auto">
                {cell.hijri.fastingInfo && matchesFilter ? (
                  <div
                    className={`w-full text-center py-0.5 px-1 rounded-md text-[8px] sm:text-[10px] font-extrabold truncate border ${badgeColorClass}`}
                    title={cell.hijri.fastingInfo.label}
                  >
                    <span className="sm:hidden">{fastingShortLabel}</span>
                    <span className="hidden sm:inline">{fastingShortLabel}</span>
                  </div>
                ) : (
                  <div className="h-3 sm:h-4" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
