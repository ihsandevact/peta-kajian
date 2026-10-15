'use client';

import React, { useMemo } from 'react';
import {
  RecurringRule,
  DAY_NAMES,
  PRAYER_PRESETS,
  formatRecurringSummary,
  getNextOccurrence,
} from '@/utils/recurring';

interface RecurringRuleSelectorProps {
  isRecurring: boolean;
  setIsRecurring: (val: boolean) => void;
  rule: RecurringRule;
  setRule: React.Dispatch<React.SetStateAction<RecurringRule>>;
}

const CYCLE_OPTIONS = [
  { label: 'Setiap Pekan (Rekomendasi)', weeks: [1, 2, 3, 4, 5] },
  { label: 'Pekan ke-1 & ke-3', weeks: [1, 3] },
  { label: 'Pekan ke-2 & ke-4', weeks: [2, 4] },
  { label: 'Pekan ke-1 Saja', weeks: [1] },
  { label: 'Pekan ke-2 Saja', weeks: [2] },
  { label: 'Pekan ke-3 Saja', weeks: [3] },
  { label: 'Pekan ke-4 Saja', weeks: [4] },
];

export default function RecurringRuleSelector({
  isRecurring,
  setIsRecurring,
  rule,
  setRule,
}: RecurringRuleSelectorProps) {
  const summaryText = useMemo(() => formatRecurringSummary(rule), [rule]);
  const nextOcc = useMemo(() => getNextOccurrence(rule), [rule]);

  const nextOccFormatted = useMemo(() => {
    if (!nextOcc) return null;
    const d = nextOcc.nextDate;
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';
  }, [nextOcc]);

  const currentWeeksKey = (rule.weeks || [1, 2, 3, 4, 5]).join(',');

  return (
    <div className="flex flex-col gap-3.5 p-4 rounded-xl bg-surface-container-low border border-surface-container-high transition-all">
      {/* Checkbox Utama */}
      <label className="flex items-center gap-2.5 cursor-pointer w-max select-none">
        <input
          type="checkbox"
          name="is_recurring"
          value="true"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="w-4 h-4 rounded text-primary accent-primary"
        />
        <span className="text-sm font-semibold text-on-surface">Tandai sebagai Kajian Rutin Pekanan</span>
      </label>

      {/* Hidden inputs untuk diparsing saat submit form */}
      <input type="hidden" name="recurring_rule" value={isRecurring ? JSON.stringify(rule) : ''} />
      <input type="hidden" name="recurring_pattern" value={isRecurring ? summaryText : ''} />

      {isRecurring && (
        <div className="flex flex-col gap-4 mt-1 pt-3 border-t border-surface-container-high animate-in fade-in slide-in-from-top-2 duration-300">
          {/* 1. Pemilih Hari */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-on-surface">
              Hari Pelaksanaan <span className="text-error">*</span>
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {DAY_NAMES.map((name, index) => {
                const isActive = rule.dayOfWeek === index;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setRule((prev) => ({ ...prev, dayOfWeek: index }))}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg border transition-all text-center ${
                      isActive
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface-container-lowest border-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Pemilih Waktu / Shalat */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-on-surface">
              Waktu Kajian <span className="text-error">*</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRAYER_PRESETS.map((preset) => {
                const isSelected = rule.timeCategory === preset.category;
                return (
                  <button
                    key={preset.category}
                    type="button"
                    onClick={() =>
                      setRule((prev) => ({
                        ...prev,
                        timeCategory: preset.category,
                        time: preset.defaultTime,
                      }))
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-primary-container text-on-primary-container border-primary font-semibold'
                        : 'bg-surface-container-lowest border-surface-container-high text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-on-surface-variant">Jam Mulai Spesifik:</span>
              <input
                type="time"
                value={rule.time || '05:00'}
                onChange={(e) =>
                  setRule((prev) => ({
                    ...prev,
                    time: e.target.value,
                    timeCategory: 'custom',
                  }))
                }
                className="bg-surface-container-lowest border border-surface-container-high rounded-lg px-2.5 py-1 text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
              />
              <span className="text-xs text-outline">WIB</span>
            </div>
          </div>

          {/* 3. Siklus Pekan dalam Bulan */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-on-surface">
              Frekuensi Pekan dalam Sebulan
            </span>
            <select
              value={currentWeeksKey}
              onChange={(e) => {
                const selected = CYCLE_OPTIONS.find((opt) => opt.weeks.join(',') === e.target.value);
                if (selected) {
                  setRule((prev) => ({ ...prev, weeks: selected.weeks }));
                }
              }}
              className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
            >
              {CYCLE_OPTIONS.map((opt) => (
                <option key={opt.weeks.join(',')} value={opt.weeks.join(',')}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Live Preview Box */}
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-200 text-xs flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
              <span className="material-symbols-outlined text-[16px]">event_repeat</span>
              <span>{summaryText}</span>
            </div>
            {nextOccFormatted && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Sesi tayang terdekat:{' '}
                <strong className="underline decoration-emerald-500/40">{nextOccFormatted}</strong>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
