-- Menghapus Data Dummy dari tabel venues berdasarkan ID spesifik yang kita buat sebelumnya.
-- Karena ada relasi "ON DELETE CASCADE", menghapus venue ini akan otomatis 
-- menghapus jadwal kajian (study_sessions) dummy yang terkait dengannya.

DELETE FROM public.venues 
WHERE id IN (
  '11111111-1111-1111-1111-111111111111', -- Masjid Istiqlal
  '22222222-2222-2222-2222-222222222222', -- Masjid Sunda Kelapa
  '33333333-3333-3333-3333-333333333333'  -- Masjid JIC
);
