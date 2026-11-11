import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import HomeDashboardSkeleton from '@/components/HomeDashboardSkeleton';
import HomeDashboardClient from '@/components/HomeDashboardClient';
import type { FilterState } from '@/components/HomeClient';
import { createClient } from '@/utils/supabase/server';
import type { IslamicArticle } from '@/data/initialArticles';

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

async function getLatestArticles(): Promise<IslamicArticle[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, summary, source_slug, source_name, source_url, author_name, read_time_minutes, published_at, image_url, is_featured')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(3);

    if (!error && data && data.length > 0) {
      return (data as any[]).map((d) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        summary: d.summary || '',
        contentHtml: '',
        canonicalUrl: d.source_url || '',
        sourceId: d.source_slug || 'portal',
        sourceName: d.source_name || 'Portal Sunnah',
        sourceUrl: d.source_url || '',
        authorName: d.author_name || 'Asatidzah Ahlus Sunnah',
        category: 'umum',
        tags: [],
        imageUrl: d.image_url || undefined,
        publishedAt: d.published_at || new Date().toISOString(),
        readTimeMinutes: d.read_time_minutes || 4,
        isFeatured: Boolean(d.is_featured),
      }));
    }
  } catch (err) {
    console.error('Error fetching homepage articles from server:', err);
  }
  return [];
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params?.session) {
    redirect(`/peta?session=${encodeURIComponent(params.session)}`);
  }

  const initialArticles = await getLatestArticles();

  return (
    <Suspense fallback={<HomeDashboardSkeleton />}>
      <HomeDashboardClient initialArticles={initialArticles} />
    </Suspense>
  );
}
