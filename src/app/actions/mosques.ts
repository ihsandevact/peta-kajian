'use server';

import { createClient } from '@/utils/supabase/server';
import { calculateDistance } from '@/utils/distance';

/**
 * Kandidat masjid dari katalog Overture Maps (tabel staging `mosque_candidates`)
 */
export interface MosqueCandidate {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  lat: number;
  lng: number;
  confidence: number | null;
  phone: string | null;
  website: string | null;
  source_release: string | null;
  /** Diisi jika ada venue terdaftar dengan nama sama atau dalam radius ±100 m */
  possibleDuplicateOf?: { id: string; name: string; distanceM: number } | null;
}

const CANDIDATE_COLUMNS =
  'id, name, address, city, province, lat, lng, confidence, phone, website, source_release';

/** Radius deteksi duplikat terhadap venues (meter) */
const DUPLICATE_RADIUS_M = 100;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, error: 'Akses ditolak: Anda harus login.' as const };
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleData?.role !== 'admin') {
    return { supabase, error: 'Akses ditolak: Hanya Admin yang dapat mengelola katalog masjid.' as const };
  }

  return { supabase, error: null };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(masjid|mesjid|jami'?|raya|agung)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sanitizeQueryText(raw?: string): string {
  return (raw || '').replace(/[,()%*\\]/g, ' ').trim();
}

/**
 * Tandai kandidat yang kemungkinan sudah ada di tabel `venues`
 * (nama ternormalisasi sama dalam 2 km, atau jarak <= DUPLICATE_RADIUS_M).
 */
async function attachDuplicateFlags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidates: MosqueCandidate[]
): Promise<MosqueCandidate[]> {
  if (candidates.length === 0) return candidates;

  // Bounding box seluruh kandidat + margin ~2 km
  const margin = 0.02;
  const lats = candidates.map((c) => c.lat);
  const lngs = candidates.map((c) => c.lng);

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, lat, lng')
    .gte('lat', Math.min(...lats) - margin)
    .lte('lat', Math.max(...lats) + margin)
    .gte('lng', Math.min(...lngs) - margin)
    .lte('lng', Math.max(...lngs) + margin)
    .limit(3000);

  const nearby = (venues || []).filter(
    (v: any) => typeof v.lat === 'number' && typeof v.lng === 'number'
  );

  return candidates.map((c) => {
    let best: MosqueCandidate['possibleDuplicateOf'] = null;
    const cName = normalizeName(c.name);

    for (const v of nearby) {
      const distanceM = Math.round(calculateDistance(c.lat, c.lng, v.lat, v.lng) * 1000);
      const sameName = cName.length > 0 && normalizeName(v.name || '') === cName;
      if (distanceM <= DUPLICATE_RADIUS_M || (sameName && distanceM <= 2000)) {
        if (!best || distanceM < best.distanceM) {
          best = { id: v.id, name: v.name, distanceM };
        }
      }
    }

    return { ...c, possibleDuplicateOf: best };
  });
}

/**
 * Deduplikasi internal antar sesama kandidat yang akan diimpor secara massal
 * (kandidat diasumsikan sudah terurut dari confidence tertinggi).
 */
function deduplicateCandidateBatch(candidates: MosqueCandidate[]): {
  unique: MosqueCandidate[];
  selfDuplicateIds: string[];
} {
  const unique: MosqueCandidate[] = [];
  const uniqueNormNames: string[] = [];
  const selfDuplicateIds: string[] = [];

  for (const c of candidates) {
    const cName = normalizeName(c.name);
    let isDup = false;

    for (let i = 0; i < unique.length; i++) {
      const u = unique[i];
      // Cek cepat selisih derajat (~1.5 km) sebelum hitung Haversine
      if (Math.abs(c.lat - u.lat) > 0.015 || Math.abs(c.lng - u.lng) > 0.015) continue;

      const distM = calculateDistance(c.lat, c.lng, u.lat, u.lng) * 1000;
      const sameName = cName.length > 0 && cName === uniqueNormNames[i];
      if (distM <= 40 || (sameName && distM <= 120)) {
        isDup = true;
        break;
      }
    }

    if (isDup) {
      selfDuplicateIds.push(c.id);
    } else {
      unique.push(c);
      uniqueNormNames.push(cName);
    }
  }

  return { unique, selfDuplicateIds };
}

/**
 * Helper internal: promosikan daftar kandidat ke tabel `venues` secara batch
 */
async function promoteCandidateRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawCandidates: MosqueCandidate[],
  options: { force?: boolean } = {}
) {
  const withVenueFlags = await attachDuplicateFlags(supabase, rawCandidates);

  const venueDuplicateIds: string[] = [];
  const nonVenueDuplicates: MosqueCandidate[] = [];

  for (const c of withVenueFlags) {
    if (!options.force && c.possibleDuplicateOf) {
      venueDuplicateIds.push(c.id);
    } else {
      nonVenueDuplicates.push(c);
    }
  }

  const { unique: toInsert, selfDuplicateIds } = options.force
    ? { unique: nonVenueDuplicates, selfDuplicateIds: [] as string[] }
    : deduplicateCandidateBatch(nonVenueDuplicates);

  const skippedCount = venueDuplicateIds.length + selfDuplicateIds.length;
  const now = new Date().toISOString();

  // Tandai kandidat duplikat agar tidak terus muncul di daftar unpromoted bila dipromosikan massal
  const allSkippedIds = [...venueDuplicateIds, ...selfDuplicateIds];
  if (allSkippedIds.length > 0 && !options.force) {
    const SKIP_CHUNK = 400;
    for (let i = 0; i < allSkippedIds.length; i += SKIP_CHUNK) {
      const chunk = allSkippedIds.slice(i, i + SKIP_CHUNK);
      await supabase
        .from('mosque_candidates')
        .update({ promoted_venue_id: 'skipped-duplicate', promoted_at: now })
        .in('id', chunk);
    }
  }

  if (toInsert.length === 0) {
    return {
      success: true as const,
      message: `Tidak ada masjid baru yang ditambahkan. (${skippedCount} dilewati karena sudah terdaftar / duplikat)`,
      promotedCount: 0,
      skippedCount,
    };
  }

  const rows = toInsert.map((c) => {
    const venueId = crypto.randomUUID();
    const slug =
      c.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
      '-' +
      venueId.substring(0, 6);

    const fullAddress =
      [c.address, c.city, c.province].filter(Boolean).join(', ') || c.name;

    return {
      candidateId: c.id,
      venueFull: {
        id: venueId,
        name: c.name,
        slug,
        address: fullAddress,
        city: c.city || null,
        province: c.province || null,
        location: `POINT(${c.lng} ${c.lat})`,
        facilities: {},
        is_verified: true,
      },
      venueMinimal: {
        id: venueId,
        name: c.name,
        address: fullAddress,
        location: `POINT(${c.lng} ${c.lat})`,
        facilities: {},
      },
    };
  });

  // Batch insert ke tabel `venues` per 250 baris (kolom `lat` & `lng` adalah GENERATED ALWAYS dari `location`)
  const INSERT_CHUNK = 250;
  let useMinimalSchema = false;

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const payload = useMinimalSchema
      ? chunk.map((r) => r.venueMinimal)
      : chunk.map((r) => r.venueFull);

    let { error: insertErr } = await supabase.from('venues').insert(payload);

    if (insertErr && !useMinimalSchema && /column .* does not exist|schema cache/i.test(insertErr.message)) {
      useMinimalSchema = true;
      const retry = await supabase.from('venues').insert(chunk.map((r) => r.venueMinimal));
      insertErr = retry.error;
    }

    if (insertErr) {
      return {
        success: false as const,
        error: `Gagal menyimpan ke venues (batch ${i + 1}): ${insertErr.message}`,
      };
    }
  }

  // Batch update status `promoted_venue_id` di `mosque_candidates` per 400 baris
  const UPDATE_CHUNK = 400;
  const promotedCandidateIds = rows.map((r) => r.candidateId);
  for (let i = 0; i < promotedCandidateIds.length; i += UPDATE_CHUNK) {
    const chunk = promotedCandidateIds.slice(i, i + UPDATE_CHUNK);
    await supabase
      .from('mosque_candidates')
      .update({ promoted_venue_id: 'promoted', promoted_at: now })
      .in('id', chunk);
  }

  return {
    success: true as const,
    message: `Berhasil menambahkan ${rows.length} masjid ke direktori.${
      skippedCount ? ` (${skippedCount} duplikat otomatis dilewati)` : ''
    }`,
    promotedCount: rows.length,
    skippedCount,
  };
}

/**
 * Server Action: statistik katalog kandidat masjid (total & rilis Overture)
 */
export async function getMosqueCatalogStatsAction() {
  try {
    const { supabase, error } = await requireAdmin();
    if (error) return { success: false as const, error };

    const [{ count: total, error: countErr }, { count: unpromoted }, { data: latest }] =
      await Promise.all([
        supabase.from('mosque_candidates').select('id', { count: 'estimated', head: true }),
        supabase
          .from('mosque_candidates')
          .select('id', { count: 'exact', head: true })
          .is('promoted_venue_id', null),
        supabase
          .from('mosque_candidates')
          .select('source_release')
          .order('imported_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (countErr) {
      return {
        success: false as const,
        error: `Katalog belum tersedia: ${countErr.message}. Jalankan migrasi 20261023_mosque_candidates.sql lalu "npm run import:mosques".`,
      };
    }

    return {
      success: true as const,
      total: total ?? 0,
      unpromoted: unpromoted ?? 0,
      release: (latest as any)?.source_release ?? null,
    };
  } catch (err: any) {
    console.error('Error in getMosqueCatalogStatsAction:', err);
    return { success: false as const, error: err.message || 'Gagal memuat statistik katalog' };
  }
}

/**
 * Server Action: cari kandidat masjid di katalog lokal (nama / kota / provinsi + filter skor keyakinan)
 */
export async function searchMosqueCandidatesAction(params: {
  q?: string;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}) {
  try {
    const { supabase, error } = await requireAdmin();
    if (error) return { success: false as const, error };

    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);
    const minConf = typeof params.minConfidence === 'number' ? params.minConfidence : 0.5;
    const q = sanitizeQueryText(params.q);

    let query = supabase
      .from('mosque_candidates')
      .select(CANDIDATE_COLUMNS, { count: 'exact' })
      .is('promoted_venue_id', null)
      .gte('confidence', minConf)
      .order('confidence', { ascending: false, nullsFirst: false })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (q) {
      const pattern = `%${q}%`;
      query = query.or(`name.ilike.${pattern},city.ilike.${pattern},province.ilike.${pattern}`);
    }

    const { data, count, error: qErr } = await query;
    if (qErr) {
      return { success: false as const, error: `Gagal mencari katalog: ${qErr.message}` };
    }

    const rows = (data || []) as MosqueCandidate[];
    const matchingCount = count ?? rows.length;
    const hasMore = offset + rows.length < matchingCount;
    const withFlags = await attachDuplicateFlags(supabase, rows);

    return {
      success: true as const,
      data: withFlags,
      hasMore,
      matchingCount,
    };
  } catch (err: any) {
    console.error('Error in searchMosqueCandidatesAction:', err);
    return { success: false as const, error: err.message || 'Gagal mencari katalog masjid' };
  }
}

/**
 * Server Action: promosikan kandidat terpilih (via checklist) ke tabel `venues`
 */
export async function promoteCandidatesAction(ids: string[], options: { force?: boolean } = {}) {
  try {
    const { supabase, error } = await requireAdmin();
    if (error) return { success: false as const, error };

    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false as const, error: 'Tidak ada masjid yang dipilih.' };
    }
    if (ids.length > 500) {
      return { success: false as const, error: 'Maksimal 500 masjid per promosi manual.' };
    }

    const { data, error: fetchErr } = await supabase
      .from('mosque_candidates')
      .select(CANDIDATE_COLUMNS)
      .in('id', ids)
      .is('promoted_venue_id', null);

    if (fetchErr) {
      return { success: false as const, error: `Gagal membaca kandidat: ${fetchErr.message}` };
    }

    return await promoteCandidateRows(supabase, (data || []) as MosqueCandidate[], options);
  } catch (err: any) {
    console.error('Error in promoteCandidatesAction:', err);
    return { success: false as const, error: err.message || 'Gagal mempromosikan masjid' };
  }
}

/**
 * Server Action: Promosikan Massal 1-Klik seluruh kandidat yang cocok dengan filter
 * (`q` nama/kota/provinsi + `minConfidence`), otomatis melewati duplikat.
 */
export async function bulkPromoteByFilterAction(params: {
  q?: string;
  minConfidence?: number;
  maxCount?: number;
}) {
  try {
    const { supabase, error } = await requireAdmin();
    if (error) return { success: false as const, error };

    const minConf = typeof params.minConfidence === 'number' ? params.minConfidence : 0.85;
    const maxCount = Math.min(Math.max(params.maxCount ?? 1000, 1), 2000);
    const q = sanitizeQueryText(params.q);

    // Apabila tanpa filter kata kunci/kota, wajibkan minimal confidence >= 0.75 agar aman
    if (!q && minConf < 0.75) {
      return {
        success: false as const,
        error: 'Pilih kota/kata kunci terlebih dahulu, atau gunakan filter keyakinan minimal ≥ 75% untuk promosi massal.',
      };
    }

    let query = supabase
      .from('mosque_candidates')
      .select(CANDIDATE_COLUMNS)
      .is('promoted_venue_id', null)
      .gte('confidence', minConf)
      .order('confidence', { ascending: false, nullsFirst: false })
      .order('name', { ascending: true })
      .limit(maxCount);

    if (q) {
      const pattern = `%${q}%`;
      query = query.or(`name.ilike.${pattern},city.ilike.${pattern},province.ilike.${pattern}`);
    }

    const { data, error: fetchErr } = await query;
    if (fetchErr) {
      return { success: false as const, error: `Gagal mengambil kandidat massal: ${fetchErr.message}` };
    }

    const candidates = (data || []) as MosqueCandidate[];
    if (candidates.length === 0) {
      return {
        success: false as const,
        error: 'Tidak ada kandidat yang cocok dengan filter ini untuk dipromosikan.',
      };
    }

    return await promoteCandidateRows(supabase, candidates, { force: false });
  } catch (err: any) {
    console.error('Error in bulkPromoteByFilterAction:', err);
    return { success: false as const, error: err.message || 'Gagal menjalankan promosi massal' };
  }
}
