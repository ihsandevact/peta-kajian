#!/usr/bin/env node
/**
 * Skrip Impor Offline Katalog Masjid Indonesia dari Overture Maps (Places)
 *
 * Contoh penggunaan:
 *   npm run import:mosques
 *   npm run import:mosques -- --bbox 106.7,-6.37,106.87,-6.20 --dry-run
 *   npm run import:mosques -- --min-confidence 0.6 --release 2026-09-23.1
 *
 * Prasyarat untuk upsert ke Supabase (tanpa --dry-run):
 *   1. Jalankan migrasi `supabase/migrations/20261023_mosque_candidates.sql` di SQL Editor.
 *   2. Tambahkan `SUPABASE_SERVICE_ROLE_KEY=...` di `.env.local`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

// Workaround Node 20 WebSocket untuk @supabase/supabase-js
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

// Bbox default seluruh Indonesia (Sabang s/d Merauke, Miangas s/d Rote)
const INDONESIA_BBOX = [94.9, -11.1, 141.1, 6.1];

function parseArgs(argv) {
  const opts = {
    release: null,
    minConfidence: 0.5,
    bbox: INDONESIA_BBOX,
    customBbox: false,
    dryRun: false,
    noCache: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--no-cache') {
      opts.noCache = true;
    } else if (arg === '--release' && argv[i + 1]) {
      opts.release = argv[++i];
    } else if (arg.startsWith('--release=')) {
      opts.release = arg.split('=')[1];
    } else if (arg === '--min-confidence' && argv[i + 1]) {
      opts.minConfidence = Number(argv[++i]);
    } else if (arg.startsWith('--min-confidence=')) {
      opts.minConfidence = Number(arg.split('=')[1]);
    } else if (arg === '--bbox' && argv[i + 1]) {
      const parts = argv[++i].split(',').map(Number);
      if (parts.length !== 4 || parts.some(Number.isNaN)) {
        throw new Error('Format --bbox harus minLng,minLat,maxLng,maxLat');
      }
      opts.bbox = parts;
      opts.customBbox = true;
    } else if (arg.startsWith('--bbox=')) {
      const parts = arg.split('=')[1].split(',').map(Number);
      if (parts.length !== 4 || parts.some(Number.isNaN)) {
        throw new Error('Format --bbox harus minLng,minLat,maxLng,maxLat');
      }
      opts.bbox = parts;
      opts.customBbox = true;
    }
  }

  return opts;
}

async function resolveLatestRelease() {
  const res = await fetch('https://stac.overturemaps.org/catalog.json');
  if (!res.ok) {
    throw new Error(`Gagal mengambil STAC catalog Overture: HTTP ${res.status}`);
  }
  const catalog = await res.json();
  if (catalog.latest) return catalog.latest;

  const childLinks = (catalog.links || [])
    .filter((l) => l.rel === 'child' && typeof l.href === 'string')
    .map((l) => {
      const m = l.href.match(/(\d{4}-\d{2}-\d{2}\.\d+)/);
      return m ? m[1] : null;
    })
    .filter(Boolean)
    .sort();

  if (childLinks.length === 0) {
    throw new Error('Tidak dapat menemukan rilis Overture dari STAC catalog.');
  }
  return childLinks[childLinks.length - 1];
}

function isEligibleMosqueName(rawName) {
  if (!rawName || typeof rawName !== 'string') return false;
  const name = rawName.trim();
  if (name.length < 4) return false;
  const lower = name.toLowerCase();

  // Abaikan nama generik tunggal
  if (lower === 'masjid' || lower === 'mesjid' || lower === 'mosque') return false;

  // Sesuai pilihan: hanya masjid dulu (bukan mushalla/surau/langgar)
  if (/^(musholla|mushalla|musala|mushola|surau|langgar)\b/i.test(lower)) {
    return false;
  }

  return true;
}

async function main() {
  const startedAt = Date.now();
  const opts = parseArgs(process.argv);

  const release = opts.release || (await resolveLatestRelease());
  const [minLng, minLat, maxLng, maxLat] = opts.bbox;

  console.log('====================================================');
  console.log(' Impor Katalog Masjid Indonesia — Overture Maps');
  console.log('====================================================');
  console.log(`• Rilis Overture : ${release}`);
  console.log(`• Bounding Box   : [${minLng}, ${minLat}, ${maxLng}, ${maxLat}]`);
  console.log(`• Min Confidence : ${opts.minConfidence}`);
  console.log(`• Mode           : ${opts.dryRun ? 'DRY-RUN (tanpa tulis ke Supabase)' : 'LIVE UPSERT'}`);

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const bboxTag = opts.customBbox ? `_${minLng}_${minLat}_${maxLng}_${maxLat}` : '';
  const cacheFile = path.join(dataDir, `overture-mosques-${release}${bboxTag}.parquet`);
  const cacheFileSql = cacheFile.replace(/\\/g, '/');

  const inst = await DuckDBInstance.create(':memory:');
  const con = await inst.connect();
  await con.run("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';");

  if (!opts.noCache && fs.existsSync(cacheFile)) {
    console.log(`• Menggunakan cache lokal: ${cacheFile}`);
  } else {
    const s3Path = `s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*`;
    console.log('• Memeriksa skema Overture Places di S3...');

    const descRes = await con.runAndReadAll(
      `DESCRIBE SELECT * FROM read_parquet('${s3Path}', hive_partitioning=1)`
    );
    const colNames = new Set(descRes.getRowObjects().map((r) => r.column_name));

    let categoryPredicate;
    if (colNames.has('taxonomy')) {
      categoryPredicate = `(
        taxonomy."primary" IN ('muslim_place_of_worship', 'mosque', 'islamic_place_of_worship')
        OR list_contains(taxonomy.hierarchy, 'muslim_place_of_worship')
        OR list_contains(taxonomy.hierarchy, 'mosque')
        ${colNames.has('basic_category') ? "OR basic_category IN ('muslim_place_of_worship', 'mosque')" : ''}
      )`;
    } else if (colNames.has('categories')) {
      categoryPredicate = `(
        categories."primary" IN ('mosque', 'muslim_place_of_worship', 'islamic_place_of_worship')
      )`;
    } else {
      throw new Error(
        `Skema Overture tidak dikenali (kolom: ${Array.from(colNames).join(', ')})`
      );
    }

    const statusPredicate = colNames.has('operating_status')
      ? `AND (operating_status IS NULL OR operating_status = 'open')`
      : '';

    console.log('• Mengunduh & menyaring data masjid dari S3 (dapat memakan beberapa menit)...');
    const copySql = `
      COPY (
        SELECT
          id,
          names."primary" AS name,
          CAST(confidence AS DOUBLE) AS confidence,
          addresses[1].freeform AS address,
          addresses[1].locality AS city,
          addresses[1].region AS province,
          addresses[1].postcode AS postcode,
          addresses[1].country AS country,
          phones[1] AS phone,
          websites[1] AS website,
          CAST(to_json(sources) AS VARCHAR) AS sources_json,
          ST_Y(geometry) AS lat,
          ST_X(geometry) AS lng
        FROM read_parquet('${s3Path}', hive_partitioning=1)
        WHERE bbox.xmin BETWEEN ${minLng} AND ${maxLng}
          AND bbox.ymin BETWEEN ${minLat} AND ${maxLat}
          AND (addresses[1].country IS NULL OR addresses[1].country = 'ID')
          AND ${categoryPredicate}
          AND names."primary" IS NOT NULL
          ${statusPredicate}
      ) TO '${cacheFileSql}' (FORMAT PARQUET, COMPRESSION ZSTD);
    `;
    await con.run(copySql);
    console.log(`• Cache tersimpan di: ${cacheFile}`);
  }

  // Pastikan batas poligon wilayah Indonesia tersedia secara lokal (Natural Earth 10m)
  const idBoundaryFile = path.join(dataDir, 'indonesia-boundary-10m.parquet');
  const idBoundaryFileSql = idBoundaryFile.replace(/\\/g, '/');
  if (!fs.existsSync(idBoundaryFile)) {
    console.log('• Mengunduh poligon batas wilayah resmi Indonesia (Natural Earth 10m)...');
    await con.run(`
      COPY (
        SELECT ST_Buffer(geom, 0.004) AS geom
        FROM ST_Read('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson')
        WHERE ISO_A2 = 'ID' OR ADM0_A3 = 'IDN'
      ) TO '${idBoundaryFileSql}' (FORMAT PARQUET);
    `);
  }

  console.log('• Menyaring ketat hanya wilayah kedaulatan Indonesia (mengeluarkan Singapura/Malaysia/Brunei/Timor Leste)...');

  // Cek apakah parquet memiliki kolom country
  const parquetColsRes = await con.runAndReadAll(`DESCRIBE SELECT * FROM read_parquet('${cacheFileSql}')`);
  const hasCountryCol = parquetColsRes.getRowObjects().some((c) => c.column_name === 'country');
  const countryFilterSql = hasCountryCol ? `AND (p.country IS NULL OR p.country = 'ID')` : '';

  // Baca dari file parquet lokal dengan filter minConfidence + poligon Indonesia + eksklusi Singapura
  const rowsRes = await con.runAndReadAll(`
    SELECT
      p.id,
      p.name,
      p.confidence,
      p.address,
      p.city,
      p.province,
      p.postcode,
      p.phone,
      p.website,
      p.sources_json,
      p.lat,
      p.lng
    FROM read_parquet('${cacheFileSql}') p,
         read_parquet('${idBoundaryFileSql}') g
    WHERE p.confidence >= ${opts.minConfidence}
      ${countryFilterSql}
      AND COALESCE(p.city, '') NOT ILIKE '%singapore%'
      AND COALESCE(p.province, '') NOT ILIKE '%singapore%'
      AND NOT (p.lat BETWEEN 1.215 AND 1.48 AND p.lng BETWEEN 103.59 AND 104.09)
      AND ST_Intersects(ST_Point(p.lng, p.lat), g.geom)
  `);

  const rawRows = rowsRes.getRowObjectsJson();
  const candidates = [];
  let filteredOut = 0;

  for (const r of rawRows) {
    if (!isEligibleMosqueName(r.name)) {
      filteredOut++;
      continue;
    }
    if (typeof r.lat !== 'number' || typeof r.lng !== 'number') {
      filteredOut++;
      continue;
    }

    let parsedSources = null;
    if (r.sources_json) {
      try {
        parsedSources = JSON.parse(r.sources_json);
      } catch {
        parsedSources = null;
      }
    }

    candidates.push({
      id: String(r.id),
      name: String(r.name).trim(),
      address: r.address ? String(r.address).trim() : null,
      city: r.city ? String(r.city).trim() : null,
      province: r.province ? String(r.province).trim() : null,
      postcode: r.postcode ? String(r.postcode).trim() : null,
      lat: Number(r.lat),
      lng: Number(r.lng),
      confidence: typeof r.confidence === 'number' ? Number(r.confidence.toFixed(4)) : null,
      phone: r.phone ? String(r.phone).trim() : null,
      website: r.website ? String(r.website).trim() : null,
      sources: parsedSources,
      source_release: release,
    });
  }

  console.log(`• Total baris di parquet (confidence >= ${opts.minConfidence}): ${rawRows.length}`);
  console.log(`• Disaring keluar (mushalla / nama generik): ${filteredOut}`);
  console.log(`• Kandidat masjid siap impor: ${candidates.length}`);

  // Ringkasan per provinsi/kota
  const byRegion = new Map();
  for (const c of candidates) {
    const key = c.province || c.city || '(Tanpa Wilayah)';
    byRegion.set(key, (byRegion.get(key) || 0) + 1);
  }
  const topRegions = Array.from(byRegion.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topRegions.length > 0) {
    console.log('\nSebaran Teratas:');
    for (const [reg, cnt] of topRegions) {
      console.log(`  - ${reg}: ${cnt}`);
    }
  }

  if (candidates.length > 0) {
    console.log('\nContoh 5 Kandidat Teratas:');
    for (const sample of candidates
      .slice()
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 5)) {
      console.log(
        `  • ${sample.name} [${sample.city || '-'}, ${sample.province || '-'}] (conf: ${sample.confidence})`
      );
    }
  }

  if (opts.dryRun) {
    console.log(`\nSelesai (DRY-RUN) dalam ${((Date.now() - startedAt) / 1000).toFixed(1)} dtk.`);
    process.exit(0);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('\n[ERROR] SUPABASE_SERVICE_ROLE_KEY belum diatur di .env.local.');
    console.error('Ambil key tersebut dari Supabase Dashboard -> Project Settings -> API -> service_role,');
    console.error('lalu tambahkan ke .env.local:\n  SUPABASE_SERVICE_ROLE_KEY=eyJ...');
    console.error('\n(File parquet lokal sudah tersimpan, jadi saat dijalankan ulang tidak perlu unduh dari S3 lagi.)');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Bersihkan baris luar Indonesia yang sempat masuk dari cache parquet sebelumnya
  if (!opts.customBbox) {
    const outsideRes = await con.runAndReadAll(`
      SELECT p.id
      FROM read_parquet('${cacheFileSql}') p,
           read_parquet('${idBoundaryFileSql}') g
      WHERE NOT (
        COALESCE(p.city, '') NOT ILIKE '%singapore%'
        AND COALESCE(p.province, '') NOT ILIKE '%singapore%'
        AND NOT (p.lat BETWEEN 1.215 AND 1.48 AND p.lng BETWEEN 103.59 AND 104.09)
        AND ST_Intersects(ST_Point(p.lng, p.lat), g.geom)
      )
    `);
    const outsideIds = outsideRes.getRowObjectsJson().map((r) => String(r.id));
    if (outsideIds.length > 0) {
      console.log(`\n• Membersihkan ${outsideIds.length} kandidat luar Indonesia (Singapura/Malaysia/Brunei/Timor Leste) dari database...`);
      const DEL_BATCH = 500;
      for (let i = 0; i < outsideIds.length; i += DEL_BATCH) {
        const chunk = outsideIds.slice(i, i + DEL_BATCH);
        await supabase
          .from('mosque_candidates')
          .delete()
          .in('id', chunk)
          .is('promoted_venue_id', null);
      }
      console.log('  ✓ Pembersihan kandidat luar Indonesia selesai.');
    }
  }

  const BATCH_SIZE = 1000;
  let upserted = 0;
  console.log(`\n• Mengunggah ke tabel mosque_candidates dalam batch ${BATCH_SIZE}...`);

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const chunk = candidates.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('mosque_candidates')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      console.error(`\n[ERROR] Gagal upsert batch ${i}..${i + chunk.length}: ${error.message}`);
      console.error('Pastikan migrasi supabase/migrations/20261023_mosque_candidates.sql sudah dijalankan di SQL Editor.');
      process.exit(1);
    }
    upserted += chunk.length;
    process.stdout.write(`\r  Progres: ${upserted}/${candidates.length} (${Math.round((upserted / candidates.length) * 100)}%)`);
  }

  console.log(`\n\n✅ Berhasil mengimpor ${upserted} kandidat masjid dalam ${((Date.now() - startedAt) / 1000).toFixed(1)} dtk.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
