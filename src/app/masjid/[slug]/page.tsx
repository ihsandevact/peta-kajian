import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchMosqueBySlugOrId } from '@/lib/services/venues';
import { createClient } from '@/utils/supabase/server';
import { ADMIN_EMAILS } from '@/lib/services/admin';
import MosqueDetailClient from './MosqueDetailClient';

interface MosqueDetailPageProps {
  params: Promise<{ slug: string }>;
}

async function checkIsServerAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim())) {
      return true;
    }
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    return roleData?.role === 'admin';
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: MosqueDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const isAdmin = await checkIsServerAdmin();
  const data = await fetchMosqueBySlugOrId(slug, { includeTestData: isAdmin });

  if (!data) {
    return {
      title: 'Masjid Tidak Ditemukan — Peta Kajian',
    };
  }

  return {
    title: `${data.venue.name} — Profil & Jadwal Kajian — Peta Kajian`,
    description: `Lihat profil, peta rute navigasi, fasilitas, dan seluruh jadwal kajian aktif di ${data.venue.name}, ${data.venue.city || 'Indonesia'}.`,
  };
}

export default async function MosqueDetailPage({ params }: MosqueDetailPageProps) {
  const { slug } = await params;
  const isAdmin = await checkIsServerAdmin();
  const data = await fetchMosqueBySlugOrId(slug, { includeTestData: isAdmin });

  if (!data) {
    notFound();
  }

  return <MosqueDetailClient venue={data.venue} sessions={data.sessions} />;
}
