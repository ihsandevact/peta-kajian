import type { Metadata } from 'next';
import MosqueClient from '@/components/MosqueClient';

export const metadata: Metadata = {
  title: 'Pencarian Masjid Terdekat & Rute Navigasi — Peta Kajian',
  description:
    'Temukan masjid sunnah terdekat dari lokasi Anda lengkap dengan rute navigasi belokan-demi-belokan, informasi fasilitas, dan jadwal kajian aktif.',
};

export default function MosquePage() {
  return <MosqueClient />;
}
