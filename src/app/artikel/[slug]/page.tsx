import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { IslamicArticle } from '@/data/initialArticles';
import { createClient } from '@/utils/supabase/server';
import ArticleReaderClient from './ArticleReaderClient';

export const dynamic = 'force-dynamic';

interface ArticleDetailPageProps {
  params: Promise<{ slug: string }>;
}

interface DbArticleRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content_html: string | null;
  canonical_url: string;
  source_id: string | null;
  source_slug?: string | null;
  source_name: string | null;
  source_url: string | null;
  author_name: string | null;
  category: string | null;
  tags: string[] | null;
  image_url: string | null;
  published_at: string | null;
  read_time_minutes: number | null;
  is_featured: boolean | null;
}

async function getArticleBySlug(slug: string): Promise<IslamicArticle | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle<DbArticleRow>();

    if (!error && data) {
      return {
        id: data.id,
        title: data.title,
        slug: data.slug,
        summary: data.summary || '',
        contentHtml: data.content_html || '',
        canonicalUrl: data.canonical_url,
        sourceId: data.source_slug || data.source_id || 'portal',
        sourceName: data.source_name || 'Portal Sunnah',
        sourceUrl: data.source_url || data.canonical_url,
        authorName: data.author_name || 'Asatidzah Ahlus Sunnah',
        category: data.category || 'umum',
        tags: Array.isArray(data.tags) ? data.tags : [],
        imageUrl: data.image_url || undefined,
        publishedAt: data.published_at || new Date().toISOString(),
        readTimeMinutes: data.read_time_minutes || 5,
        isFeatured: data.is_featured || false,
      };
    }
  } catch (err) {
    console.warn(`[getArticleBySlug] Error fetching slug "${slug}":`, err);
  }

  return null;
}

async function getRelatedArticles(currentArticle: IslamicArticle): Promise<IslamicArticle[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('is_published', true)
      .neq('id', currentArticle.id)
      .order('published_at', { ascending: false })
      .limit(2)
      .returns<DbArticleRow[]>();

    if (data && data.length > 0) {
      return data.map((d: DbArticleRow) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        summary: d.summary || '',
        contentHtml: d.content_html || '',
        canonicalUrl: d.canonical_url,
        sourceId: d.source_slug || d.source_id || 'portal',
        sourceName: d.source_name || 'Portal Sunnah',
        sourceUrl: d.source_url || d.canonical_url,
        authorName: d.author_name || 'Asatidzah Ahlus Sunnah',
        category: d.category || 'umum',
        tags: d.tags || [],
        imageUrl: d.image_url || undefined,
        publishedAt: d.published_at || new Date().toISOString(),
        readTimeMinutes: d.read_time_minutes || 5,
        isFeatured: d.is_featured || false,
      }));
    }
  } catch (err) {
    console.warn('[getRelatedArticles] Error fetching related articles:', err);
  }

  return [];
}

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return {
      title: 'Artikel Tidak Ditemukan — Peta Kajian',
    };
  }

  return {
    title: `${article.title} — ${article.sourceName} | Peta Kajian`,
    description: article.summary,
    alternates: {
      canonical: article.canonicalUrl,
    },
    openGraph: {
      title: `${article.title} — ${article.sourceName}`,
      description: article.summary,
      url: `https://petakajian.id/artikel/${article.slug}`,
      siteName: 'Peta Kajian',
      locale: 'id_ID',
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.authorName],
      images: article.imageUrl
        ? [
            {
              url: article.imageUrl,
              alt: article.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: article.imageUrl ? 'summary_large_image' : 'summary',
      title: article.title,
      description: article.summary,
      images: article.imageUrl ? [article.imageUrl] : undefined,
    },
  };
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = await getRelatedArticles(article);

  return <ArticleReaderClient article={article} relatedArticles={relatedArticles} />;
}
