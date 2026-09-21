'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@/components/admin-ui';

interface ServiceItem {
  id: string;
  title: string;
  slug: string;
  durationHours: number | null;
  startingPrice: number | null;
  category: { name: string; slug: string };
  city: { name: string; slug: string };
  images: Array<{ imageUrl: string }>;
  provider: { companyName: string };
}
interface City { id: string; name: string; slug: string; _count?: { services: number } }
interface Category { id: string; name: string; slug: string; iconName: string | null; _count?: { services: number } }

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<ServiceItem[]>([]);
  const [popularCities, setPopularCities] = useState<City[]>([]);

  // Hero search state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || '');
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || '');
  const [participants, setParticipants] = useState('2');

  useEffect(() => {
    Promise.all([
      fetch('/api/cities').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/featured-services?limit=8').then((r) => r.json()),
    ]).then(([c, cat, f]) => {
      setCities(c.data || []);
      setCategories(cat.data || []);
      setFeatured(f.data || []);
    });
  }, []);

  // Şehirleri hizmet sayısına göre popülerite sırala — backend henüz _count dönmediği için
  // featured-services üzerinden şehir sayısını türetelim
  useEffect(() => {
    if (featured.length === 0) return;
    const cityCount: Record<string, number> = {};
    featured.forEach((s) => {
      const key = s.city.slug;
      cityCount[key] = (cityCount[key] || 0) + 1;
    });
    const popular = cities
      .map((c) => ({ ...c, _count: { services: cityCount[c.slug] || 0 } }))
      .sort((a, b) => (b._count?.services || 0) - (a._count?.services || 0))
      .slice(0, 8);
    setPopularCities(popular);
  }, [featured, cities]);

  function handleSearch() {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedCity) params.set('city', selectedCity);
    if (selectedDate) params.set('date', selectedDate);
    router.push(`/ara?${params.toString()}`);
  }

  return (
    <div>
      {/* HERO */}
      <section style={{
        background: 'linear-gradient(135deg, #0ea5e9 0%, #1e40af 100%)',
        color: 'white',
        padding: '4rem 2rem 3rem',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.75rem', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
            Türkiye'nin her şehrinde<br />unutulmaz deneyimler
          </h1>
          <p style={{ fontSize: '1.1rem', marginTop: '0.75rem', opacity: 0.9 }}>
            Kültür turları, gemi gezileri, doğa yürüyüşleri ve daha fazlası — tek platformda.
          </p>

          {/* Arama çubuğu */}
          <div style={{
            marginTop: '2rem',
            background: 'white',
            borderRadius: 12,
            padding: '0.75rem',
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            color: '#0f172a',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 200px', textAlign: 'left', padding: '0 0.5rem' }}>
              <label style={heroLabel}>Nereye</label>
              <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} style={heroSelect}>
                <option value="">Tüm şehirler</option>
                {cities.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 160px', textAlign: 'left', padding: '0 0.5rem' }}>
              <label style={heroLabel}>Ne zaman</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={heroInput} />
            </div>
            <div style={{ flex: '0 1 100px', textAlign: 'left', padding: '0 0.5rem' }}>
              <label style={heroLabel}>Kişi</label>
              <input type="number" min="1" max="20" value={participants} onChange={(e) => setParticipants(e.target.value)} style={heroInput} />
            </div>
            <div style={{ flex: '1 1 200px', textAlign: 'left', padding: '0 0.5rem' }}>
              <label style={heroLabel}>Arama</label>
              <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Hizmet adı, anahtar kelime..." style={heroInput} />
            </div>
            <button onClick={handleSearch} style={{
              background: '#16a34a', color: 'white', border: 'none', borderRadius: 8,
              padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
              alignSelf: 'flex-end',
            }}>🔍 Ara</button>
          </div>
        </div>
      </section>

      {/* KATEGORİ KARTLARI */}
      <section style={{ maxWidth: 1100, margin: '3rem auto', padding: '0 2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' }}>Kategorilere göz at</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          {categories.map((cat) => (
            <Link key={cat.id} href={`/ara?category=${cat.slug}`} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '1.5rem 1rem', background: 'white', borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textDecoration: 'none', color: 'inherit',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{categoryIcon(cat.iconName)}</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{cat.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{cat._count?.services || 0} hizmet</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ÖNE ÇIKAN HİZMETLER */}
      <section style={{ maxWidth: 1100, margin: '0 auto 3rem', padding: '0 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Öne çıkan hizmetler</h2>
          <Link href="/ara?sort=featured" style={{ color: '#0ea5e9', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Tümünü gör →</Link>
        </div>
        {featured.length === 0 ? (
          <SkeletonGrid count={4} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
            {featured.map((s) => <ServiceCard key={s.id} service={s} />)}
          </div>
        )}
      </section>

      {/* POPÜLER ŞEHİRLER */}
      {popularCities.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto 3rem', padding: '0 2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' }}>Popüler şehirler</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
            {popularCities.map((c) => (
              <Link key={c.id} href={`/sehir/${c.slug}`} style={{
                display: 'block', padding: '1.5rem 1rem', background: 'white', borderRadius: 8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textDecoration: 'none', color: 'inherit',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📍</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{c._count?.services || 0} hizmet</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceItem }) {
  return (
    <Link href={`/hizmet/${service.slug}`} style={cardStyle}>
      <div style={{
        width: '100%', height: 180,
        backgroundImage: service.images?.[0]?.imageUrl ? `url(${service.images[0].imageUrl})` : undefined,
        background: service.images?.[0]?.imageUrl ? undefined : 'linear-gradient(135deg, #e0f2fe, #f0f9ff)',
        backgroundSize: 'cover', backgroundPosition: 'center',
      }} />
      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: '0.7rem', color: '#0ea5e9', fontWeight: 600, textTransform: 'uppercase' }}>
          {service.category.name} · {service.city.name}
        </div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0.5rem 0', lineHeight: 1.3, color: '#0f172a' }}>
          {service.title}
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
          <div>
            {service.startingPrice != null ? (
              <>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a' }}>{formatPrice(service.startingPrice)}</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '0.25rem' }}>'den</span>
              </>
            ) : (
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Fiyat bilgisi yok</span>
            )}
          </div>
          {service.durationHours && (
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>⏱ {service.durationHours}s</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ width: '100%', height: 180, background: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ height: 12, width: '40%', background: '#e2e8f0', borderRadius: 4, marginBottom: '0.5rem' }} />
            <div style={{ height: 18, width: '80%', background: '#e2e8f0', borderRadius: 4, marginBottom: '0.5rem' }} />
            <div style={{ height: 14, width: '30%', background: '#e2e8f0', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function categoryIcon(name: string | null): string {
  const map: Record<string, string> = {
    landmark: '🏛️', ship: '🚢', utensils: '🍽️', mountain: '⛰️', building: '🏛️', 'map-pin': '📍',
  };
  return map[name || ''] || '🎯';
}

const heroLabel: React.CSSProperties = { display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.15rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' };
const heroInput: React.CSSProperties = { width: '100%', border: 'none', outline: 'none', fontSize: '0.95rem', padding: '0.25rem 0', background: 'transparent', color: '#0f172a' };
const heroSelect: React.CSSProperties = { ...heroInput, cursor: 'pointer' };
const cardStyle: React.CSSProperties = {
  display: 'block', background: 'white', borderRadius: 8, overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textDecoration: 'none', color: 'inherit',
  transition: 'transform 0.15s, box-shadow 0.15s',
};

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>}>
      <HomeContent />
    </Suspense>
  );
}
