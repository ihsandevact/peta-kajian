export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius bumi dalam KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

/**
 * Estimasi waktu tempuh realistis dari jarak garis lurus (Haversine km)
 * Mengalikan jarak lurus dengan faktor kelokan jalan rata-rata (1.3x)
 */
export function estimateTravelTime(distanceKm: number): {
  minutes: number;
  label: string;
  mode: 'walk' | 'drive';
} {
  const roadDistanceKm = Math.max(0.05, distanceKm * 1.3);

  // Jarak sangat dekat (<= 0.6 km garis lurus / ~780m jalan): tampilkan estimasi jalan kaki (~4.5 km/jam)
  if (distanceKm <= 0.6) {
    const mins = Math.max(1, Math.round((roadDistanceKm / 4.5) * 60));
    return {
      minutes: mins,
      label: `~${mins} mnt`,
      mode: 'walk',
    };
  }

  // Jarak perkotaan / antarkota: kecepatan rata-rata berkendara 26 km/jam (< 10km) hingga 38 km/jam (>= 10km)
  const avgSpeedKmh = distanceKm < 10 ? 26 : 38;
  const mins = Math.max(2, Math.round((roadDistanceKm / avgSpeedKmh) * 60));

  if (mins < 60) {
    return {
      minutes: mins,
      label: `~${mins} mnt`,
      mode: 'drive',
    };
  }

  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return {
    minutes: mins,
    label: remMins > 0 ? `~${hours}j ${remMins}m` : `~${hours} jam`,
    mode: 'drive',
  };
}
