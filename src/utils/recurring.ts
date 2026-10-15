export interface RecurringRule {
  dayOfWeek: number; // 0 = Ahad, 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu
  time: string; // "HH:mm", e.g. "05:00", "18:30"
  timeCategory?: 'subuh' | 'dhuha' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya' | 'custom' | string;
  weeks: number[]; // [1, 2, 3, 4, 5] untuk setiap pekan, atau [1, 3], [2, 4], [1], dll.
  customNotes?: string;
}

export const DAY_NAMES = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

export const PRAYER_PRESETS: { category: string; label: string; defaultTime: string }[] = [
  { category: 'subuh', label: "Ba'da Subuh", defaultTime: '05:00' },
  { category: 'dhuha', label: 'Dhuha', defaultTime: '09:00' },
  { category: 'dzuhur', label: "Ba'da Dzuhur", defaultTime: '12:30' },
  { category: 'ashar', label: "Ba'da Ashar", defaultTime: '16:00' },
  { category: 'maghrib', label: "Ba'da Maghrib", defaultTime: '18:15' },
  { category: 'isya', label: "Ba'da Isya", defaultTime: '19:30' },
];

/**
 * Menghitung urutan kemunculan hari dalam sebulan (Pekan ke-1, ke-2, dst.)
 * Contoh: Ahad pertama di bulan Oktober = pekan 1, Ahad kedua = pekan 2.
 */
export function getWeekdayOccurrenceInMonth(date: Date): number {
  const day = date.getDay();
  let count = 0;
  for (let d = 1; d <= date.getDate(); d++) {
    const testDate = new Date(date.getFullYear(), date.getMonth(), d);
    if (testDate.getDay() === day) {
      count++;
    }
  }
  return count;
}

/**
 * Mencoba mem-parse teks bebas dari recurring_pattern lama (misal: "Setiap Ahad Subuh")
 * Menghasilkan objek RecurringRule terstruktur jika cocok.
 */
export function parseRecurringPattern(text?: string | null): RecurringRule | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // 1. Deteksi Hari
  let dayOfWeek = -1;
  if (lower.includes('ahad') || lower.includes('minggu')) dayOfWeek = 0;
  else if (lower.includes('senin')) dayOfWeek = 1;
  else if (lower.includes('selasa')) dayOfWeek = 2;
  else if (lower.includes('rabu')) dayOfWeek = 3;
  else if (lower.includes('kamis')) dayOfWeek = 4;
  else if (lower.includes('jumat') || lower.includes("jum'at")) dayOfWeek = 5;
  else if (lower.includes('sabtu')) dayOfWeek = 6;

  if (dayOfWeek === -1) return null;

  // 2. Deteksi Waktu Shalat / Jam
  let time = '09:00';
  let timeCategory = 'custom';

  if (lower.includes('subuh')) {
    time = '05:00';
    timeCategory = 'subuh';
  } else if (lower.includes('dhuha')) {
    time = '09:00';
    timeCategory = 'dhuha';
  } else if (lower.includes('dzuhur') || lower.includes('dhuhur') || lower.includes('zuhur')) {
    time = '12:30';
    timeCategory = 'dzuhur';
  } else if (lower.includes('ashar') || lower.includes('asar')) {
    time = '16:00';
    timeCategory = 'ashar';
  } else if (lower.includes('maghrib') || lower.includes('magrib')) {
    time = '18:15';
    timeCategory = 'maghrib';
  } else if (lower.includes('isya')) {
    time = '19:30';
    timeCategory = 'isya';
  }

  // Cek apakah ada format jam eksplisit seperti 18:30 atau 09.00
  const timeMatch = lower.match(/(\d{1,2})[:.](\d{2})/);
  if (timeMatch) {
    const hh = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
    const mm = timeMatch[2];
    time = `${hh}:${mm}`;
  }

  // 3. Deteksi Pekan (Default: [1, 2, 3, 4, 5])
  let weeks = [1, 2, 3, 4, 5];
  if (lower.includes('pekan 1 & 3') || lower.includes('pekan 1 dan 3') || lower.includes('pekan ke-1 & ke-3')) {
    weeks = [1, 3];
  } else if (lower.includes('pekan 2 & 4') || lower.includes('pekan 2 dan 4') || lower.includes('pekan ke-2 & ke-4')) {
    weeks = [2, 4];
  } else if (lower.includes('pekan 1') || lower.includes('pekan ke-1')) {
    weeks = [1];
  } else if (lower.includes('pekan 2') || lower.includes('pekan ke-2')) {
    weeks = [2];
  } else if (lower.includes('pekan 3') || lower.includes('pekan ke-3')) {
    weeks = [3];
  } else if (lower.includes('pekan 4') || lower.includes('pekan ke-4')) {
    weeks = [4];
  }

  return {
    dayOfWeek,
    time,
    timeCategory,
    weeks,
  };
}

/**
 * Menghasilkan teks ringkasan rapi dari RecurringRule
 * Contoh: "Rutin Setiap Ahad • Ba'da Subuh (05:00 WIB)"
 */
export function formatRecurringSummary(rule: RecurringRule): string {
  const dayName = DAY_NAMES[rule.dayOfWeek] || 'Hari Tertentu';
  const preset = PRAYER_PRESETS.find(p => p.category === rule.timeCategory);
  const timeLabel = preset ? `${preset.label} (${rule.time} WIB)` : `${rule.time} WIB`;

  let weekLabel = 'Setiap Pekan';
  const w = rule.weeks || [1, 2, 3, 4, 5];
  if (w.length === 2 && w.includes(1) && w.includes(3)) {
    weekLabel = 'Pekan ke-1 & ke-3';
  } else if (w.length === 2 && w.includes(2) && w.includes(4)) {
    weekLabel = 'Pekan ke-2 & ke-4';
  } else if (w.length === 1) {
    weekLabel = `Pekan ke-${w[0]}`;
  }

  if (weekLabel === 'Setiap Pekan') {
    return `Rutin Setiap ${dayName} • ${timeLabel}`;
  }
  return `Rutin Setiap ${dayName} (${weekLabel}) • ${timeLabel}`;
}

export interface NextOccurrenceResult {
  nextDate: Date;
  isLive: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  isThisWeek: boolean;
}

/**
 * Menghitung tanggal kemunculan sesi berikutnya (atau sesi yang sedang live hari ini)
 * untuk kajian rutin.
 */
export function getNextOccurrence(rule: RecurringRule, fromDate: Date = new Date()): NextOccurrenceResult | null {
  if (rule.dayOfWeek < 0 || rule.dayOfWeek > 6) return null;
  const targetDay = rule.dayOfWeek;
  const weeksAllowed = rule.weeks && rule.weeks.length > 0 ? rule.weeks : [1, 2, 3, 4, 5];

  const [hoursStr, minutesStr] = (rule.time || '09:00').split(':');
  const sessionHours = parseInt(hoursStr, 10) || 9;
  const sessionMinutes = parseInt(minutesStr, 10) || 0;

  const nowMs = fromDate.getTime();
  const todayDay = fromDate.getDay();

  // Periksa hingga 60 hari ke depan untuk menemukan tanggal yang cocok
  for (let offset = 0; offset <= 60; offset++) {
    const candidate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + offset, sessionHours, sessionMinutes, 0, 0);

    if (candidate.getDay() !== targetDay) continue;

    // Periksa apakah pekan dalam bulan cocok dengan aturan
    const weekInMonth = getWeekdayOccurrenceInMonth(candidate);
    if (!weeksAllowed.includes(weekInMonth)) continue;

    const candidateMs = candidate.getTime();
    const candidateEndMs = candidateMs + 2 * 60 * 60 * 1000; // Asumsi durasi kajian 2 jam

    // Jika kandidat adalah HARI INI:
    if (offset === 0) {
      // Jika kajian sedang live sekarang (start <= now <= start + 2h)
      if (candidateMs <= nowMs && nowMs <= candidateEndMs) {
        return {
          nextDate: candidate,
          isLive: true,
          isToday: true,
          isTomorrow: false,
          isThisWeek: true,
        };
      }
      // Jika kajian belum mulai hari ini (now < start)
      if (nowMs < candidateMs) {
        return {
          nextDate: candidate,
          isLive: false,
          isToday: true,
          isTomorrow: false,
          isThisWeek: true,
        };
      }
      // Jika sudah lewat durasi (+2 jam), lanjutkan ke pekan berikutnya
      continue;
    }

    // Kandidat di masa mendatang
    const isTomorrow = offset === 1;
    const isThisWeek = offset <= 7;

    return {
      nextDate: candidate,
      isLive: false,
      isToday: false,
      isTomorrow,
      isThisWeek,
    };
  }

  return null;
}

/**
 * Menghitung tanggal efektif dan status kajian, baik untuk kajian tematik maupun rutin.
 */
export function getEffectiveSessionInfo(
  session: {
    is_recurring?: boolean;
    start_datetime?: string | null;
    recurring_rule?: any;
    recurring_pattern?: string | null;
  },
  now: Date = new Date()
): {
  effectiveDate: Date | null;
  isLive: boolean;
  isPast: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  dateLabel: string;
} {
  const isRutin = !!session.is_recurring;

  if (isRutin) {
    let rule: RecurringRule | null = null;

    if (session.recurring_rule && typeof session.recurring_rule === 'object') {
      rule = session.recurring_rule as RecurringRule;
    } else if (typeof session.recurring_rule === 'string') {
      try {
        rule = JSON.parse(session.recurring_rule);
      } catch {
        rule = null;
      }
    }

    if (!rule && session.recurring_pattern) {
      rule = parseRecurringPattern(session.recurring_pattern);
    }

    if (rule) {
      const nextOcc = getNextOccurrence(rule, now);
      if (nextOcc) {
        const d = nextOcc.nextDate;
        const dateStr = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        return {
          effectiveDate: d,
          isLive: nextOcc.isLive,
          isPast: false, // Kajian rutin selalu memiliki sesi berikutnya
          isToday: nextOcc.isToday,
          isTomorrow: nextOcc.isTomorrow,
          dateLabel: `${dateStr} • ${timeStr} WIB`,
        };
      }
    }

    // Fallback jika aturan rutin tidak bisa dihitung: gunakan teks pattern atau start_datetime
    if (session.start_datetime) {
      const d = new Date(session.start_datetime);
      const isLive = d <= now && now.getTime() <= d.getTime() + 2 * 60 * 60 * 1000;
      return {
        effectiveDate: d,
        isLive,
        isPast: now.getTime() > d.getTime() + 2 * 60 * 60 * 1000,
        isToday: d.toDateString() === now.toDateString(),
        isTomorrow: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString() === d.toDateString(),
        dateLabel: session.recurring_pattern || 'Kajian Rutin',
      };
    }

    return {
      effectiveDate: null,
      isLive: false,
      isPast: false,
      isToday: false,
      isTomorrow: false,
      dateLabel: session.recurring_pattern || 'Kajian Rutin',
    };
  }

  // Kajian Tematik biasa dengan start_datetime
  if (session.start_datetime) {
    const d = new Date(session.start_datetime);
    const dateMs = d.getTime();
    const nowMs = now.getTime();
    const isLive = d <= now && nowMs <= dateMs + 2 * 60 * 60 * 1000;
    const isPast = nowMs > dateMs + 2 * 60 * 60 * 1000;
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const dateStr = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    return {
      effectiveDate: d,
      isLive,
      isPast,
      isToday,
      isTomorrow,
      dateLabel: `${dateStr} • ${timeStr} WIB`,
    };
  }

  return {
    effectiveDate: null,
    isLive: false,
    isPast: false,
    isToday: false,
    isTomorrow: false,
    dateLabel: 'Waktu Belum Ditentukan',
  };
}
