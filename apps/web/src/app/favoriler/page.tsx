'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getStoredAuth } from '@/lib/auth';
import { formatPrice } from '@/components/admin-ui';

interface FavoriteItem {
  serviceId: string;
  createdAt: string;
  service: {
    id: string; title: string; slug: string; durationHours: number | null;
    status: string; avgRating: number | null; reviewCount: number;
    category: { name: string; slug: string };
    city: { name: string; slug: string };
    images: Array<{ imageUrl: string }>;
    pricing: Array<{ price: number }>;
  };
}

export default function FavoritesPage() {
  const router = useRouter();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth.accessToken) {
      router.replace('/login?next=/favoriler');
      return;
    }
    apiFetch<{ items: FavoriteItem[] }>('/api/user/favorites?limit=50').then((r) => {
      if (r.success && r.data) setItems(r.data.items || []);
      else setError(r.message || 'Yüklenemedi');
      setLoading(false);
    });
  }, [router]);

  async function removeFavorite(serviceId: string, idx: number) {
    // Optimistik kaldır
    const prev = items;
    setItems(items.filter((_, i) => i !== idx));
    const r = await apiFetch(`/api/services/${serviceId}/favorite`, { method: 'POST' });
    if (!r.success) {
      setItems(prev); // revert
      alert('Kaldırma başarısız');
    }
  }

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;

  return (
    <div style={{ minHeight: '100vh', maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem' }}>❤️ Favorilerim</h1>

      {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤍</div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Henüz favoriniz yok</h2>
          <p style={{ marginBottom: '1.5rem' }}>Beğendiğiniz hizmetleri favorilere ekleyerek sonradan kolayca ulaşabilirsiniz.</p>
          <Link href="/" style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: '#0ea5e9', color: 'white', textDecoration: 'none', borderRadius: 6, fontWeight: 600 }}>
            Hizmetleri Keşfet →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {items.map((fav, idx) => {
            const s = fav.service;
            const startingPrice = s.pricing?.[0]?.price ?? null;
            const mainImage = s.images?.[0]?.imageUrl;
            return (
              <div key={fav.serviceId} style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <Link href={`/hizmet/${s.slug}`} style={{ display: 'block' }}>
                  <div style={{
                    width: '100%', height: 180,
                    backgroundImage: mainImage ? `url(${mainImage})` : 'linear-gradient(135deg, #e0f2fe, #f0f9ff)',
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }} />
                </Link>
                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#0ea5e9', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    {s.category.name} · {s.city.name}
                  </div>
                  <Link href={`/hizmet/${s.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.5rem', color: '#0f172a' }}>{s.title}</h3>
                  </Link>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    {s.avgRating != null ? (
                      <span style={{ fontSize: '0.85rem' }}>
                        <span style={{ color: '#f59e0b' }}>★</span> <strong>{s.avgRating.toFixed(1)}</strong>
                        <span style={{ color: '#64748b' }}> ({s.reviewCount})</span>
                      </span>
                    ) : <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Yeni</span>}
                    {startingPrice != null && (
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#16a34a' }}>{formatPrice(startingPrice)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeFavorite(s.id, idx)}
                    style={{
                      width: '100%', padding: '0.5rem', background: '#fef2f2', color: '#dc2626',
                      border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                    }}
                  >
                    ❤️ Favoriden Çıkar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
