/**
 * Utilitas dan Tipe untuk Kustomisasi Ikon Kendaraan / Posisi Pengguna pada Navigasi Peta
 */

export type NavigationVehicleIcon = 'car' | 'motorcycle' | 'person';

export interface VehicleOption {
  id: NavigationVehicleIcon;
  label: string;
  icon: string;
  description: string;
  badgeBg: string;
}

// Opsi kendaraan berkendara (hanya 2: Mobil dan Motor, default Mobil)
export const VEHICLE_OPTIONS: VehicleOption[] = [
  {
    id: 'car',
    label: 'Mobil',
    icon: 'directions_car',
    description: 'Kendaraan roda empat',
    badgeBg: 'bg-emerald-600',
  },
  {
    id: 'motorcycle',
    label: 'Motor',
    icon: 'two_wheeler',
    description: 'Kendaraan roda dua',
    badgeBg: 'bg-amber-600',
  },
];

// Opsi khusus saat rute jalan kaki
export const PERSON_VEHICLE_OPTION: VehicleOption = {
  id: 'person',
  label: 'Pejalan Kaki',
  icon: 'directions_walk',
  description: 'Jalan kaki',
  badgeBg: 'bg-teal-600',
};

export const ALL_VEHICLE_OPTIONS: VehicleOption[] = [
  ...VEHICLE_OPTIONS,
  PERSON_VEHICLE_OPTION,
];

const STORAGE_KEY = 'peta-kajian:nav-vehicle-icon';

export function getStoredVehicleIcon(): NavigationVehicleIcon {
  if (typeof window === 'undefined') return 'car';
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'car' || val === 'motorcycle' || val === 'person') {
      return val;
    }
  } catch {
    // Abaikan error localStorage (private browsing / quota)
  }
  return 'car';
}

export function setStoredVehicleIcon(icon: NavigationVehicleIcon): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, icon);
  } catch {
    // Abaikan error
  }
}
