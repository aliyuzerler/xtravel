import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
const SITE_NAME = 'Turizm Pazaryeri';
const SITE_DESC = "Türkiye'nin her şehrinde kültür turları, gemi gezileri, doğa yürüyüşleri ve daha fazlası — tek platformda.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Turizm Hizmetleri Pazaryeri`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESC,
  keywords: ['tur', 'turizm', 'kültür turu', 'gemi turu', 'doğa yürüyüşü', 'şehir turu', 'Türkiye', 'rezervasyon'],
  authors: [{ name: SITE_NAME }],
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Turizm Hizmetleri Pazaryeri`,
    description: SITE_DESC,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Turizm Hizmetleri Pazaryeri`,
    description: SITE_DESC,
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: { canonical: SITE_URL },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0ea5e9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
