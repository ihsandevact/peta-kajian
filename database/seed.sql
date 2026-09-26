-- Bersihkan data sebelumnya (Hati-hati, ini akan menghapus semua data di tabel)
TRUNCATE TABLE study_sessions CASCADE;
TRUNCATE TABLE venues CASCADE;

-- 1. Insert Data Venues (Masjid)
INSERT INTO venues (id, name, address, location, facilities) VALUES
(
  '11111111-1111-1111-1111-111111111111', 
  'Masjid Istiqlal', 
  'Jl. Taman Wijaya Kusuma, Ps. Baru, Sawah Besar, Jakarta Pusat', 
  ST_SetSRID(ST_MakePoint(106.8310, -6.1702), 4326), 
  '{"akhwat_area": true, "parking_car": true, "kids_friendly": true}'::jsonb
),
(
  '22222222-2222-2222-2222-222222222222', 
  'Masjid Sunda Kelapa', 
  'Jl. Taman Sunda Kelapa No.16, Menteng, Jakarta Pusat', 
  ST_SetSRID(ST_MakePoint(106.8331, -6.2023), 4326), 
  '{"akhwat_area": true, "parking_car": true, "kids_friendly": false}'::jsonb
),
(
  '33333333-3333-3333-3333-333333333333', 
  'Masjid Jakarta Islamic Centre (JIC)', 
  'Jl. Kramat Jaya Raya, Tugu Utara, Koja, Jakarta Utara', 
  ST_SetSRID(ST_MakePoint(106.9152, -6.1215), 4326), 
  '{"akhwat_area": true, "parking_car": true, "kids_friendly": true}'::jsonb
);

-- 2. Insert Data Study Sessions (Kajian)
-- Perhatikan: start_datetime diset dinamis ke hari ini dan besok agar selalu relevan saat dites

INSERT INTO study_sessions (venue_id, speaker_name, title, book_title, audience_type, is_recurring, start_datetime, status) VALUES
(
  '11111111-1111-1111-1111-111111111111', 
  'Ustadz Dr. Syafiq Riza Basalamah, M.A.', 
  'Indahnya Sabar dan Syukur', 
  'Riyadhus Shalihin', 
  'umum', 
  false, 
  NOW() + interval '3 hours', -- Hari ini, 3 jam dari sekarang
  'confirmed'
),
(
  '22222222-2222-2222-2222-222222222222', 
  'Ustadz Dr. Firanda Andirja, M.A.', 
  'Tafsir Surat Al-Kahfi', 
  'Tafsir Ibnu Katsir', 
  'ikhwan', -- Khusus Ikhwan
  true, 
  NOW() + interval '1 day' + interval '2 hours', -- Besok
  'confirmed'
),
(
  '33333333-3333-3333-3333-333333333333', 
  'Ustadz Muhammad Nuzul Dzikri, Lc.', 
  'Adab Penuntut Ilmu', 
  'Tadzkiratus Sami wal Mutakallim', 
  'umum', 
  true, 
  NOW() - interval '2 days', -- Dua hari yang lalu (seharusnya tidak muncul di filter 'Hari Ini')
  'confirmed'
);
