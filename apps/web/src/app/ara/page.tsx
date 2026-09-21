'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatPrice } from '@/components/admin-ui';

interface ServiceItem {
  id: string; title: string; slug: string; durationHours: number | null; startingPrice: number | null;
  category: { name: string; slug: string }; city: { name: string; slug: string };
  images: Array<{ imageUrl: string }>; provider: { companyName: string };
}
interface Paginated { items: ServiceItem[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }
interface City { id: string; name: string; slug: string }
interface Category { id: string; name: string; slug: string }

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // URL'den filter state
  const search = searchParams.get('search') || '';
  const city = searchParams.get('city') || '';
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const date = searchParams.get('date') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Debounced search — input'ta yazdıkça URL'i günceller
  useEffect(() => {
    const t = setTimeout(() => {
      if (debouncedSearch !== search) {
        updateUrl('search', debouncedSearch);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [debouncedSearch]);

  // İlk yüklede debounced search'i URL'den al
  useEffect(() => {
    setDebouncedSearch(search);
  }, [search]);

  // Şehir ve kategorileri yükle
  useEffect(() => {
    Promise.all([
      fetch('/api/cities').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([c, cat]) => {
      setCities(c.data || []);
      setCategories(cat.data || []);
    });
  }, []);

  // Hizmetleri yükle
  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (search) params.set('search', search);
    if (city) params.set('city', city);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (date) params.set('date', date);
    fetch(`/api/services?${params.toString()}`)
      .then((r) => r.json())
      .then((r) => setData(r.data || null))
      .finally(() => setLoading(false));
  }, [page, search, city, category, sort, minPrice, maxPrice, date]);

  useEffect(() => { loadData(); }, [loadData]);

  function updateUrl(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.delete('page');
    router.push(`/ara?${params.toString()}`, { scroll: false });
  }

  function clearAll() {
    router.push('/ara');
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <input
            type="search"
            value={debouncedSearch}
            onChange={(e) => setDebouncedSearch(e.target.value)}
            placeholder="🔍 Hizmet ara (başlık, anahtar kelime)..."
            style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '1rem' }}
          />
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
        {/* SIDEBAR: Filtreler */}
        <aside>
          <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', position: 'sticky', top: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Filtreler</h3>
              {(city || category || minPrice || maxPrice || date) && (
                <button onClick={clearAll} style={{ fontSize: '0.75rem', color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, width: 'auto' }}>Temizle</button>
              )}
            </div>

            {/* Şehir */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={filterLabel}>Şehir</label>
              <select value={city} onChange={(e) => updateUrl('city', e.target.value)} style={filterSelect}>
                <option value="">Tüm şehirler</option>
                {cities.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>

            {/* Kategori */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={filterLabel}>Kategori</label>
              <select value={category} onChange={(e) => updateUrl('category', e.target.value)} style={filterSelect}>
                <option value="">Tüm kategoriler</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>

            {/* Fiyat aralığı */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={filterLabel}>Fiyat aralığı (₺)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" min="0" placeholder="Min" value={minPrice} onChange={(e) => updateUrl('minPrice', e.target.value)} style={{ ...filterSelect, width: '50%' }} />
                <input type="number" min="0" placeholder="Max" value={maxPrice} onChange={(e) => updateUrl('maxPrice', e.target.value)} style={{ ...filterSelect, width: '50%' }} />
              </div>
            </div>

            {/* Tarih */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={filterLabel}>Tarih</label>
              <input type="date" value={date} onChange={(e) => updateUrl('date', e.target.value)} style={filterSelect} />
            </div>

            {/* Sıralama */}
            <div>
              <label style={filterLabel}>Sıralama</label>
              <select value={sort} onChange={(e) => updateUrl('sort', e.target.value)} style={filterSelect}>
                <option value="">En yeni</option>
                <option value="price_asc">Fiyat (artan)</option>
                <option value="price_desc">Fiyat (azalan)</option>
                <option value="duration_asc">Süre (artan)</option>
                <option value="popular">Popüler</option>
                <option value="featured">Öne çıkanlar</option>
              </select>
            </div>
          </div>
        </aside>

        {/* SONUÇLAR */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
              {loading ? 'Yükleniyor...' : `${data?.meta.totalItems || 0} hizmet bulundu`}
            </h1>
          </div>

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
                        {s.category.name} · {s.city.name}
                      </div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0.5rem 0', color: '#0f172a', lineHeight: 1.3 }}>
                        {s.title}
                      </h3>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {s.startingPrice != null ? (
                          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a' }}>
                            {formatPrice(s.startingPrice)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Fiyat yok</span>
                        )}
                        {s.durationHours && (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>⏱ {s.durationHours}s</span>
                        )}
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
              <p style={{ fontSize: '1.1rem' }}>Aradığınız kriterlerde hizmet bulunamadı.</p>
              <button onClick={clearAll} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', width: 'auto', display: 'inline-block' }}>Filtreleri temizle</button>
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

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>}>
      <SearchContent />
    </Suspense>
  );
}
