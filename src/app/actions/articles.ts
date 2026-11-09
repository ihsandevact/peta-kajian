'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { ADMIN_EMAILS } from '@/lib/services/admin';
import {
  syncAllArticleFeeds,
  generateArticleSlug,
  sanitizeArticleHtml,
  type SyncArticlesReport,
} from '@/lib/services/articleSync';
import { recordCronLog } from '@/lib/services/cronLogger';

export interface AdminArticleRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content_html: string | null;
  canonical_url: string;
  source_slug: string | null;
  source_name: string | null;
  source_url: string | null;
  author_name: string | null;
  category: string | null;
  tags: string[] | null;
  image_url: string | null;
  published_at: string | null;
  read_time_minutes: number | null;
  is_featured: boolean | null;
  is_published: boolean;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface ArticleFormInput {
  title: string;
  slug?: string;
  summary?: string;
  content_html: string;
  canonical_url?: string;
  source_slug?: string;
  source_name?: string;
  source_url?: string;
  author_name?: string;
  category?: string;
  tags?: string[];
  image_url?: string | null;
  published_at?: string;
  read_time_minutes?: number;
  is_featured?: boolean;
  is_published?: boolean;
}

export interface GetAdminArticlesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  source?: string;
  status?: 'all' | 'published' | 'draft' | 'featured';
}

export interface AdminArticlesStats {
  totalCount: number;
  publishedCount: number;
  draftCount: number;
  featuredCount: number;
}

/**
 * Verifikasi keamanan: Hanya Administrator yang berhak mengelola artikel
 */
async function verifyAdminCaller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Autentikasi diperlukan. Silakan login terlebih dahulu.');
  }

  const isAdminByEmail = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
  if (!isAdminByEmail) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleData?.role !== 'admin') {
      throw new Error('Akses ditolak: Hanya administrator yang dapat mengelola Artikel Islam.');
    }
  }

  let dbClient: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>> =
    supabase;
  try {
    dbClient = createAdminClient();
  } catch {
    dbClient = supabase;
  }

  return { supabase: dbClient, user };
}

/**
 * Mengambil daftar artikel untuk halaman Admin beserta filter, pencarian, paginasi, dan statistik.
 */
export async function getAdminArticlesAction(params: GetAdminArticlesParams = {}): Promise<{
  success: boolean;
  articles: AdminArticleRow[];
  filteredTotal: number;
  stats: AdminArticlesStats;
  error?: string;
}> {
  const emptyStats: AdminArticlesStats = {
    totalCount: 0,
    publishedCount: 0,
    draftCount: 0,
    featuredCount: 0,
  };

  try {
    const { supabase } = await verifyAdminCaller();

    const page = Math.max(0, params.page ?? 0);
    const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 15));
    const search = (params.search || '').trim();
    const category = params.category || 'all';
    const source = params.source || 'all';
    const status = params.status || 'all';

    // 1. Hitung statistik keseluruhan secara paralel
    const [totalRes, pubRes, draftRes, featRes] = await Promise.all([
      supabase.from('articles').select('id', { count: 'exact', head: true }),
      supabase.from('articles').select('id', { count: 'exact', head: true }).eq('is_published', true),
      supabase.from('articles').select('id', { count: 'exact', head: true }).eq('is_published', false),
      supabase.from('articles').select('id', { count: 'exact', head: true }).eq('is_featured', true),
    ]);

    const stats: AdminArticlesStats = {
      totalCount: totalRes.count ?? 0,
      publishedCount: pubRes.count ?? 0,
      draftCount: draftRes.count ?? 0,
      featuredCount: featRes.count ?? 0,
    };

    // 2. Bangun query daftar artikel dengan filter
    let query = supabase.from('articles').select('*', { count: 'exact' });

    if (status === 'published') {
      query = query.eq('is_published', true);
    } else if (status === 'draft') {
      query = query.eq('is_published', false);
    } else if (status === 'featured') {
      query = query.eq('is_featured', true);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (source && source !== 'all') {
      query = query.or(`source_slug.eq.${source},source_name.ilike.%${source}%`);
    }

    if (search) {
      const safeSearch = search.replace(/[,()%*\\]/g, ' ').trim();
      if (safeSearch) {
        query = query.or(
          `title.ilike.%${safeSearch}%,summary.ilike.%${safeSearch}%,author_name.ilike.%${safeSearch}%`
        );
      }
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('published_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    return {
      success: true,
      articles: (data || []) as AdminArticleRow[],
      filteredTotal: count ?? 0,
      stats,
    };
  } catch (err: any) {
    console.error('[getAdminArticlesAction] Error:', err);
    return {
      success: false,
      articles: [],
      filteredTotal: 0,
      stats: emptyStats,
      error: err.message || 'Gagal memuat daftar artikel.',
    };
  }
}

/**
 * Membuat artikel Islam baru dari Portal Admin
 */
export async function createArticleAction(input: ArticleFormInput): Promise<{
  success: boolean;
  article?: AdminArticleRow;
  error?: string;
}> {
  try {
    const { supabase } = await verifyAdminCaller();

    const title = (input.title || '').trim();
    const rawHtml = (input.content_html || '').trim();

    if (!title) {
      return { success: false, error: 'Judul artikel wajib diisi.' };
    }
    if (!rawHtml) {
      return { success: false, error: 'Konten isi artikel wajib diisi.' };
    }

    const sourceSlug = (input.source_slug || 'peta-kajian').trim();
    const sourceName = (input.source_name || 'Redaksi Peta Kajian').trim();
    const sourceUrl = (input.source_url || 'https://petakajian.id').trim();

    // Hitung ringkasan dan estimasi waktu baca otomatis jika belum diisi
    const sanitized = sanitizeArticleHtml(rawHtml);
    const finalSummary = (input.summary || '').trim() || sanitized.summary || title;
    const finalReadTime =
      input.read_time_minutes && input.read_time_minutes > 0
        ? input.read_time_minutes
        : sanitized.readTimeMinutes;

    // Buat slug unik
    let slug = (input.slug || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    if (!slug) {
      slug = generateArticleSlug(title, sourceSlug);
    }

    // Cek apakah slug sudah dipakai
    const { data: existingSlug } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingSlug) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const canonicalUrl =
      (input.canonical_url || '').trim() || `https://petakajian.id/artikel/${slug}`;

    const publishedAt = input.published_at
      ? new Date(input.published_at).toISOString()
      : new Date().toISOString();

    const cleanTags = Array.isArray(input.tags)
      ? input.tags.map((t) => t.trim()).filter(Boolean)
      : [];

    const payload = {
      title,
      slug,
      summary: finalSummary,
      content_html: rawHtml,
      canonical_url: canonicalUrl,
      source_slug: sourceSlug,
      source_name: sourceName,
      source_url: sourceUrl,
      author_name: (input.author_name || 'Asatidzah Pembina').trim(),
      category: input.category || 'aqidah',
      tags: cleanTags,
      image_url: input.image_url?.trim() || sanitized.firstImageUrl || null,
      published_at: publishedAt,
      read_time_minutes: finalReadTime,
      is_featured: Boolean(input.is_featured),
      is_published: input.is_published ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('articles')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'Slug atau URL Kanonikal artikel ini sudah terdaftar. Gunakan judul/URL berbeda.',
        };
      }
      throw error;
    }

    revalidatePath('/admin/artikel');
    revalidatePath('/artikel');
    revalidatePath(`/artikel/${slug}`);
    revalidatePath('/');

    return {
      success: true,
      article: data as AdminArticleRow,
    };
  } catch (err: any) {
    console.error('[createArticleAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal menyimpan artikel baru.',
    };
  }
}

/**
 * Memperbarui artikel Islam yang sudah ada
 */
export async function updateArticleAction(
  articleId: string,
  input: ArticleFormInput
): Promise<{
  success: boolean;
  article?: AdminArticleRow;
  error?: string;
}> {
  try {
    const { supabase } = await verifyAdminCaller();

    if (!articleId) {
      return { success: false, error: 'ID Artikel tidak valid.' };
    }

    const title = (input.title || '').trim();
    const rawHtml = (input.content_html || '').trim();

    if (!title) {
      return { success: false, error: 'Judul artikel wajib diisi.' };
    }
    if (!rawHtml) {
      return { success: false, error: 'Konten isi artikel wajib diisi.' };
    }

    const sanitized = sanitizeArticleHtml(rawHtml);
    const finalSummary = (input.summary || '').trim() || sanitized.summary || title;
    const finalReadTime =
      input.read_time_minutes && input.read_time_minutes > 0
        ? input.read_time_minutes
        : sanitized.readTimeMinutes;

    const slug = (input.slug || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    if (!slug) {
      return { success: false, error: 'Slug URL tidak boleh kosong.' };
    }

    // Pastikan slug tidak bentrok dengan artikel lain
    const { data: slugConflict } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .neq('id', articleId)
      .maybeSingle();

    if (slugConflict) {
      return {
        success: false,
        error: `Slug "${slug}" sudah digunakan oleh artikel lain.`,
      };
    }

    const cleanTags = Array.isArray(input.tags)
      ? input.tags.map((t) => t.trim()).filter(Boolean)
      : [];

    const updatePayload: Record<string, any> = {
      title,
      slug,
      summary: finalSummary,
      content_html: rawHtml,
      canonical_url:
        (input.canonical_url || '').trim() || `https://petakajian.id/artikel/${slug}`,
      source_slug: (input.source_slug || 'peta-kajian').trim(),
      source_name: (input.source_name || 'Redaksi Peta Kajian').trim(),
      source_url: (input.source_url || 'https://petakajian.id').trim(),
      author_name: (input.author_name || 'Asatidzah Pembina').trim(),
      category: input.category || 'aqidah',
      tags: cleanTags,
      image_url: input.image_url?.trim() || null,
      read_time_minutes: finalReadTime,
      is_featured: Boolean(input.is_featured),
      is_published: input.is_published ?? true,
      updated_at: new Date().toISOString(),
    };

    if (input.published_at) {
      updatePayload.published_at = new Date(input.published_at).toISOString();
    }

    const { data, error } = await supabase
      .from('articles')
      .update(updatePayload)
      .eq('id', articleId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    revalidatePath('/admin/artikel');
    revalidatePath('/artikel');
    revalidatePath(`/artikel/${slug}`);
    revalidatePath('/');

    return {
      success: true,
      article: data as AdminArticleRow,
    };
  } catch (err: any) {
    console.error('[updateArticleAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal memperbarui artikel.',
    };
  }
}

/**
 * Toggle cepat status Tayang (is_published)
 */
export async function toggleArticlePublishAction(
  articleId: string,
  isPublished: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await verifyAdminCaller();

    const { error } = await supabase
      .from('articles')
      .update({
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (error) throw error;

    revalidatePath('/admin/artikel');
    revalidatePath('/artikel');
    revalidatePath('/');

    return { success: true };
  } catch (err: any) {
    console.error('[toggleArticlePublishAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal mengubah status publikasi artikel.',
    };
  }
}

/**
 * Toggle cepat status Artikel Pilihan / Featured (is_featured)
 */
export async function toggleArticleFeaturedAction(
  articleId: string,
  isFeatured: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await verifyAdminCaller();

    const { error } = await supabase
      .from('articles')
      .update({
        is_featured: isFeatured,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (error) throw error;

    revalidatePath('/admin/artikel');
    revalidatePath('/artikel');
    revalidatePath('/');

    return { success: true };
  } catch (err: any) {
    console.error('[toggleArticleFeaturedAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal mengubah status featured artikel.',
    };
  }
}

/**
 * Menghapus artikel dari database
 */
export async function deleteArticleAction(
  articleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await verifyAdminCaller();

    const { error } = await supabase.from('articles').delete().eq('id', articleId);

    if (error) throw error;

    revalidatePath('/admin/artikel');
    revalidatePath('/artikel');
    revalidatePath('/');

    return { success: true };
  } catch (err: any) {
    console.error('[deleteArticleAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal menghapus artikel.',
    };
  }
}

/**
 * Memicu sinkronisasi artikel dari seluruh portal RSS/WP-JSON secara langsung
 */
export async function syncArticlesRssAction(): Promise<{
  success: boolean;
  report?: SyncArticlesReport;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    await verifyAdminCaller();

    const report = await syncAllArticleFeeds();
    const durationMs = Date.now() - startTime;
    const isSuccess =
      report.totalInserted > 0 || (report.totalParsed === 0 && report.errors.length === 0);

    await recordCronLog({
      job_name: 'rss-article-sync',
      status: isSuccess ? 'success' : 'error',
      duration_ms: durationMs,
      summary: {
        totalSources: report.totalSources,
        totalParsed: report.totalParsed,
        totalInserted: report.totalInserted,
        errorsCount: report.errors.length,
      },
      error_message: isSuccess ? null : report.errors.slice(0, 3).join(' | '),
    });

    revalidatePath('/admin/artikel');
    revalidatePath('/artikel');
    revalidatePath('/');

    return {
      success: true,
      report,
    };
  } catch (err: any) {
    console.error('[syncArticlesRssAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal menyinkronkan feed artikel.',
    };
  }
}
