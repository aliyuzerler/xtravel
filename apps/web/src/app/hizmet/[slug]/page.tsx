'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatPrice, formatDate } from '@/components/admin-ui';
import { getStoredAuth, apiFetch } from '@/lib/auth';

interface ServiceDetail {
  id: string;
  title: string;
  description: string | null;
  meetingPoint: string | null;
  latitude: number | null;
  longitude: number | null;
  durationHours: number | null;
  provider: { id: string; companyName: string; phone: string | null; description: string | null };
  category: { id: string; name: string; slug: string; iconName: string | null };
  city: { id: string; name: string; slug: string };
  images: Array<{ id: string; imageUrl: string; isMain: boolean; sortOrder: number }>;
  pricing: Array<{ id: string; name: string; price: number; currency: string; unit: string; description: string | null; isActive: boolean }>;
  schedules: Array<{ id: string; startAt: string; endAt: string; capacity: number; bookedCount: number }>;
}

export default function ServiceDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPricing, setSelectedPricing] = useState<string>('');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');

  useEffect(() => {
    if (!params?.slug) return;
    fetch(`/api/services/${params.slug}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success && r.data) {
          setService(r.data);
          if (r.data.pricing?.length > 0) setSelectedPricing(r.data.pricing[0].id);
        } else {
          setError(r.message || 'Hizmet bulunamadı');
        }
      });
  }, [params?.slug]);

  if (error) return <div style={{ padding: '4rem', textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (!service) return <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;

  const mainImage = service.images.find((i) => i.isMain) || service.images[0];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Breadcrumb */}
      <div style={{ background: '#f8fafc', padding: '0.75rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', fontSize: '0.85rem', color: '#64748b' }}>
          <Link href="/" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Ana Sayfa</Link>
          {' / '}
          <Link href={`/?category=${service.category.slug}`} style={{ color: '#0ea5e9', textDecoration: 'none' }}>{service.category.name}</Link>
          {' / '}
          <Link href={`/?city=${service.city.slug}`} style={{ color: '#0ea5e9', textDecoration: 'none' }}>{service.city.name}</Link>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 2rem', display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem' }}>
        {/* Sol: Görsel + açıklama */}
        <div>
          {mainImage && (
            <div style={{
              width: '100%',
              height: 360,
              borderRadius: 8,
              backgroundImage: `url(${mainImage.imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              marginBottom: '0.75rem',
            }} />
          )}

          {service.images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {service.images.map((img) => (
                <div key={img.id} style={{
                  width: 80, height: 60,
                  borderRadius: 4,
                  backgroundImage: `url(${img.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: img.isMain ? '2px solid #16a34a' : '1px solid #e2e8f0',
                }} />
              ))}
            </div>
          )}

          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#0f172a' }}>
            {service.title}
          </h1>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem', color: '#64748b' }}>
            {service.durationHours && <span>⏱ {service.durationHours} saat</span>}
            <span>📍 {service.city.name}</span>
            <span>🏢 {service.provider.companyName}</span>
          </div>

          <section style={{ background: 'white', padding: '1.5rem', borderRadius: 8, marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.75rem' }}>Açıklama</h2>
            <p style={{ color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
              {service.description || 'Açıklama yok.'}
            </p>
          </section>

          {service.meetingPoint && (
            <section style={{ background: 'white', padding: '1.5rem', borderRadius: 8, marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Buluşma Noktası</h2>
              <p style={{ color: '#334155', margin: 0 }}>{service.meetingPoint}</p>
              {service.latitude && service.longitude && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                  📌 Koordinatlar: {service.latitude.toFixed(4)}, {service.longitude.toFixed(4)}
                </div>
              )}
            </section>
          )}

          {service.provider.description && (
            <section style={{ background: 'white', padding: '1.5rem', borderRadius: 8, marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Sağlayıcı Hakkında</h2>
              <p style={{ color: '#334155', margin: 0 }}>{service.provider.description}</p>
            </section>
          )}
        </div>

        {/* Sağ: Rezervasyon paneli */}
        <div>
          <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', position: 'sticky', top: '1rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 1rem' }}>Rezervasyon</h2>

            <label style={labelStyle}>Fiyat varyantı</label>
            <select value={selectedPricing} onChange={(e) => setSelectedPricing(e.target.value)} style={selectStyle}>
              {service.pricing.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.price, p.currency)} ({p.unit === 'per_person' ? 'kişi başı' : 'grup'})</option>
              ))}
            </select>

            <label style={labelStyle}>Tarih / Saat</label>
            <select value={selectedSchedule} onChange={(e) => setSelectedSchedule(e.target.value)} style={selectStyle}>
              <option value="">Seçiniz...</option>
              {service.schedules.map((s) => {
                const remaining = s.capacity - s.bookedCount;
                return (
                  <option key={s.id} value={s.id}>
                    {formatDate(s.startAt)} ({remaining} yer kaldı)
                  </option>
                );
              })}
            </select>

            {service.schedules.length === 0 && (
              <div style={{ fontSize: '0.85rem', color: '#dc2626', marginTop: '0.5rem', padding: '0.5rem', background: '#fef2f2', borderRadius: 4 }}>
                Müsait tarih bulunamadı.
              </div>
            )}

            <button
              disabled={!selectedSchedule || !selectedPricing}
              onClick={() => {
                const auth = getStoredAuth();
                if (!auth.accessToken) {
                  router.push(`/login?next=/hizmet/${params.slug}`);
                  return;
                }
                // Rezervasyon Faz 4'te implement edilecek
                alert('Rezervasyon akışı yakında (Faz 4)');
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: !selectedSchedule || !selectedPricing ? '#94a3b8' : '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: '1rem',
                fontWeight: 600,
                cursor: !selectedSchedule || !selectedPricing ? 'not-allowed' : 'pointer',
                marginTop: '1rem',
              }}
            >
              Rezerve Et
            </button>

            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', textAlign: 'center' }}>
              Ödeme iyzico güvenliği ile yapılır · Ücretsiz iptal 24s öncesine
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem', color: '#475569' };
const selectStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.9rem', marginBottom: '1rem' };
