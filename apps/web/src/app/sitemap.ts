const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

export default async function sitemap() {
  const urls: Array<{ url: string; changeFrequency: string; priority: number; lastModified?: Date }> = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1.0, lastModified: new Date() },
    { url: `${SITE_URL}/ara`, changeFrequency: 'daily', priority: 0.9, lastModified: new Date() },
  ];

  // Tüm şehirleri ekle
  try {
    const citiesRes = await fetch(`${API_BASE}/api/cities`, { next: { revalidate: 3600 } });
    if (citiesRes.ok) {
      const citiesJson = await citiesRes.json();
      for (const c of citiesJson.data || []) {
        urls.push({ url: `${SITE_URL}/sehir/${c.slug}`, changeFrequency: 'weekly', priority: 0.8 });
      }
    }
  } catch {}

  // Tüm kategorileri ekle
  try {
    const catRes = await fetch(`${API_BASE}/api/categories`, { next: { revalidate: 3600 } });
    if (catRes.ok) {
      const catJson = await catRes.json();
      for (const c of catJson.data || []) {
        urls.push({ url: `${SITE_URL}/ara?category=${c.slug}`, changeFrequency: 'weekly', priority: 0.7 });
      }
    }
  } catch {}

  // Tüm yayınlı hizmetleri ekle
  try {
    let page = 1;
    while (page <= 10) {
      const servicesRes = await fetch(`${API_BASE}/api/services?page=${page}&limit=20`, { next: { revalidate: 3600 } });
      if (!servicesRes.ok) break;
      const servicesJson = await servicesRes.json();
      const items = servicesJson.data?.items || [];
      if (items.length === 0) break;
      for (const s of items) {
        urls.push({ url: `${SITE_URL}/hizmet/${s.slug}`, changeFrequency: 'weekly', priority: 0.9 });
      }
      if (items.length < 20) break;
      page++;
    }
  } catch {}

  return urls;
}
