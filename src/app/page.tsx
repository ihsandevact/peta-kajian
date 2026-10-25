import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import HomeDashboardSkeleton from '@/components/HomeDashboardSkeleton';
import HomeDashboardClient from '@/components/HomeDashboardClient';
import type { FilterState } from '@/components/HomeClient';

export type { FilterState };

interface PageProps {
  searchParams: Promise<{ session?: string }>;
}

export const metadata: Metadata = {
  title: 'Peta Kajian Indonesia — Platform Terpadu Jadwal Kajian & Direktori Masjid',
  description:
    'Temukan jadwal kajian sunnah hari ini, siaran live streaming majelis ilmu, jadwal waktu sholat standar Kemenag RI, dan navigasi 13.000+ masjid di seluruh Indonesia.',
  openGraph: {
    title: 'Peta Kajian Indonesia — Platform Terpadu Jadwal Kajian & Direktori Masjid',
    description:
      'Temukan jadwal kajian sunnah hari ini, siaran live streaming majelis ilmu, jadwal waktu sholat standar Kemenag RI, dan navigasi 13.000+ masjid di seluruh Indonesia.',
    images: [
      {
        url: '/logo.png?v=3',
        width: 512,
        height: 512,
        alt: 'Peta Kajian Indonesia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peta Kajian Indonesia — Platform Terpadu Jadwal Kajian & Direktori Masjid',
    description:
      'Temukan jadwal kajian sunnah hari ini, siaran live streaming majelis ilmu, jadwal waktu sholat standar Kemenag RI, dan navigasi 13.000+ masjid di seluruh Indonesia.',
    images: ['/logo.png?v=3'],
  },
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params?.session) {
    redirect(`/peta?session=${encodeURIComponent(params.session)}`);
  }

  return (
    <Suspense fallback={<HomeDashboardSkeleton />}>
      <HomeDashboardClient />
    </Suspense>
  );
}
