import { Suspense } from 'react';
import type { Metadata } from 'next';
import { fetchSessionById } from '@/lib/services/kajian';
import HomeClient, { type FilterState } from '@/components/HomeClient';

export type { FilterState };

interface PageProps {
  searchParams: Promise<{ session?: string; q?: string; time?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const sessionId = params?.session;

  if (sessionId) {
    const session = await fetchSessionById(sessionId);
    if (session) {
      const title = `${session.title} - ${session.speaker_name}`;
      const venueInfo = session.venues?.name
        ? ` di ${session.venues.name}${session.venues.address ? `, ${session.venues.address}` : ''}`
        : session.is_online
        ? ' (Disiarkan Online)'
        : '';
      const description = `Kajian: ${session.title} bersama ${session.speaker_name}${venueInfo}. Temukan jadwal dan lokasi di Peta Kajian Indonesia.`;

      const hasPoster = Boolean(
        session.poster_url &&
        session.poster_url.trim() !== '' &&
        session.poster_url.toLowerCase() !== 'null'
      );

      const imageUrl = hasPoster ? session.poster_url! : '/logo.png?v=3';

      return {
        title: `${title} | Peta Kajian Indonesia`,
        description,
        openGraph: {
          title,
          description,
          type: 'article',
          images: [
            {
              url: imageUrl,
              alt: session.title,
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [imageUrl],
        },
      };
    }
  }

  return {
    title: 'Peta Eksplorasi Kajian — Peta Kajian Indonesia',
    description: 'Jelajahi peta interaktif jadwal kajian sunnah terdekat di seluruh wilayah Indonesia.',
    openGraph: {
      title: 'Peta Eksplorasi Kajian — Peta Kajian Indonesia',
      description: 'Jelajahi peta interaktif jadwal kajian sunnah terdekat di seluruh wilayah Indonesia.',
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
      title: 'Peta Eksplorasi Kajian — Peta Kajian Indonesia',
      description: 'Jelajahi peta interaktif jadwal kajian sunnah terdekat di seluruh wilayah Indonesia.',
      images: ['/logo.png?v=3'],
    },
  };
}

export default function PetaPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-surface flex flex-col items-center justify-center font-geist gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-on-surface-variant font-medium">Memuat Peta Kajian...</p>
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
