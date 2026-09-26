-- Matikan RLS (Row Level Security) sementara agar data bisa dibaca oleh aplikasi frontend (anon)
ALTER TABLE venues DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions DISABLE ROW LEVEL SECURITY;
