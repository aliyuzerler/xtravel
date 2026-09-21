import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ServiceDetailClient from './detail-client';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function getService(slug: string) {
  try {
    const r = await fetch(`${API_BASE}/api/services/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!r.ok) return null;
    const json = await r.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const s = await getService(params.slug);
  if (!s) {
    return {
      title: 'Hizmet bulunamadı',
      description: 'Aradığınız hizmet mevcut değil veya yayından kaldırılmış olabilir.',
      robots: { index: false, follow: false },
    };
  }
  const title = `${s.title} · ${s.city.name}`;
  const description = (s.description || '').slice(0, 160) || 'Turizm Pazaryeri hizmeti';
  const imageUrl = s.images?.find((i: any) => i.isMain)?.imageUrl || s.images?.[0]?.imageUrl;
  const fullUrl = `${SITE_URL}/hizmet/${s.slug}`;

  return {
    title,
    description,
    keywords: [s.title, s.category.name, s.city.name, 'tur', 'rezervasyon'],
    alternates: { canonical: fullUrl },
    openGraph: {
      type: 'article',
      locale: 'tr_TR',
      url: fullUrl,
      title,
      description,
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: s.title }] : undefined,
      siteName: 'Turizm Pazaryeri',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const service = await getService(params.slug);
  // Hizmet yoksa (yayında değil dahil) 404 sayfası göster
  if (!service) {
    notFound();
  }
  return <ServiceDetailClient slug={params.slug} initialService={service} />;
}
