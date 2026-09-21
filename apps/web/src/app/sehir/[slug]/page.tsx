'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { formatPrice } from '@/components/admin-ui';

interface ServiceItem {
  id: string; title: string; slug: string; durationHours: number | null; startingPrice: number | null;
  category: { name: string; slug: string }; city: { name: string; slug: string };
  images: Array<{ imageUrl: string }>; provider: { companyName: string };
}
interface Paginated { items: ServiceItem[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }
interface Category { id: string; name: string; slug: string }

function CityListingContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityName, setCityName] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);

  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    if (!params?.slug) return;
    fetch('/api/cities').then((r) => r.json()).then((r) => {
      const c = (r.data || []).find((c: any) => c.slug === params.slug);
      if (c) setCityName(c.name);
    });
    fetch('/api/categories').then((r) => r.json()).then((r) => setCategories(r.data || []));
  }, [params?.slug]);

  useEffect(() => {
    if (!params?.slug) return;
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '12', city: params.slug });
    if (category) p.set('category', category);
    if (sort) p.set('sort', sort);
    if (minPrice) p.set('minPrice', minPrice);
    if (maxPrice) p.set('maxPrice', maxPrice);
    fetch(`/api/services?${p.toString()}`)
      .then((r) => r.json())
      .then((r) => setData(r.data || null))
      .finally(() => setLoading(false));
  }, [params?.slug, page, category, sort, minPrice, maxPrice]);

  function updateUrl(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    if (key !== 'page') p.delete('page');
    router.push(`/sehir/${params.slug}?${p.toString()}`, { scroll: false });
  }

  function clearAll() {
    router.push(`/sehir/${params.slug}`);
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)', color: 'white', padding: '2.5rem 2rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>
          {cityName || 'Yükleniyor...'} hizmetleri
        </h1>
        <p style={{ marginTop: '0.5rem', opacity: 0.9 }}>{data?.meta.totalItems || 0} hizmet bulundu</p>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
        <aside>
          <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', position: 'sticky', top: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Filtreler</h3>
              {(category || sort || minPrice || maxPrice) && (
                <button onClick={clearAll} style={{ fontSize: '0.75rem', color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, width: 'auto' }}>Temizle</button>
              )}
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={filterLabel}>Kategori</label>
              <select value={category} onChange={(e) => updateUrl('category', e.target.value)} style={filterSelect}>
                <option value="">Tüm kategoriler</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={filterLabel}>Fiyat aralığı (₺)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" min="0" placeholder="Min" value={minPrice} onChange={(e) => updateUrl('minPrice', e.target.value)} style={{ ...filterSelect, width: '50%' }} />
                <input type="number" min="0" placeholder="Max" value={maxPrice} onChange={(e) => updateUrl('maxPrice', e.target.value)} style={{ ...filterSelect, width: '50%' }} />
              </div>
            </div>
            <div>
              <label style={filterLabel}>Sıralama</label>
              <select value={sort} onChange={(e) => updateUrl('sort', e.target.value)} style={filterSelect}>
                <option value="">En yeni</option>
                <option value="price_asc">Fiyat (artan)</option>
                <option value="price_desc">Fiyat (azalan)</option>
                <option value="duration_asc">Süre (artan)</option>
                <option value="popular">Popüler</option>
              </select>
            </div>
          </div>
        </aside>

        <div>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div className="skeleton" style={{ width: '100%', height: 180 }} />
                  <div style={{ padding: '1rem 1.25rem' }}>
                    <div className="skeleton" style={{ height: 10, width: '40%', marginBottom: '0.5rem', borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: '0.5rem', borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 14, width: '30%', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
                {data.items.map((s) => (
                  <a key={s.id} href={`/hizmet/${s.slug}`} style={cardStyle}>
                    <div style={{
                      width: '100%', height: 180,
                      backgroundImage: s.images?.[0]?.imageUrl ? `url(${s.images[0].imageUrl})` : undefined,
                      background: s.images?.[0]?.imageUrl ? undefined : 'linear-gradient(135deg, #e0f2fe, #f0f9ff)',
                      backgroundSize: 'cover', backgroundPosition: 'center',
                    }} />
                    <div style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#0ea5e9', fontWeight: 600, textTransform: 'uppercase' }}>
                        {s.category.name}
                      </div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0.5rem 0', color: '#0f172a', lineHeight: 1.3 }}>{s.title}</h3>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {s.startingPrice != null ? (
                          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a' }}>{formatPrice(s.startingPrice)}</span>
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Fiyat yok</span>
                        )}
                        {s.durationHours && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>⏱ {s.durationHours}s</span>}
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              {data.meta.totalPages > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '2rem' }}>
                  <button onClick={() => updateUrl('page', String(Math.max(1, page - 1)))} disabled={page <= 1} style={{ ...pageBtnStyle, opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>← Önceki</button>
                  <span style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Sayfa {page} / {data.meta.totalPages}</span>
                  <button onClick={() => updateUrl('page', String(Math.min(data.meta.totalPages, page + 1)))} disabled={page >= data.meta.totalPages} style={{ ...pageBtnStyle, opacity: page >= data.meta.totalPages ? 0.5 : 1, cursor: page >= data.meta.totalPages ? 'not-allowed' : 'pointer' }}>Sonraki →</button>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔍</div>
              <p style={{ fontSize: '1.1rem' }}>Bu şehirde hizmet bulunamadı.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const filterLabel: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' };
const filterSelect: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.9rem', background: 'white' };
const cardStyle: React.CSSProperties = { display: 'block', background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', color: 'inherit' };
const pageBtnStyle: React.CSSProperties = { padding: '0.5rem 1rem', border: '1px solid #e2e8f0', background: 'white', color: '#0ea5e9', borderRadius: 4, fontSize: '0.9rem', width: 'auto' };

export default function CityPage() {
  return (
    <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>}>
      <CityListingContent />
    </Suspense>
  );
}
