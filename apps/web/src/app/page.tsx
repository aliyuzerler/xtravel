'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@/components/admin-ui';

interface ServiceItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  durationHours: number | null;
  startingPrice: number | null;
  category: { name: string; slug: string };
  city: { name: string; slug: string };
  images: Array<{ imageUrl: string; isMain: boolean }>;
  provider: { companyName: string };
}

interface Paginated { items: ServiceItem[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }
interface City { id: string; name: string; slug: string }
interface Category { id: string; name: string; slug: string; iconName: string | null }

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [services, setServices] = useState<Paginated | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const city = searchParams.get('city') || '';
  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.delete('page');
    router.push(`/?${params.toString()}`);
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/cities').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([c, cat]) => {
      setCities(c.data || []);
      setCategories(cat.data || []);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (city) params.set('city', city);
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);
    fetch(`/api/services?${params.toString()}`)
      .then((r) => r.json())
      .then((r) => setServices(r.data || null))
      .finally(() => setLoading(false));
  }, [city, category, search, sort, page]);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
        color: 'white',
        padding: '3rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0 }}>
            Turizm Pazaryeri
          </h1>
          <p style={{ fontSize: '1.05rem', marginTop: '0.5rem', opacity: 0.9 }}>
            Türkiye'nin her şehrinde kültür turları, gemi gezileri, doğa yürüyüşleri ve daha fazlası.
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', maxWidth: 600, margin: '1.5rem auto 0' }}>
            <input
              type="search"
              value={search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Hizmet ara..."
              style={{ flex: 1, padding: '0.75rem 1rem', border: 'none', borderRadius: 6, fontSize: '1rem' }}
            />
          </div>
        </div>
      </section>

      {/* Filters */}
      <section style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={city} onChange={(e) => updateFilter('city', e.target.value)} style={filterStyle}>
            <option value="">Tüm şehirler</option>
            {cities.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <select value={category} onChange={(e) => updateFilter('category', e.target.value)} style={filterStyle}>
            <option value="">Tüm kategoriler</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <select value={sort} onChange={(e) => updateFilter('sort', e.target.value)} style={filterStyle}>
            <option value="">Sıralama</option>
            <option value="newest">En yeni</option>
            <option value="price_asc">Fiyat (artan)</option>
            <option value="price_desc">Fiyat (azalan)</option>
            <option value="duration_asc">Süre (artan)</option>
            <option value="popular">Popüler</option>
            <option value="featured">Öne çıkanlar</option>
          </select>
          {(city || category || search || sort) && (
            <button onClick={() => router.push('/')} style={{ ...filterStyle, cursor: 'pointer', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
              Filtreleri Temizle
            </button>
          )}
        </div>
      </section>

      {/* Services grid */}
      <section style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            {services?.meta.totalItems || 0} hizmet bulundu
          </h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Yükleniyor...</div>
        ) : services && services.items.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {services.items.map((s) => (
              <Link
                key={s.id}
                href={`/hizmet/${s.slug}`}
                style={{
                  display: 'block',
                  background: 'white',
                  borderRadius: 8,
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
              >
                <div style={{
                  width: '100%',
                  height: 180,
                  background: `linear-gradient(135deg, #e0f2fe, #f0f9ff)`,
                  backgroundImage: s.images?.[0]?.imageUrl ? `url(${s.images[0].imageUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }} />
                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#0ea5e9', fontWeight: 600, textTransform: 'uppercase' }}>
                    {s.category.name} · {s.city.name}
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.5rem 0', color: '#0f172a', lineHeight: 1.3 }}>
                    {s.title}
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                    <div>
                      {s.startingPrice !== null && s.startingPrice !== undefined ? (
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a' }}>
                          {formatPrice(s.startingPrice)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Fiyat bilgisi yok</span>
                      )}
                      {s.startingPrice !== null && s.startingPrice !== undefined && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.25rem' }}>'den başlayan</span>
                      )}
                    </div>
                    {s.durationHours && (
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>⏱ {s.durationHours}s</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                    {s.provider.companyName}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔍</div>
            <p>Aradığınız kriterlerde hizmet bulunamadı.</p>
            <Link href="/" style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 500 }}>Tüm hizmetleri gör ←</Link>
          </div>
        )}

        {/* Pagination */}
        {services && services.meta.totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '2rem' }}>
            <button
              disabled={page <= 1}
              onClick={() => updateFilter('page', String(page - 1))}
              style={pageBtnStyle}
            >← Önceki</button>
            <span style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', color: '#475569' }}>
              Sayfa {page} / {services.meta.totalPages}
            </span>
            <button
              disabled={page >= services.meta.totalPages}
              onClick={() => updateFilter('page', String(page + 1))}
              style={pageBtnStyle}
            >Sonraki →</button>
          </div>
        )}
      </section>
    </div>
  );
}

const filterStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  border: '1px solid #e2e8f0',
  borderRadius: 4,
  fontSize: '0.9rem',
  background: 'white',
};

const pageBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  border: '1px solid #e2e8f0',
  background: 'white',
  color: '#0ea5e9',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.9rem',
};

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>}>
      <HomeContent />
    </Suspense>
  );
}
