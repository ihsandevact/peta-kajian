import * as cheerio from 'cheerio';
import { createAdminClient } from '@/utils/supabase/admin';
import { ARTICLE_SOURCES, type ArticleSource, type IslamicArticle } from '@/data/initialArticles';

export interface SyncFeedResult {
  sourceName: string;
  sourceUrl: string;
  itemsFound: number;
  newInserted: number;
  error?: string;
}

export interface SyncArticlesReport {
  totalSources: number;
  totalParsed: number;
  totalInserted: number;
  results: SyncFeedResult[];
  errors: string[];
}

/**
 * Membuat slug ramah URL dari judul artikel secara deterministik berdasarkan URL aslinya
 */
export function generateArticleSlug(title: string, sourceSlug: string, canonicalUrl?: string): string {
  const cleanTitle = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Hapus diakritik
    .replace(/[^a-z0-9\s-]/g, '')    // Hapus karakter non-alfanumerik
    .trim()
    .replace(/\s+/g, '-')           // Ganti spasi dengan strip
    .replace(/-+/g, '-')            // Hapus strip berulang
    .slice(0, 75);

  const urlHash = canonicalUrl
    ? Buffer.from(canonicalUrl).toString('base64url').slice(0, 6).toLowerCase().replace(/[^a-z0-9]/g, 'x')
    : Math.random().toString(36).substring(2, 6);

  return `${cleanTitle}-${sourceSlug}-${urlHash}`.replace(/--+/g, '-');
}

/**
 * Membersihkan naskah HTML artikel dari skrip, iklan, dan elemen pengganggu
 * sembari menjaga struktur teks Islami (paragraf, kutipan hadits, teks Arab).
 */
export function sanitizeArticleHtml(rawHtml: string): {
  cleanHtml: string;
  summary: string;
  firstImageUrl?: string;
  readTimeMinutes: number;
} {
  if (!rawHtml) {
    return { cleanHtml: '', summary: '', readTimeMinutes: 2 };
  }

  const $ = cheerio.load(rawHtml);

  // Buang elemen berbahaya atau pengganggu
  $('script, style, iframe, form, button, noscript, svg, nav, footer, header').remove();
  $('.sharedaddy, .jp-relatedposts, .wpcnt, .adsbygoogle, .yarpp-related, .inline-ad').remove();
  $('div[id*="ad"], div[class*="ad-"], div[class*="banner"]').remove();

  // Temukan gambar pertama jika ada
  let firstImageUrl: string | undefined;
  const firstImg = $('img').first();
  if (firstImg.length) {
    const src = firstImg.attr('src') || firstImg.attr('data-src') || firstImg.attr('data-lazy-src');
    if (src && src.startsWith('http')) {
      firstImageUrl = src;
    }
  }

  // Bersihkan atribut berbahaya pada tag yang dipertahankan
  $('*').each((_, el) => {
    if ('attribs' in el && el.attribs) {
      const attribs = el.attribs as Record<string, string>;
      for (const attr of Object.keys(attribs)) {
        if (attr.startsWith('on') || attr === 'style' || attr === 'id') {
          $(el).removeAttr(attr);
        }
      }
    }
  });

  // Ekstrak teks murni untuk ringkasan dan estimasi waktu baca
  const pureText = $.text().replace(/\s+/g, ' ').trim();
  const summary = pureText.slice(0, 220) + (pureText.length > 220 ? '...' : '');

  const wordCount = pureText.split(/\s+/).filter(Boolean).length;
  const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 180));

  const cleanHtml = $('body').html()?.trim() || '';

  return {
    cleanHtml,
    summary,
    firstImageUrl,
    readTimeMinutes,
  };
}

/**
 * Mengambil artikel dari WordPress REST API (/wp-json/wp/v2/posts?_embed)
 * Metode ini mengembalikan gambar fitur (featured image / thumbnail) asli, penulis, tag, dan konten lengkap.
 */
export async function fetchWordPressPosts(source: ArticleSource, perPage = 15): Promise<IslamicArticle[]> {
  const wpApiUrl = `${source.websiteUrl}/wp-json/wp/v2/posts?_embed&per_page=${perPage}`;
  const response = await fetch(wpApiUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
    },
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`WP-JSON HTTP ${response.status}: ${response.statusText}`);
  }

  const posts = await response.json();
  if (!Array.isArray(posts)) {
    throw new Error('WP-JSON invalid response: expected array');
  }

  return posts.map((post: any) => {
    // Bersihkan judul dari entity HTML
    const title = cheerio.load(post.title?.rendered || '').text().trim();
    const link = post.link?.trim() || '';
    const publishedAt = post.date_gmt ? new Date(post.date_gmt + 'Z').toISOString() : new Date().toISOString();

    // Ekstraksi Featured Image / Thumbnail resolusi tinggi
    const featuredMedia =
      post._embedded?.['wp:featuredmedia']?.[0]?.source_url ||
      post._embedded?.['wp:featuredmedia']?.[0]?.media_details?.sizes?.large?.source_url ||
      post._embedded?.['wp:featuredmedia']?.[0]?.media_details?.sizes?.medium_large?.source_url ||
      post.yoast_head_json?.og_image?.[0]?.url ||
      post.jetpack_featured_media_url ||
      undefined;

    // Bersihkan konten naskah lengkap & ringkasan
    const rawContent = post.content?.rendered || post.excerpt?.rendered || '';
    const { cleanHtml, summary, firstImageUrl, readTimeMinutes } = sanitizeArticleHtml(rawContent);

    const finalImageUrl = featuredMedia || firstImageUrl;

    // Penulis
    const authorName =
      post._embedded?.['author']?.[0]?.name?.trim() ||
      source.defaultAuthor;

    // Kategori & Tag dari terms
    const rawTerms: string[] = [];
    if (Array.isArray(post._embedded?.['wp:term'])) {
      post._embedded['wp:term'].flat().forEach((term: any) => {
        if (term?.name && !rawTerms.includes(term.name)) {
          rawTerms.push(term.name);
        }
      });
    }

    // Klasifikasi kategori utama
    let category = 'umum';
    const catLower = rawTerms.join(' ').toLowerCase();
    if (catLower.includes('aqidah') || catLower.includes('tauhid') || catLower.includes('iman')) {
      category = 'aqidah';
    } else if (catLower.includes('sholat') || catLower.includes('puasa') || catLower.includes('ibadah') || catLower.includes('fiqih')) {
      category = 'ibadah';
    } else if (catLower.includes('akhlak') || catLower.includes('hati') || catLower.includes('adab')) {
      category = 'akhlak';
    } else if (catLower.includes('jual beli') || catLower.includes('muamalah') || catLower.includes('hukum')) {
      category = 'muamalah';
    } else if (catLower.includes('keluarga') || catLower.includes('wanita') || catLower.includes('anak')) {
      category = 'keluarga';
    }

    const slug = generateArticleSlug(title, source.slug, link);

    return {
      id: `wp-${Buffer.from(link).toString('base64url').slice(0, 16)}`,
      title,
      slug,
      summary: summary || title,
      contentHtml: cleanHtml || `<p>${summary}</p>`,
      canonicalUrl: link,
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.websiteUrl,
      authorName,
      category,
      tags: rawTerms.slice(0, 5),
      imageUrl: finalImageUrl,
      publishedAt,
      readTimeMinutes,
    };
  });
}

/**
 * Mengambil artikel dari satu sumber dengan prioritas WordPress REST API (lengkap dg gambar),
 * dan fallback ke RSS Feed jika WP-JSON tidak merespons.
 */
export async function syncSourceArticles(source: ArticleSource): Promise<IslamicArticle[]> {
  try {
    return await fetchWordPressPosts(source, 15);
  } catch (wpErr: unknown) {
    const errorMsg = wpErr instanceof Error ? wpErr.message : String(wpErr);
    console.warn(`[articleSync] WP-JSON gagal untuk ${source.name} (${errorMsg}), mencoba fallback RSS...`);
    return await parseRssFeed(source);
  }
}

/**
 * Melakukan parsing RSS Feed dari satu URL portal WordPress
 */
export async function parseRssFeed(source: ArticleSource): Promise<IslamicArticle[]> {
  const articles: IslamicArticle[] = [];

  try {
    const response = await fetch(source.rssFeedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const $ = cheerio.load(xmlText, { xmlMode: true });

    $('item').each((_, itemEl) => {
      const item = $(itemEl);
      const title = item.find('title').first().text().trim();
      const link = item.find('link').first().text().trim();

      if (!title || !link) return;

      const pubDateStr = item.find('pubDate').first().text().trim();
      const publishedAt = pubDateStr ? new Date(pubDateStr).toISOString() : new Date().toISOString();

      // Penulis: dc:creator atau author
      const creator =
        item.find('dc\\:creator').first().text().trim() ||
        item.find('author').first().text().trim() ||
        source.defaultAuthor;

      // Kategori
      const rawCategories: string[] = [];
      item.find('category').each((_, catEl) => {
        const catText = $(catEl).text().trim();
        if (catText && !rawCategories.includes(catText)) {
          rawCategories.push(catText);
        }
      });

      // Konten naskah lengkap atau deskripsi
      const rawContent =
        item.find('content\\:encoded').first().text() ||
        item.find('description').first().text() ||
        '';

      const { cleanHtml, summary, firstImageUrl, readTimeMinutes } = sanitizeArticleHtml(rawContent);

      // Ekstraksi gambar utama (Featured image dari enclosure, media:content, atau tag img)
      const enclosureImg = item.find('enclosure[type^="image"]').first().attr('url');
      const mediaImg =
        item.find('media\\:content[medium="image"]').first().attr('url') ||
        item.find('media\\:thumbnail').first().attr('url') ||
        item.find('media\\:content').first().attr('url');
      const finalImageUrl = enclosureImg || mediaImg || firstImageUrl;

      // Klasifikasi kategori utama
      let category = 'umum';
      const catLower = rawCategories.join(' ').toLowerCase();
      if (catLower.includes('aqidah') || catLower.includes('tauhid') || catLower.includes('iman')) {
        category = 'aqidah';
      } else if (catLower.includes('sholat') || catLower.includes('puasa') || catLower.includes('ibadah') || catLower.includes('fiqih')) {
        category = 'ibadah';
      } else if (catLower.includes('akhlak') || catLower.includes('hati') || catLower.includes('adab')) {
        category = 'akhlak';
      } else if (catLower.includes('jual beli') || catLower.includes('muamalah') || catLower.includes('hukum')) {
        category = 'muamalah';
      } else if (catLower.includes('keluarga') || catLower.includes('wanita') || catLower.includes('anak')) {
        category = 'keluarga';
      }

      const slug = generateArticleSlug(title, source.slug, link);

      articles.push({
        id: `rss-${Buffer.from(link).toString('base64url').slice(0, 16)}`,
        title,
        slug,
        summary: summary || title,
        contentHtml: cleanHtml || `<p>${summary}</p>`,
        canonicalUrl: link,
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.websiteUrl,
        authorName: creator,
        category,
        tags: rawCategories.slice(0, 5),
        imageUrl: finalImageUrl,
        publishedAt,
        readTimeMinutes,
      });
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[articleSync] Gagal membaca RSS Feed dari ${source.name}:`, errorMsg);
    throw err;
  }

  return articles;
}

/**
 * Sinkronisasi seluruh feed portal aktif ke database Supabase
 */
export async function syncAllArticleFeeds(): Promise<SyncArticlesReport> {
  const report: SyncArticlesReport = {
    totalSources: ARTICLE_SOURCES.length,
    totalParsed: 0,
    totalInserted: 0,
    results: [],
    errors: [],
  };

  let supabase: ReturnType<typeof createAdminClient> | null = null;
  try {
    supabase = createAdminClient();
  } catch {}

  for (const source of ARTICLE_SOURCES) {
    try {
      const articles = await syncSourceArticles(source);
      report.totalParsed += articles.length;

      let insertedCount = 0;

      if (supabase) {
        for (const art of articles) {
          try {
            const { error } = await supabase.from('articles').upsert(
              {
                title: art.title,
                slug: art.slug,
                summary: art.summary,
                content_html: art.contentHtml,
                canonical_url: art.canonicalUrl,
                source_slug: art.sourceId,
                source_name: art.sourceName,
                source_url: art.sourceUrl,
                author_name: art.authorName,
                category: art.category,
                tags: art.tags,
                image_url: art.imageUrl || null,
                published_at: art.publishedAt,
                read_time_minutes: art.readTimeMinutes,
                is_published: true,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'canonical_url' }
            );

            if (!error) {
              insertedCount++;
            } else {
              console.error(`[articleSync] Upsert error pada "${art.title.slice(0, 30)}":`, error);
              report.errors.push(`${source.name} [${art.title.slice(0, 30)}]: ${error.message}`);
            }
          } catch (itemErr: unknown) {
            const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
            console.error(`[articleSync] Exception pada "${art.title.slice(0, 30)}":`, msg);
            report.errors.push(`${source.name} [${art.title.slice(0, 30)}]: ${msg}`);
          }
        }
      } else {
        console.warn('[articleSync] Supabase client tidak tersedia, sinkronisasi dibatalkan');
        report.errors.push('Supabase admin client tidak tersedia.');
      }

      report.totalInserted += insertedCount;
      report.results.push({
        sourceName: source.name,
        sourceUrl: source.websiteUrl,
        itemsFound: articles.length,
        newInserted: insertedCount,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
      report.errors.push(`${source.name}: ${errorMsg}`);
      report.results.push({
        sourceName: source.name,
        sourceUrl: source.websiteUrl,
        itemsFound: 0,
        newInserted: 0,
        error: errorMsg,
      });
    }
  }

  return report;
}
