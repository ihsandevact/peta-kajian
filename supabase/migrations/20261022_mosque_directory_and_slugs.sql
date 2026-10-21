-- Migrasi: Direktori Masjid, Profil Lengkap & Slugs
-- File: supabase/migrations/20261022_mosque_directory_and_slugs.sql

-- 1. Tambah kolom atribut profil masjid
ALTER TABLE venues ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_wa text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS youtube_channel text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT true;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 2. Fungsi auto-generate slug jika belum diisi
CREATE OR REPLACE FUNCTION generate_venue_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug text;
  new_slug text;
  counter integer := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
      base_slug := 'masjid';
    END IF;
    
    new_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM venues WHERE slug = new_slug AND id <> NEW.id) LOOP
      counter := counter + 1;
      new_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.slug := new_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_venue_slug ON venues;
CREATE TRIGGER trigger_venue_slug
  BEFORE INSERT OR UPDATE OF name ON venues
  FOR EACH ROW
  EXECUTE FUNCTION generate_venue_slug();

-- 3. Backfill data venue yang sudah ada agar memiliki slug unik
UPDATE venues 
SET slug = lower(trim(both '-' from regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || substring(id::text, 1, 6)
WHERE slug IS NULL OR slug = '';

-- 4. Index pencarian
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_slug ON venues (slug);
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues (city);
CREATE INDEX IF NOT EXISTS idx_venues_is_verified ON venues (is_verified);
