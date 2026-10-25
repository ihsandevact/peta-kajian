/**
 * Kalkulator Waktu Sholat 5 Waktu Mandiri (Standar Kemenag RI)
 * - Subuh (Fajr): -20° di bawah ufuk + 2 menit ihtiyat
 * - Dzuhur (Dhuhr): Transit matahari + 2 menit ihtiyat
 * - Ashar (Asr): Syafi'i (panjang bayangan = 1x tinggi benda + bayangan transit) + 2 menit ihtiyat
 * - Maghrib: -0.833° di bawah ufuk + 2 menit ihtiyat
 * - Isya (Isha): -18° di bawah ufuk + 2 menit ihtiyat
 */

export interface DailyPrayerTimes {
  subuh: string;
  dzuhur: string;
  ashar: string;
  maghrib: string;
  isya: string;
  timezoneLabel: 'WIB' | 'WITA' | 'WIT';
  utcOffsetHours: number;
  nextPrayer: {
    id: 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';
    name: string;
    time: string;
    minutesRemaining: number;
    countdownText: string;
  };
}

export interface FullPrayerSchedule {
  imsak: string;
  subuh: string;
  terbit: string;
  dhuha: string;
  dzuhur: string;
  ashar: string;
  maghrib: string;
  isya: string;
  timezoneLabel: 'WIB' | 'WITA' | 'WIT';
  utcOffsetHours: number;
  currentMinutes: number;
  nextPrayer: {
    id: 'imsak' | 'subuh' | 'terbit' | 'dhuha' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';
    name: string;
    time: string;
    minutesRemaining: number;
    countdownText: string;
  };
  prayers: Array<{
    id: 'imsak' | 'subuh' | 'terbit' | 'dhuha' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';
    name: string;
    time: string;
    minutes: number;
    isPrimary: boolean;
  }>;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function dsin(deg: number): number {
  return Math.sin(deg * DEG_TO_RAD);
}
function dcos(deg: number): number {
  return Math.cos(deg * DEG_TO_RAD);
}
function dtan(deg: number): number {
  return Math.tan(deg * DEG_TO_RAD);
}
function darccos(x: number): number {
  return Math.acos(Math.max(-1, Math.min(1, x))) * RAD_TO_DEG;
}
function darccot(x: number): number {
  return Math.atan(1 / x) * RAD_TO_DEG;
}

export function getIndonesiaTimezone(lng: number): {
  utcOffsetHours: number;
  label: 'WIB' | 'WITA' | 'WIT';
} {
  if (lng >= 129.0) {
    return { utcOffsetHours: 9, label: 'WIT' };
  }
  if (lng >= 114.5) {
    return { utcOffsetHours: 8, label: 'WITA' };
  }
  return { utcOffsetHours: 7, label: 'WIB' };
}

function getJulianDate(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    B -
    1524.5
  );
}

function getSunPosition(jd: number): { declination: number; equationOfTime: number } {
  const D = jd - 2451545.0;
  const g = (357.529 + 0.98560028 * D) % 360;
  const q = (280.459 + 0.98564736 * D) % 360;
  const L = (q + 1.915 * dsin(g) + 0.020 * dsin(2 * g)) % 360;
  const e = 23.439 - 0.00000036 * D;

  const RA =
    (Math.atan2(dcos(e) * dsin(L), dcos(L)) * RAD_TO_DEG + 360) % 360 / 15;
  const declination = Math.asin(dsin(e) * dsin(L)) * RAD_TO_DEG;
  let eqt = q / 15 - RA;
  if (eqt > 12) eqt -= 24;
  if (eqt < -12) eqt += 24;

  return { declination, equationOfTime: eqt };
}

function computeHourAngle(lat: number, declination: number, angleBelowHorizon: number): number {
  const num = -dsin(angleBelowHorizon) - dsin(lat) * dsin(declination);
  const den = dcos(lat) * dcos(declination);
  return darccos(num / den) / 15;
}

function computeAsrHourAngle(lat: number, declination: number, shadowFactor = 1): number {
  const angle = -darccot(shadowFactor + dtan(Math.abs(lat - declination)));
  return computeHourAngle(lat, declination, angle);
}

function hoursToTotalMinutes(hours: number, ihtiyatMinutes = 2): number {
  const normalized = ((hours % 24) + 24) % 24;
  return Math.ceil(normalized * 60) + ihtiyatMinutes;
}

function formatMinutesToHHMM(totalMinutes: number): string {
  const clamped = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatCountdownMinutes(mins: number): string {
  if (mins <= 0) return 'Sekarang';
  if (mins < 60) return `${mins} mnt lagi`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} jam ${m} mnt lagi` : `${h} jam lagi`;
}

export function getPrayerScheduleAndNext(
  lat: number,
  lng: number,
  now: Date = new Date()
): DailyPrayerTimes {
  const { utcOffsetHours, label: timezoneLabel } = getIndonesiaTimezone(lng);

  // Hitung waktu lokal pada zona waktu lokasi target
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const targetLocalDate = new Date(utcMs + utcOffsetHours * 3600000);

  const year = targetLocalDate.getFullYear();
  const month = targetLocalDate.getMonth() + 1;
  const day = targetLocalDate.getDate();
  const currentMinutes =
    targetLocalDate.getHours() * 60 + targetLocalDate.getMinutes();

  const jd = getJulianDate(year, month, day) - lng / (15 * 24);
  const { declination, equationOfTime } = getSunPosition(jd + 0.5);

  const transit = 12 + utcOffsetHours - lng / 15 - equationOfTime;

  const subuhMin = hoursToTotalMinutes(
    transit - computeHourAngle(lat, declination, 20),
    2
  );
  const dzuhurMin = hoursToTotalMinutes(transit, 2);
  const asharMin = hoursToTotalMinutes(
    transit + computeAsrHourAngle(lat, declination, 1),
    2
  );
  const maghribMin = hoursToTotalMinutes(
    transit + computeHourAngle(lat, declination, 0.833),
    2
  );
  const isyaMin = hoursToTotalMinutes(
    transit + computeHourAngle(lat, declination, 18),
    2
  );

  const prayers: Array<{
    id: 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';
    name: string;
    minutes: number;
    time: string;
  }> = [
    { id: 'subuh', name: 'Subuh', minutes: subuhMin, time: formatMinutesToHHMM(subuhMin) },
    { id: 'dzuhur', name: 'Dzuhur', minutes: dzuhurMin, time: formatMinutesToHHMM(dzuhurMin) },
    { id: 'ashar', name: 'Ashar', minutes: asharMin, time: formatMinutesToHHMM(asharMin) },
    { id: 'maghrib', name: 'Maghrib', minutes: maghribMin, time: formatMinutesToHHMM(maghribMin) },
    { id: 'isya', name: 'Isya', minutes: isyaMin, time: formatMinutesToHHMM(isyaMin) },
  ];

  // Cari waktu sholat berikutnya
  let next = prayers.find((p) => p.minutes > currentMinutes);
  let minutesRemaining: number;

  if (next) {
    minutesRemaining = next.minutes - currentMinutes;
  } else {
    // Jika sudah lewat Isya, waktu sholat berikutnya adalah Subuh esok hari
    next = prayers[0];
    minutesRemaining = 1440 - currentMinutes + next.minutes;
  }

  return {
    subuh: prayers[0].time,
    dzuhur: prayers[1].time,
    ashar: prayers[2].time,
    maghrib: prayers[3].time,
    isya: prayers[4].time,
    timezoneLabel,
    utcOffsetHours,
    nextPrayer: {
      id: next.id,
      name: next.name,
      time: next.time,
      minutesRemaining,
      countdownText: formatCountdownMinutes(minutesRemaining),
    },
  };
}

export function getFullPrayerSchedule(
  lat: number,
  lng: number,
  now: Date = new Date()
): FullPrayerSchedule {
  const { utcOffsetHours, label: timezoneLabel } = getIndonesiaTimezone(lng);

  // Hitung waktu lokal pada zona waktu lokasi target
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const targetLocalDate = new Date(utcMs + utcOffsetHours * 3600000);

  const year = targetLocalDate.getFullYear();
  const month = targetLocalDate.getMonth() + 1;
  const day = targetLocalDate.getDate();
  const currentMinutes =
    targetLocalDate.getHours() * 60 + targetLocalDate.getMinutes();

  const jd = getJulianDate(year, month, day) - lng / (15 * 24);
  const { declination, equationOfTime } = getSunPosition(jd + 0.5);

  const transit = 12 + utcOffsetHours - lng / 15 - equationOfTime;

  // Hitung menit sholat dan amalan
  const subuhMin = hoursToTotalMinutes(
    transit - computeHourAngle(lat, declination, 20),
    2
  );
  const imsakMin = subuhMin - 10;
  const terbitMin = hoursToTotalMinutes(
    transit - computeHourAngle(lat, declination, 0.833),
    0
  );
  const dhuhaMin = terbitMin + 20;
  const dzuhurMin = hoursToTotalMinutes(transit, 2);
  const asharMin = hoursToTotalMinutes(
    transit + computeAsrHourAngle(lat, declination, 1),
    2
  );
  const maghribMin = hoursToTotalMinutes(
    transit + computeHourAngle(lat, declination, 0.833),
    2
  );
  const isyaMin = hoursToTotalMinutes(
    transit + computeHourAngle(lat, declination, 18),
    2
  );

  const prayers: FullPrayerSchedule['prayers'] = [
    { id: 'imsak', name: 'Imsak', minutes: imsakMin, time: formatMinutesToHHMM(imsakMin), isPrimary: false },
    { id: 'subuh', name: 'Subuh', minutes: subuhMin, time: formatMinutesToHHMM(subuhMin), isPrimary: true },
    { id: 'terbit', name: 'Terbit', minutes: terbitMin, time: formatMinutesToHHMM(terbitMin), isPrimary: false },
    { id: 'dhuha', name: 'Dhuha', minutes: dhuhaMin, time: formatMinutesToHHMM(dhuhaMin), isPrimary: false },
    { id: 'dzuhur', name: 'Dzuhur', minutes: dzuhurMin, time: formatMinutesToHHMM(dzuhurMin), isPrimary: true },
    { id: 'ashar', name: 'Ashar', minutes: asharMin, time: formatMinutesToHHMM(asharMin), isPrimary: true },
    { id: 'maghrib', name: 'Maghrib', minutes: maghribMin, time: formatMinutesToHHMM(maghribMin), isPrimary: true },
    { id: 'isya', name: 'Isya', minutes: isyaMin, time: formatMinutesToHHMM(isyaMin), isPrimary: true },
  ];

  // Cari jadwal berikutnya (hanya dari 5 sholat wajib + dhuha/imsak)
  let next = prayers.find((p) => p.minutes > currentMinutes);
  let minutesRemaining: number;

  if (next) {
    minutesRemaining = next.minutes - currentMinutes;
  } else {
    // Jika sudah lewat Isya, waktu berikutnya adalah Imsak/Subuh esok hari
    next = prayers[0];
    minutesRemaining = 1440 - currentMinutes + next.minutes;
  }

  return {
    imsak: formatMinutesToHHMM(imsakMin),
    subuh: formatMinutesToHHMM(subuhMin),
    terbit: formatMinutesToHHMM(terbitMin),
    dhuha: formatMinutesToHHMM(dhuhaMin),
    dzuhur: formatMinutesToHHMM(dzuhurMin),
    ashar: formatMinutesToHHMM(asharMin),
    maghrib: formatMinutesToHHMM(maghribMin),
    isya: formatMinutesToHHMM(isyaMin),
    timezoneLabel,
    utcOffsetHours,
    currentMinutes,
    nextPrayer: {
      id: next.id,
      name: next.name,
      time: next.time,
      minutesRemaining,
      countdownText: formatCountdownMinutes(minutesRemaining),
    },
    prayers,
  };
}
