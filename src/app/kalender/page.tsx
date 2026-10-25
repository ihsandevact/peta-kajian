'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getHijriDate,
  getMonthCalendarCells,
  type CalendarDayCell,
  type HijriDate,
} from '@/utils/hijri';
import HijriCalendarGrid from '@/components/kalender/HijriCalendarGrid';
import ThemeToggle from '@/components/ThemeToggle';

export default function KalenderPage() {
  const router = useRouter();

  // Waktu saat ini
  const today = useMemo(() => new Date(), []);

  // State navigasi bulan kalender
  const [year, setYear] = useState<number>(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState<number>(today.getMonth()); // 0 = Jan

  // Koreksi hilal (±1 atau ±2 hari)
  const [adjustmentDays, setAdjustmentDays] = useState<number>(0);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);

  // Filter cepat jenis puasa
  const [fastingFilter, setFastingFilter] = useState<'all' | 'ayyamul_bidh' | 'senin_kamis' | 'khusus'>('all');

  // Tanggal yang sedang dipilih untuk melihat rincian
  const [selectedCell, setSelectedCell] = useState<CalendarDayCell | null>(null);

  // Muat koreksi hilal dari localStorage saat awal
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pk_hijri_adjustment');
      if (saved !== null) {
        setAdjustmentDays(parseInt(saved, 10) || 0);
      }
    } catch {}
  }, []);

  // Simpan koreksi hilal
  const handleSetAdjustment = useCallback((days: number) => {
    setAdjustmentDays(days);
    try {
      localStorage.setItem('pk_hijri_adjustment', String(days));
    } catch {}
    setIsAdjustModalOpen(false);
  }, []);

  // Navigasi bulan
  const handlePrevMonth = () => {
    if (monthIndex === 0) {
      setYear((y) => y - 1);
      setMonthIndex(11);
    } else {
      setMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (monthIndex === 11) {
      setYear((y) => y + 1);
      setMonthIndex(0);
    } else {
      setMonthIndex((m) => m + 1);
    }
  };

  const handleResetToToday = () => {
    setYear(today.getFullYear());
    setMonthIndex(today.getMonth());
  };

  // Data sel kalender bulan berjalan
  const cells = useMemo(() => {
    return getMonthCalendarCells(year, monthIndex, adjustmentDays);
  }, [year, monthIndex, adjustmentDays]);

  // Tanggal Hijriyah hari ini
  const todayHijri: HijriDate = useMemo(() => {
    return getHijriDate(today, adjustmentDays);
  }, [today, adjustmentDays]);

  // Tanggal Hijriyah besok (untuk pengingat sahur)
  const tomorrowHijri: HijriDate = useMemo(() => {
    const tom = new Date(today);
    tom.setDate(tom.getDate() + 1);
    return getHijriDate(tom, adjustmentDays);
  }, [today, adjustmentDays]);

  // Format nama bulan Masehi yang sedang dibuka
  const monthNamesId = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const currentMonthLabel = `${monthNamesId[monthIndex]} ${year}`;

  // Bulan Hijriyah yang mencakup bulan Masehi ini
  const hijriMonthsInView = useMemo(() => {
    const currentMonthCells = cells.filter((c) => c.isCurrentMonth);
    const months = new Set(currentMonthCells.map((c) => `${c.hijri.monthName} ${c.hijri.year} H`));
    return Array.from(months).join(' – ');
  }, [cells]);

  // Daftar agenda puasa di bulan yang sedang dibuka
  const monthlyFastingDays = useMemo(() => {
    return cells.filter((c) => c.isCurrentMonth && c.hijri.fastingInfo && !c.hijri.fastingInfo.isForbidden);
  }, [cells]);

  // Default tanggal terpilih saat load adalah hari ini
  useEffect(() => {
    const todayCell = cells.find((c) => c.isToday);
    if (todayCell && !selectedCell) {
      setSelectedCell(todayCell);
    }
  }, [cells, selectedCell]);

  return (
    <div className="min-h-screen bg-background text-on-surface font-geist flex flex-col pb-[calc(76px+env(safe-area-inset-bottom,16px))] md:pb-12">
      {/* 1. TOP NAVBAR HEADER */}
      <header className="sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b border-outline-variant/40 transition-colors">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Tombol Kembali & Judul */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/');
                }
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 cursor-pointer transition-colors shrink-0"
              aria-label="Kembali"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-on-surface truncate">
                Kalender Hijriyah &amp; Puasa
              </h1>
              <p className="text-[10px] sm:text-xs text-emerald-700 dark:text-emerald-400 font-bold leading-none truncate">
                Penanggalan Islam &amp; Jadwal Sunnah
              </p>
            </div>
          </div>

          {/* Action Toolbar Kanan (Koreksi Hilal & Theme) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-xs font-bold text-on-surface flex items-center gap-1 transition-colors cursor-pointer"
              title="Koreksi Tanggal Hilal (Rukyat)"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span className="text-[10px] font-mono">
                {adjustmentDays > 0 ? `+${adjustmentDays}` : adjustmentDays} hr
              </span>
            </button>
            <ThemeToggle variant="icon" size="sm" />
          </div>
        </div>
      </header>

      {/* 2. HERO CARD: STATUS TANGGAL HARI INI & PENGINGAT PUASA */}
      <section className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 pb-2">
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 text-white shadow-md relative overflow-hidden">
          {/* Ornamen Bulan Sabit */}
          <div className="absolute right-3 top-3 text-white/10 pointer-events-none">
            <span className="material-symbols-outlined text-[72px]">dark_mode</span>
          </div>

          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] sm:text-[11px] font-extrabold backdrop-blur-xs">
                Hari Ini
              </span>
              <span className="text-xs text-emerald-100 font-medium">
                {today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {todayHijri.formatted}
              </h2>
              {todayHijri.isHaramMonth && (
                <p className="text-[11px] text-amber-300 font-bold mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">star</span>
                  Termasuk Bulan Haram (Asyhurul Hurum) yang dimuliakan Allah
                </p>
              )}
            </div>

            {/* Status Puasa Hari Ini / Besok */}
            {todayHijri.fastingInfo && !todayHijri.fastingInfo.isForbidden ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-400/20 border border-amber-300/30 text-xs font-bold text-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Hari Ini Disunnahkan: <strong>{todayHijri.fastingInfo.label}</strong></span>
              </div>
            ) : tomorrowHijri.fastingInfo && !tomorrowHijri.fastingInfo.isForbidden ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/15 border border-white/20 text-xs font-bold text-emerald-100">
                <span className="material-symbols-outlined text-[16px] text-amber-300">alarm</span>
                <span>Besok: <strong>{tomorrowHijri.fastingInfo.label}</strong> (Persiapkan Sahur)</span>
              </div>
            ) : (
              <p className="text-xs text-emerald-100/90 leading-relaxed">
                Manfaatkan hari untuk memperbanyak dzikir, istighfar, dan amalan sunnah.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 3. TOOLBAR NAVIGASI BULAN & FILTER PUASA */}
      <section className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-2 space-y-3">
        {/* Navigasi Bulan Masehi & Hijriyah */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-surface border border-outline-variant/60 shadow-xs">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/50 transition-colors cursor-pointer"
            aria-label="Bulan sebelumnya"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>

          <div className="text-center min-w-0">
            <h3 className="font-extrabold text-xs sm:text-sm text-on-surface truncate">
              {currentMonthLabel}
            </h3>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold truncate">
              {hijriMonthsInView}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleResetToToday}
              className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-[11px] font-bold text-on-surface border border-outline-variant/50 transition-colors cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/50 transition-colors cursor-pointer"
              aria-label="Bulan berikutnya"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Filter Cepat Jenis Puasa */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setFastingFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              fastingFilter === 'all'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/50'
            }`}
          >
            Semua Hari
          </button>
          <button
            type="button"
            onClick={() => setFastingFilter('ayyamul_bidh')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              fastingFilter === 'ayyamul_bidh'
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Ayyamul Bidh (13-15)</span>
          </button>
          <button
            type="button"
            onClick={() => setFastingFilter('senin_kamis')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              fastingFilter === 'senin_kamis'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Senin &amp; Kamis</span>
          </button>
          <button
            type="button"
            onClick={() => setFastingFilter('khusus')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              fastingFilter === 'khusus'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Puasa Khusus (Arafah/Asyura/Syawwal)</span>
          </button>
        </div>
      </section>

      {/* 4. GRID KALENDER HIJRIYAH TERPADU */}
      <main className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-1 pb-6 space-y-4 flex-1">
        <HijriCalendarGrid
          cells={cells}
          selectedDate={selectedCell?.date || null}
          onSelectDate={(cell) => setSelectedCell(cell)}
          fastingFilter={fastingFilter}
        />

        {/* 5. KARTU DETAIL TANGGAL TERPILIH */}
        {selectedCell && (
          <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-outline-variant/60 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">
                  Detail Tanggal Terpilih
                </span>
                <h4 className="text-base sm:text-lg font-black text-on-surface">
                  {selectedCell.date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h4>
                <p className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {selectedCell.hijri.formatted}
                </p>
              </div>

              {selectedCell.hijri.fastingInfo && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold border shrink-0 ${
                    selectedCell.hijri.fastingInfo.isForbidden
                      ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
                      : 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {selectedCell.hijri.fastingInfo.label}
                </span>
              )}
            </div>

            {/* Keterangan Puasa & Dalil */}
            {selectedCell.hijri.fastingInfo ? (
              <div className="space-y-1.5">
                <p className="text-xs text-on-surface leading-relaxed italic">
                  "{selectedCell.hijri.fastingInfo.dalil}"
                </p>
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  — {selectedCell.hijri.fastingInfo.source}
                </p>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Hari biasa dalam kalender Islam. Dianjurkan memperbanyak amalan shalih, sholat berjamaah, dan dzikir harian.
              </p>
            )}
          </div>
        )}

        {/* 6. DAFTAR AGENDA PUASA BULAN INI (LIST VIEW) */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-outline">
              Agenda Puasa Sunnah Bulan Ini ({monthlyFastingDays.length} Hari)
            </h4>
          </div>

          {monthlyFastingDays.length === 0 ? (
            <div className="p-4 rounded-2xl bg-surface border border-outline-variant/40 text-center text-xs text-on-surface-variant">
              Tidak ada jadwal puasa sunnah di bulan ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {monthlyFastingDays.map((c) => (
                <button
                  key={c.date.toISOString()}
                  type="button"
                  onClick={() => setSelectedCell(c)}
                  className="p-3 rounded-2xl bg-surface hover:bg-surface-container-low border border-outline-variant/50 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-on-surface group-hover:text-emerald-600 transition-colors">
                        {c.date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-mono">
                        ({c.hijri.day} {c.hijri.monthName})
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 truncate mt-0.5">
                      {c.hijri.fastingInfo?.label}
                    </p>
                  </div>

                  <span className="material-symbols-outlined text-[16px] text-outline group-hover:translate-x-0.5 transition-transform shrink-0">
                    chevron_right
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 7. EDUKASI FIKIH NIAT PUASA SUNNAH */}
        <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-outline-variant/60 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <span className="material-symbols-outlined text-[20px]">menu_book</span>
            <h4 className="font-extrabold text-xs sm:text-sm">Fikih &amp; Keutamaan Puasa Sunnah</h4>
          </div>
          <p className="text-on-surface leading-relaxed">
            <strong>Kaidah Niat:</strong> Berbeda dengan puasa wajib Ramadhan yang niatnya harus ditetapkan sebelum fajar (mabitun niyah), niat puasa sunnah <strong>boleh dilakukan di pagi atau siang hari sebelum tergelincir matahari (zawal)</strong>, dengan syarat belum makan, minum, atau melakukan pembatal puasa sejak shubuh.
          </p>
          <p className="text-on-surface-variant leading-relaxed">
            Niat bertempat di dalam hati dan tidak disyaratkan untuk dilafadzkan secara lisan.
          </p>
        </div>
      </main>

      {/* 8. MODAL KOREKSI HILAL / RUKYAT */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-3xl border border-outline-variant/60 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-on-surface">
                  Koreksi Tanggal Hijriyah
                </h3>
                <p className="text-[10px] sm:text-xs text-on-surface-variant">
                  Sesuaikan hisab dengan pengumuman rukyatul hilal lokal
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {[-2, -1, 0, 1, 2].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleSetAdjustment(d)}
                  className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    adjustmentDays === d
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/40'
                  }`}
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Pilihan default adalah <strong>0 hari</strong> (Hisnab Ummul Qura). Gunakan <strong>+1</strong> atau <strong>-1</strong> jika terdapat perbedaan 1 hari pada penetapan awal bulan hijriyah di wilayah Anda.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
