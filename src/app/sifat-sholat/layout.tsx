import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panduan Sifat Sholat Nabi ﷺ Sesuai Sunnah — Peta Kajian Indonesia',
  description:
    'Panduan lengkap tata cara dan bacaan sholat Nabi Muhammad ﷺ dari takbiratul ihram hingga salam sesuai hadits-hadits shahih, rukun, wajib, sunnah, teks Arab, latin, terjemahan, dan koreksi kesalahan.',
  openGraph: {
    title: 'Panduan Sifat Sholat Nabi ﷺ Sesuai Sunnah — Peta Kajian',
    description:
      'Panduan lengkap tata cara dan bacaan sholat Nabi Muhammad ﷺ dari takbiratul ihram hingga salam sesuai hadits-hadits shahih, rukun, wajib, sunnah, teks Arab, latin, terjemahan, dan koreksi kesalahan.',
    images: [
      {
        url: '/logo.png?v=3',
        width: 512,
        height: 512,
        alt: 'Sifat Sholat Nabi Sesuai Sunnah',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Panduan Sifat Sholat Nabi ﷺ Sesuai Sunnah — Peta Kajian',
    description:
      'Panduan lengkap tata cara dan bacaan sholat Nabi Muhammad ﷺ dari takbiratul ihram hingga salam sesuai hadits-hadits shahih.',
    images: ['/logo.png?v=3'],
  },
};

export default function SifatSholatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
