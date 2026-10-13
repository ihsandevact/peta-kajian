-- Dukungan kajian online / live streaming
-- Jalankan manual di Supabase Dashboard -> SQL Editor

-- 1. Kolom baru
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS stream_url text;
ALTER TABLE study_sessions ALTER COLUMN venue_id DROP NOT NULL;

-- 2. Bersihkan data lama: venue yang namanya jelas online
UPDATE study_sessions s
SET is_online = true, venue_id = NULL
FROM venues v
WHERE s.venue_id = v.id
  AND v.name ~* '(live|streaming|youtube|zoom|online|instagram|daring)';

-- 3. Hapus venue palsu yang tidak dipakai lagi
DELETE FROM venues v
WHERE v.name ~* '(live|streaming|youtube|zoom|online|instagram|daring)'
  AND NOT EXISTS (SELECT 1 FROM study_sessions s WHERE s.venue_id = v.id);
