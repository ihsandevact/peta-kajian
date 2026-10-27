import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Artikel & Faidah Islam Sunnah — Peta Kajian Indonesia',
  description:
    'Kumpulan artikel, faidah ilmu, dan fatwa syariah dari portal dakwah Ahlus Sunnah terpercaya (Muslim.or.id, Rumaysho.com, KonsultasiSyariah.com, Almanhaj.or.id).',
  openGraph: {
    title: 'Artikel & Faidah Islam Sunnah — Peta Kajian Indonesia',
    description:
      'Kumpulan artikel, faidah ilmu, dan fatwa syariah dari portal dakwah Ahlus Sunnah terpercaya dengan amanah ilmiah dan rujukan shahih.',
    images: [
      {
        url: '/logo.png?v=3',
        width: 512,
        height: 512,
        alt: 'Artikel & Faidah Islam Sunnah',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Artikel & Faidah Islam Sunnah — Peta Kajian Indonesia',
    description:
      'Kumpulan artikel, faidah ilmu, dan fatwa syariah dari portal dakwah Ahlus Sunnah terpercaya.',
    images: ['/logo.png?v=3'],
  },
};

export default function ArtikelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
