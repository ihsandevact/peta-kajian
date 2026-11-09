'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { ADMIN_EMAILS } from '@/lib/services/admin';
import { ARTICLE_SOURCES } from '@/data/initialArticles';

export interface AdminArticleSourceRow {
  id: string;
  name: string;
  slug: string;
  website_url: string;
  rss_feed_url: string;
  logo_url: string | null;
  organization: string | null;
  default_author: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  articles_count?: number;
}

export interface ArticleSourceFormInput {
  name: string;
  slug?: string;
  website_url: string;
  rss_feed_url: string;
  logo_url?: string | null;
  organization?: string | null;
  default_author?: string | null;
  is_active?: boolean;
}

/**
 * Verifikasi keamanan: Hanya Administrator yang berhak mengelola Portal Sumber Dakwah
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
      throw new Error('Akses ditolak: Hanya administrator yang dapat mengelola Portal Sumber Islam.');
    }
  }

  let dbClient: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>> =
    supabase;
  try {
    dbClient = createAdminClient();
  } catch {}

  return { user, supabase: dbClient };
}

/**
 * Mengambil seluruh portal sumber dakwah dari database
 * (Otomatis menyuntikkan initial ARTICLE_SOURCES jika tabel masih kosong)
 */
export async function getAdminArticleSourcesAction(): Promise<{
  success: boolean;
  sources: AdminArticleSourceRow[];
  error?: string;
}> {
  try {
    const { supabase } = await verifyAdminCaller();

    // 1. Ambil data portal sumber
    const { data, error } = await supabase
      .from('article_sources')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    let sources = (data as AdminArticleSourceRow[]) || [];

    // Jika tabel kosong, inisialisasi dengan data default dari ARTICLE_SOURCES
    if (sources.length === 0 && ARTICLE_SOURCES.length > 0) {
      for (const s of ARTICLE_SOURCES) {
        await supabase.from('article_sources').upsert(
          {
            name: s.name,
            slug: s.slug,
            website_url: s.websiteUrl,
            rss_feed_url: s.rssFeedUrl,
            organization: s.organization,
            default_author: s.defaultAuthor,
            is_active: true,
          },
          { onConflict: 'slug' }
        );
      }
      const { data: seededData } = await supabase
        .from('article_sources')
        .select('*')
        .order('name', { ascending: true });
      sources = (seededData as AdminArticleSourceRow[]) || [];
    }

    // 2. Hitung jumlah artikel per portal
    const { data: countData } = await supabase
      .from('articles')
      .select('source_slug');

    const counts: Record<string, number> = {};
    if (countData) {
      for (const item of countData) {
        if (item.source_slug) {
          counts[item.source_slug] = (counts[item.source_slug] || 0) + 1;
        }
      }
    }

    const mapped = sources.map((s) => ({
      ...s,
      articles_count: counts[s.slug] || 0,
    }));

    return {
      success: true,
      sources: mapped,
    };
  } catch (err: any) {
    console.error('[getAdminArticleSourcesAction] Error:', err);
    return {
      success: false,
      sources: [],
      error: err.message || 'Gagal memuat portal sumber dakwah.',
    };
  }
}

/**
 * Menambahkan portal sumber dakwah Islam baru
 */
export async function createArticleSourceAction(
  input: ArticleSourceFormInput
): Promise<{ success: boolean; error?: string; source?: AdminArticleSourceRow }> {
  try {
    const { supabase } = await verifyAdminCaller();

    if (!input.name?.trim()) {
      return { success: false, error: 'Nama portal wajib diisi.' };
    }
    if (!input.website_url?.trim()) {
      return { success: false, error: 'URL website portal wajib diisi.' };
    }
    if (!input.rss_feed_url?.trim()) {
      return { success: false, error: 'URL feed RSS / WP-JSON portal wajib diisi.' };
    }

    const cleanSlug = (input.slug || input.name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    const payload = {
      name: input.name.trim(),
      slug: cleanSlug,
      website_url: input.website_url.trim(),
      rss_feed_url: input.rss_feed_url.trim(),
      logo_url: input.logo_url?.trim() || null,
      organization: input.organization?.trim() || null,
      default_author: input.default_author?.trim() || 'Asatidzah Ahlus Sunnah',
      is_active: input.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('article_sources')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Slug atau URL Feed portal sudah terdaftar di sistem.' };
      }
      throw error;
    }

    revalidatePath('/admin/artikel');
    revalidatePath('/artikel');

    return {
      success: true,
      source: data as AdminArticleSourceRow,
    };
  } catch (err: any) {
    console.error('[createArticleSourceAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal menambahkan portal sumber dakwah.',
    };
  }
}

/**
 * Memperbarui data portal sumber dakwah
 */
export async function updateArticleSourceAction(
  id: string,
  input: ArticleSourceFormInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await verifyAdminCaller();

    if (!input.name?.trim()) {
      return { success: false, error: 'Nama portal wajib diisi.' };
    }
    if (!input.website_url?.trim()) {
      return { success: false, error: 'URL website portal wajib diisi.' };
    }
    if (!input.rss_feed_url?.trim()) {
      return { success: false, error: 'URL feed RSS portal wajib diisi.' };
    }

    const payload: Record<string, any> = {
      name: input.name.trim(),
      website_url: input.website_url.trim(),
      rss_feed_url: input.rss_feed_url.trim(),
      logo_url: input.logo_url?.trim() || null,
      organization: input.organization?.trim() || null,
      default_author: input.default_author?.trim() || 'Asatidzah Ahlus Sunnah',
      updated_at: new Date().toISOString(),
    };

    if (input.slug?.trim()) {
      payload.slug = input.slug.trim();
    }
    if (typeof input.is_active === 'boolean') {
      payload.is_active = input.is_active;
    }

    const { error } = await supabase
      .from('article_sources')
      .update(payload)
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/admin/artikel');
    revalidatePath('/artikel');

    return { success: true };
  } catch (err: any) {
    console.error('[updateArticleSourceAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal memperbarui portal sumber dakwah.',
    };
  }
}

/**
 * Mengubah status aktif / nonaktif portal sumber dakwah
 */
export async function toggleArticleSourceAction(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await verifyAdminCaller();

    const { error } = await supabase
      .from('article_sources')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/admin/artikel');
    revalidatePath('/artikel');

    return { success: true };
  } catch (err: any) {
    console.error('[toggleArticleSourceAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal mengubah status aktif portal.',
    };
  }
}

/**
 * Menghapus portal sumber dakwah
 */
export async function deleteArticleSourceAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await verifyAdminCaller();

    const { error } = await supabase
      .from('article_sources')
      .delete()
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/admin/artikel');
    revalidatePath('/artikel');

    return { success: true };
  } catch (err: any) {
    console.error('[deleteArticleSourceAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal menghapus portal sumber dakwah.',
    };
  }
}

/**
 * Tes koneksi feed RSS / WP-JSON dari URL portal sebelum disimpan
 */
export async function testRssFeedAction(rssFeedUrl: string): Promise<{
  success: boolean;
  message?: string;
  itemsFound?: number;
  sampleTitle?: string;
  error?: string;
}> {
  try {
    await verifyAdminCaller();

    if (!rssFeedUrl.startsWith('http://') && !rssFeedUrl.startsWith('https://')) {
      return { success: false, error: 'URL feed harus dimulai dengan http:// atau https://' };
    }

    const res = await fetch(rssFeedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, application/json, text/xml;q=0.9, */*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return { success: false, error: `Server portal mengembalikan status HTTP ${res.status}: ${res.statusText}` };
    }

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (contentType.includes('application/json') || text.trim().startsWith('[')) {
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json) && json.length > 0) {
          const sample = json[0]?.title?.rendered || json[0]?.title || 'Post WordPress';
          return {
            success: true,
            message: `Koneksi WP-JSON REST API berhasil! Ditemukan ${json.length} artikel terkini.`,
            itemsFound: json.length,
            sampleTitle: typeof sample === 'string' ? sample : 'Artikel',
          };
        }
      } catch {}
    }

    // Cek XML / RSS
    const itemCount = (text.match(/<item[\s>]/gi) || []).length || (text.match(/<entry[\s>]/gi) || []).length;
    const titleMatch = text.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const sampleTitle = titleMatch ? titleMatch[1].trim() : undefined;

    if (itemCount > 0) {
      return {
        success: true,
        message: `Koneksi RSS Feed berhasil! Ditemukan ${itemCount} artikel di feed.`,
        itemsFound: itemCount,
        sampleTitle,
      };
    }

    return {
      success: true,
      message: 'Koneksi ke URL feed berhasil, namun feed saat ini belum memiliki item artikel baru.',
      itemsFound: 0,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal menghubungi URL feed portal.',
    };
  }
}

export interface InspectWebsiteResult {
  success: boolean;
  name?: string;
  slug?: string;
  website_url?: string;
  rss_feed_url?: string;
  logo_url?: string | null;
  organization?: string;
  default_author?: string;
  items_count?: number;
  sample_titles?: string[];
  message?: string;
  error?: string;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .trim();
}

/**
 * Menganalisis URL website portal Islam secara otomatis:
 * Mendeteksi nama, slug, favicon, serta mencari & memverifikasi URL feed RSS/WP-JSON yang aktif.
 */
export async function inspectWebsitePortalAction(rawUrl: string): Promise<InspectWebsiteResult> {
  try {
    await verifyAdminCaller();

    let targetUrl = rawUrl.trim();
    if (!targetUrl) {
      return { success: false, error: 'Masukkan URL website portal terlebih dahulu.' };
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    let urlObj: URL;
    try {
      urlObj = new URL(targetUrl);
    } catch {
      return { success: false, error: 'Format URL website tidak valid.' };
    }

    const origin = urlObj.origin;

    // 1. Fetch Homepage HTML
    let html = '';
    try {
      const res = await fetch(origin, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 0 },
      });

      if (res.ok) {
        html = await res.text();
      }
    } catch (fetchErr: any) {
      console.warn('[inspectWebsitePortalAction] Homepage fetch warning:', fetchErr.message);
    }

    // 2. Ekstrak Metadata (Title, og:site_name, logo/favicon)
    let rawTitle = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      rawTitle = decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' '));
    }

    const ogSiteNameMatch =
      html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
    const ogSiteName = ogSiteNameMatch ? decodeHtmlEntities(ogSiteNameMatch[1]) : '';

    // Ekstrak logo / favicon
    let logoUrl: string | null = null;
    const ogImageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const faviconMatch =
      html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);

    if (ogImageMatch?.[1]) {
      const val = ogImageMatch[1].trim();
      logoUrl = val.startsWith('http') ? val : new URL(val, origin).href;
    } else if (faviconMatch?.[1]) {
      const val = faviconMatch[1].trim();
      logoUrl = val.startsWith('http') ? val : new URL(val, origin).href;
    }

    // Ekstrak nama portal yang bersih
    let portalName = ogSiteName;
    if (!portalName && rawTitle) {
      const splitted = rawTitle.split(/\s*[-–—|•»:]\s*/);
      portalName = splitted[0].trim();
      if (portalName.length > 35 || portalName.length < 3) {
        const cleanHost = urlObj.hostname.replace(/^www\./, '');
        portalName = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
      }
    }

    if (!portalName) {
      const cleanHost = urlObj.hostname.replace(/^www\./, '');
      portalName = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
    }

    const slug = portalName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

    // 3. Cari Endpoint Feed (RSS / Atom / WP-JSON)
    let explicitFeedUrl: string | null = null;
    const feedLinkMatch =
      html.match(/<link[^>]+type=["']application\/(?:rss\+xml|atom\+xml)["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss\+xml|atom\+xml)["']/i);

    if (feedLinkMatch?.[1]) {
      const val = feedLinkMatch[1].trim();
      explicitFeedUrl = val.startsWith('http') ? val : new URL(val, origin).href;
    }

    const candidateUrls: string[] = [];
    if (explicitFeedUrl) candidateUrls.push(explicitFeedUrl);
    candidateUrls.push(
      `${origin}/feed/`,
      `${origin}/feed`,
      `${origin}/rss`,
      `${origin}/rss.xml`,
      `${origin}/wp-json/wp/v2/posts?per_page=10`
    );

    // Unique candidates
    const uniqueCandidates = Array.from(new Set(candidateUrls));

    let verifiedFeedUrl: string | null = null;
    let itemsCount = 0;
    let sampleTitles: string[] = [];

    for (const cand of uniqueCandidates) {
      try {
        const feedRes = await fetch(cand, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Accept:
              'application/rss+xml, application/xml, application/json, text/xml;q=0.9, */*;q=0.8',
          },
          signal: AbortSignal.timeout(5000),
          next: { revalidate: 0 },
        });

        if (!feedRes.ok) continue;

        const text = await feedRes.text();
        const contentType = feedRes.headers.get('content-type') || '';

        // Kasus 1: WP-JSON REST API
        if (contentType.includes('application/json') || text.trim().startsWith('[')) {
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json) && json.length > 0) {
              verifiedFeedUrl = cand;
              itemsCount = json.length;
              sampleTitles = json
                .slice(0, 3)
                .map((j) => decodeHtmlEntities(j.title?.rendered || j.title || 'Artikel'));
              break;
            }
          } catch {}
        }

        // Kasus 2: XML / RSS 2.0 / Atom
        const count =
          (text.match(/<item[\s>]/gi) || []).length ||
          (text.match(/<entry[\s>]/gi) || []).length;

        if (count > 0) {
          verifiedFeedUrl = cand;
          itemsCount = count;
          const matches = [
            ...text.matchAll(
              /<(?:item|entry)[\s>][\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi
            ),
          ];
          sampleTitles = matches
            .slice(0, 3)
            .map((m) =>
              decodeHtmlEntities(m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim())
            );
          break;
        }
      } catch {
        // Coba kandidat berikutnya
      }
    }

    if (!verifiedFeedUrl) {
      return {
        success: true,
        website_url: origin,
        name: portalName,
        slug,
        logo_url: logoUrl,
        organization: `Redaksi ${portalName}`,
        default_author: 'Asatidzah Ahlus Sunnah',
        rss_feed_url: '',
        items_count: 0,
        sample_titles: [],
        message:
          'Website berhasil dianalisis! Namun feed RSS tidak terdeteksi otomatis. Silakan masukkan URL Feed RSS secara manual.',
      };
    }

    return {
      success: true,
      website_url: origin,
      name: portalName,
      slug,
      logo_url: logoUrl,
      organization: `Redaksi ${portalName}`,
      default_author: 'Asatidzah Ahlus Sunnah',
      rss_feed_url: verifiedFeedUrl,
      items_count: itemsCount,
      sample_titles: sampleTitles,
      message: `Website & Feed terverifikasi! Ditemukan ${itemsCount} artikel siap disinkronkan.`,
    };
  } catch (err: any) {
    console.error('[inspectWebsitePortalAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal menganalisis website portal.',
    };
  }
}
