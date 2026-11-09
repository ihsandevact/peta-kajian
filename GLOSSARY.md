# Peta Kajian Domain Model

Platform direktori dan navigasi kajian Islam Ahlus Sunnah wal Jama'ah, jadwal sholat, arah kiblat, dan siaran langsung di Indonesia.

## Language

**Sesi Kajian (Study Session)**:
Satu agenda penyampaian ilmu agama Islam oleh seorang pemateri (asatidzah) di suatu lokasi atau media siaran.
_Avoid_: Event, acara, pertemuan

**Kajian Rutin (Recurring Kajian)**:
Sesi kajian yang terselenggara secara berkala mengikuti pola waktu tertentu (misal: setiap Ahad ba'da Subuh).
_Avoid_: Kajian berkala, repeat event, subscription

**Jadwal Efektif (Effective Schedule)**:
Waktu penyelenggaraan terdekat yang telah dikalkulasi untuk suatu sesi kajian, baik dari tanggal tetap maupun hasil ekspansi aturan kajian rutin.
_Avoid_: Next run, calculated time, runtime schedule

**Kajian Langsung (Live Session)**:
Sesi kajian yang sedang berlangsung pada saat ini berdasarkan rentang waktu penyelenggaraan atau siaran video streaming aktif.
_Avoid_: Real-time event, online meeting

**Masjid Mitra / Venue**:
Titik fisik tempat diselenggarakannya kajian tatap muka (offline atau hybrid), dilengkapi koordinat geospasial dan informasi fasilitas.
_Avoid_: Lokasi, tempat, point of interest (POI)
