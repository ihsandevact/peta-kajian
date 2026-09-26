-- Memperbaiki URL poster yang rusak akibat teks contoh sebelumnya
UPDATE public.study_sessions 
SET poster_url = 'https://images.unsplash.com/photo-1564121211835-e88c852648ab?auto=format&fit=crop&q=80&w=800'
WHERE poster_url = 'https://example.com/poster-firanda.jpg';

UPDATE public.study_sessions 
SET poster_url = 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&q=80&w=800'
WHERE poster_url = 'https://example.com/poster-bintaro.jpg';
