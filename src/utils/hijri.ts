/**
 * Utilitas Penanggalan Kalender Hijriyah & Deteksi Jadwal Puasa Sunnah
 * Berdasarkan Hisab Astronomis Islam (Ummul Qura / Tabular) & Fikih Ahlus Sunnah
 */

export interface HijriDate {
  day: number; // 1-30
  month: number; // 1-12
  monthName: string; // e.g. "Dzulqa'dah"
  year: number; // e.g. 1447
  formatted: string; // e.g. "13 Dzulqa'dah 1447 H"
  isHaramMonth: boolean; // 4 Bulan Haram: Muharram, Rajab, Dzulqa'dah, Dzulhijjah
  fastingInfo: FastingDayInfo | null;
}

export type FastingType =
  | 'senin_kamis'
  | 'ayyamul_bidh'
  | 'arafah'
  | 'tarwiyah'
  | 'asyura'
  | 'tasua'
  | 'syawal'
  | 'ramadhan'
  | 'dilarang';

export interface FastingDayInfo {
  type: FastingType;
  label: string; // Nama puasa, e.g. "Puasa Ayyamul Bidh"
  badgeColor: 'emerald' | 'amber' | 'blue' | 'purple' | 'red';
  dalil: string;
  source: string;
  isForbidden?: boolean;
}

export const HIJRI_MONTH_NAMES = [
  'Muharram',
  'Shafar',
  "Rabi'ul Awwal",
  "Rabi'ul Akhir",
  'Jumadil Awwal',
  'Jumadil Akhir',
  'Rajab',
  "Sya'ban",
  'Ramadhan',
  'Syawwal',
  "Dzulqa'dah",
  'Dzulhijjah',
] as const;

// 4 Bulan Haram yang dimuliakan Allah dalam Al-Qur'an (QS. At-Taubah: 36)
export const HARAM_MONTHS = [1, 7, 11, 12]; // Muharram, Rajab, Dzulqa'dah, Dzulhijjah

/**
 * Konversi tanggal Masehi ke Hijriyah menggunakan Julian Day Number dengan opsi koreksi hilal
 */
export function getHijriDate(date: Date, adjustmentDays: number = 0): HijriDate {
  // Tambahkan koreksi hari jika pengguna mengatur penyesuaian hilal
  const targetDate = new Date(date);
  if (adjustmentDays !== 0) {
    targetDate.setDate(targetDate.getDate() + adjustmentDays);
  }

  let day: number;
  let month: number;
  let year: number;

  try {
    // Gunakan Intl dengan kalender umalqura jika didukung environment
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const parts = formatter.formatToParts(targetDate);
    const dayPart = parts.find((p) => p.type === 'day')?.value;
    const monthPart = parts.find((p) => p.type === 'month')?.value;
    const yearPart = parts.find((p) => p.type === 'year')?.value;

    if (dayPart && monthPart && yearPart) {
      day = parseInt(dayPart, 10);
      month = parseInt(monthPart, 10);
      year = parseInt(yearPart, 10);
    } else {
      throw new Error('Fallback to algorithmic');
    }
  } catch {
    // Algoritma Tabular Kuwati jika Intl tidak tersedia
    const d = targetDate.getDate();
    let m = targetDate.getMonth() + 1;
    let y = targetDate.getFullYear();

    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    const a = Math.floor(y / 100);
    const b = 2 - a + Math.floor(a / 4);
    const jd =
      Math.floor(365.25 * (y + 4716)) +
      Math.floor(30.6001 * (m + 1)) +
      d +
      b -
      1524.5;

    const l = Math.floor(jd) - 1948440 + 10632;
    const n = Math.floor((l - 1) / 10631);
    const lPrime = l - 10631 * n + 354;
    const j =
      Math.floor((10985 - lPrime) / 5316) * Math.floor((50 * lPrime) / 17719) +
      Math.floor(lPrime / 5670) * Math.floor((43 * lPrime) / 15238);
    const lDoublePrime =
      lPrime -
      Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
      Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
      29;
    month = Math.floor((24 * lDoublePrime) / 709);
    day = lDoublePrime - Math.floor((709 * month) / 24);
    year = 30 * n + j - 30;
  }

  // Sanitasi rentang bulan 1-12
  month = Math.max(1, Math.min(12, month));
  const monthName = HIJRI_MONTH_NAMES[month - 1] || 'Hijriyah';
  const isHaramMonth = HARAM_MONTHS.includes(month);

  const fastingInfo = getFastingDayInfo(targetDate, day, month);

  return {
    day,
    month,
    monthName,
    year,
    formatted: `${day} ${monthName} ${year} H`,
    isHaramMonth,
    fastingInfo,
  };
}

/**
 * Menentukan apakah suatu hari merupakan hari puasa sunnah, puasa wajib, atau hari dilarang puasa
 */
export function getFastingDayInfo(
  gregorianDate: Date,
  hDay: number,
  hMonth: number
): FastingDayInfo | null {
  const dayOfWeek = gregorianDate.getDay(); // 0 = Ahad, 1 = Senin, ..., 4 = Kamis

  // 1. HARI-HARI DIHARAMKAN BERPUASA (Haram)
  // 1 Syawwal (Idul Fitri)
  if (hMonth === 10 && hDay === 1) {
    return {
      type: 'dilarang',
      label: 'Hari Raya Idul Fitri (Dilarang Berpuasa)',
      badgeColor: 'red',
      dalil: 'Rasulullah ﷺ melarang berpuasa pada dua hari: Hari Raya Idul Fitri dan Hari Raya Idul Adha.',
      source: 'HR. Bukhari no. 1990 & Muslim no. 1137',
      isForbidden: true,
    };
  }
  // 10 Dzulhijjah (Idul Adha)
  if (hMonth === 12 && hDay === 10) {
    return {
      type: 'dilarang',
      label: 'Hari Raya Idul Adha (Dilarang Berpuasa)',
      badgeColor: 'red',
      dalil: 'Hari raya kurban adalah hari makan, minum, dan berdzikir kepada Allah.',
      source: 'HR. Muslim no. 1141',
      isForbidden: true,
    };
  }
  // 11, 12, 13 Dzulhijjah (Hari Tasyrik)
  if (hMonth === 12 && (hDay === 11 || hDay === 12 || hDay === 13)) {
    return {
      type: 'dilarang',
      label: 'Hari Tasyrik (Dilarang Berpuasa)',
      badgeColor: 'red',
      dalil: 'Hari-hari tasyrik adalah hari makan, minum, dan berdzikir mengingat Allah.',
      source: 'HR. Muslim no. 1141',
      isForbidden: true,
    };
  }

  // 2. BULAN RAMADHAN (Puasa Wajib)
  if (hMonth === 9) {
    return {
      type: 'ramadhan',
      label: 'Puasa Wajib Ramadhan',
      badgeColor: 'purple',
      dalil: 'Bulan Ramadhan adalah bulan yang di dalamnya diturunkan Al-Qur\'an... Maka barangsiapa di antara kamu hadir di bulan itu, hendaklah ia berpuasa.',
      source: 'QS. Al-Baqarah: 185',
    };
  }

  // 3. PUASA TAHUNAN / KHUSUS
  // 9 Dzulhijjah (Puasa Arafah)
  if (hMonth === 12 && hDay === 9) {
    return {
      type: 'arafah',
      label: 'Puasa Arafah (9 Dzulhijjah)',
      badgeColor: 'blue',
      dalil: 'Puasa hari Arafah, aku berharap kepada Allah dapat menghapuskan dosa setahun yang lalu dan setahun yang akan datang.',
      source: 'HR. Muslim no. 1162',
    };
  }
  // 8 Dzulhijjah (Puasa Tarwiyah / Awal Dzulhijjah)
  if (hMonth === 12 && hDay === 8) {
    return {
      type: 'tarwiyah',
      label: 'Puasa Tarwiyah (8 Dzulhijjah)',
      badgeColor: 'blue',
      dalil: 'Tidak ada hari-hari di mana amal shalih di dalamnya lebih dicintai Allah daripada sepuluh hari pertama bulan Dzulhijjah.',
      source: 'HR. Bukhari no. 969',
    };
  }
  // 1-7 Dzulhijjah (Puasa Awal Dzulhijjah)
  if (hMonth === 12 && hDay >= 1 && hDay <= 7) {
    return {
      type: 'tarwiyah',
      label: `Puasa Awal Dzulhijjah (${hDay} Dzulhijjah)`,
      badgeColor: 'blue',
      dalil: 'Amal shalih pada 10 hari pertama Dzulhijjah lebih dicintai Allah melebihi jihad di jalan Allah.',
      source: 'HR. Bukhari no. 969',
    };
  }
  // 10 Muharram (Puasa Asyura)
  if (hMonth === 1 && hDay === 10) {
    return {
      type: 'asyura',
      label: 'Puasa Asyura (10 Muharram)',
      badgeColor: 'blue',
      dalil: 'Puasa hari Asyura, aku berharap kepada Allah dapat menghapuskan dosa setahun yang telah lalu.',
      source: 'HR. Muslim no. 1162',
    };
  }
  // 9 Muharram (Puasa Tasu'a)
  if (hMonth === 1 && hDay === 9) {
    return {
      type: 'tasua',
      label: "Puasa Tasu'a (9 Muharram)",
      badgeColor: 'blue',
      dalil: 'Jika aku masih hidup sampai tahun depan, sungguh aku akan berpuasa pada tanggal 9 Muharram (menyelisihi kaum Yahudi).',
      source: 'HR. Muslim no. 1134',
    };
  }

  // 4. PUASA BULANAN: AYYAMUL BIDH (13, 14, 15 Hijriyah)
  // Catatan: 13 Dzulhijjah sudah ditangani sebagai Hari Tasyrik di atas
  if (hDay === 13 || hDay === 14 || hDay === 15) {
    return {
      type: 'ayyamul_bidh',
      label: `Puasa Ayyamul Bidh (${hDay} ${HIJRI_MONTH_NAMES[hMonth - 1]})`,
      badgeColor: 'amber',
      dalil: 'Kekasihku (Rasulullah ﷺ) berwasiat kepadaku dengan tiga perkara: puasa tiga hari setiap bulan (Ayyamul Bidh), dua rakaat shalat Dhuha, dan witir sebelum tidur.',
      source: 'HR. Bukhari no. 1981 & Muslim no. 721',
    };
  }

  // 5. PUASA MINGGUAN: SENIN & KAMIS
  if (dayOfWeek === 1) {
    return {
      type: 'senin_kamis',
      label: 'Puasa Sunnah Hari Senin',
      badgeColor: 'emerald',
      dalil: 'Amalan manusia diperiksa pada hari Senin dan Kamis. Aku senang ketika amalanku diperiksa saat aku berpuasa.',
      source: 'HR. At-Tirmidzi no. 747 (Shahih)',
    };
  }
  if (dayOfWeek === 4) {
    return {
      type: 'senin_kamis',
      label: 'Puasa Sunnah Hari Kamis',
      badgeColor: 'emerald',
      dalil: 'Rasulullah ﷺ sangat bersungguh-sungguh memilih berpuasa pada hari Senin dan Kamis.',
      source: 'HR. At-Tirmidzi no. 745 (Shahih)',
    };
  }

  // 6. PUASA 6 HARI SYAWWAL (2 s/d 30 Syawwal)
  if (hMonth === 10 && hDay >= 2 && hDay <= 30) {
    // Puasa Syawwal sunnah fleksibel bisa dilakukan kapan saja di bulan Syawwal
    return {
      type: 'syawal',
      label: 'Bulan Puasa 6 Hari Syawwal',
      badgeColor: 'emerald',
      dalil: 'Barangsiapa berpuasa Ramadhan lalu melanjutkannya dengan enam hari di bulan Syawwal, maka pahalanya seperti puasa setahun penuh.',
      source: 'HR. Muslim no. 1164',
    };
  }

  return null;
}

export interface CalendarDayCell {
  date: Date;
  dayNumber: number; // Tanggal Masehi
  isCurrentMonth: boolean; // Apakah hari ini berada di bulan yang sedang ditampilkan
  isToday: boolean;
  hijri: HijriDate;
}

/**
 * Menghasilkan data tanggal untuk grid kalender 1 bulan (termasuk offset hari Ahad-Sabtu)
 */
export function getMonthCalendarCells(
  year: number,
  monthIndex: number, // 0 = Jan, 1 = Feb, ..., 11 = Des
  adjustmentDays: number = 0
): CalendarDayCell[] {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Ahad
  const daysInMonth = lastDayOfMonth.getDate();

  const cells: CalendarDayCell[] = [];

  const today = new Date();
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  // Hari-hari dari bulan sebelumnya untuk mengisi baris pertama
  const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, monthIndex - 1, prevMonthLastDay - i);
    cells.push({
      date: d,
      dayNumber: d.getDate(),
      isCurrentMonth: false,
      isToday: isSameDay(d, today),
      hijri: getHijriDate(d, adjustmentDays),
    });
  }

  // Hari-hari di bulan berjalan
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    cells.push({
      date: d,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: isSameDay(d, today),
      hijri: getHijriDate(d, adjustmentDays),
    });
  }

  // Hari-hari di bulan berikutnya untuk melengkapi baris terakhir agar kelipatan 7
  const remainingCells = 7 - (cells.length % 7);
  if (remainingCells < 7) {
    for (let day = 1; day <= remainingCells; day++) {
      const d = new Date(year, monthIndex + 1, day);
      cells.push({
        date: d,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: isSameDay(d, today),
        hijri: getHijriDate(d, adjustmentDays),
      });
    }
  }

  return cells;
}
