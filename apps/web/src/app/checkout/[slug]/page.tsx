'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatPrice, formatDate } from '@/components/admin-ui';
import { getStoredAuth, apiFetch } from '@/lib/auth';

interface ServiceDetail {
  id: string; title: string; slug: string;
  meetingPoint: string | null;
  provider: { id: string; companyName: string };
  category: { name: string };
  city: { name: string };
  images: Array<{ imageUrl: string; isMain: boolean }>;
  pricing: Array<{ id: string; name: string; price: number; currency: string; unit: string }>;
  schedules: Array<{ id: string; startAt: string; endAt: string; capacity: number; bookedCount: number }>;
}

function CheckoutContent() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const slug = params?.slug || '';
  const scheduleId = searchParams.get('schedule') || '';
  const pricingId = searchParams.get('pricing') || '';
  const participants = parseInt(searchParams.get('participants') || '1', 10);

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contact form state
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth.accessToken) {
      const returnUrl = `/checkout/${slug}?schedule=${scheduleId}&pricing=${pricingId}&participants=${participants}`;
      router.replace(`/login?next=${encodeURIComponent(returnUrl)}`);
      return;
    }
    if (auth.user) {
      setContact({
        name: auth.user.fullName || '',
        email: auth.user.email || '',
        phone: auth.user.phone || '',
      });
    }
  }, [router, slug, scheduleId, pricingId, participants]);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/services/${slug}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success && r.data) {
          setService(r.data);
          // Eğer seçili schedule/pricing artık geçerli değilse uyarı
          if (!r.data.pricing.find((p: any) => p.id === pricingId)) {
            setError('Seçtiğiniz fiyat varyantı artık geçerli değil.');
          } else if (!r.data.schedules.find((s: any) => s.id === scheduleId)) {
            setError('Seçtiğiniz takvim slotu artık müsait değil.');
          }
        } else {
          setError('Hizmet bulunamadı.');
        }
      })
      .finally(() => setLoading(false));
  }, [slug, scheduleId, pricingId]);

  function calculateTotal() {
    if (!service) return { unit: 0, total: 0 };
    const pricing = service.pricing.find((p) => p.id === pricingId);
    if (!pricing) return { unit: 0, total: 0 };
    const total = pricing.unit === 'per_person' ? pricing.price * participants : pricing.price;
    return { unit: pricing.price, total };
  }

  function proceed() {
    setFormError(null);
    if (!contact.name || contact.name.length < 2) { setFormError('Ad soyad gerekli'); return; }
    if (!contact.email || !/.+@.+\..+/.test(contact.email)) { setFormError('Geçerli bir e-posta girin'); return; }
    if (!contact.phone || contact.phone.length < 7) { setFormError('Geçerli bir telefon numarası girin'); return; }
    // Ödeme Faz 5'te entegre edilecek; şimdilik mock
    alert('Ödeme entegrasyonu yakında (Faz 5). Seçim özetiniz kaydedildi — bir sonraki fazda buradan iyzico ödeme sayfasına yönlendirileceksiniz.');
  }

  if (loading) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
      <div className="skeleton" style={{ width: '50%', height: 200, margin: '0 auto 1rem', borderRadius: 8 }} />
      <div className="skeleton" style={{ width: '40%', height: 24, margin: '0 auto', borderRadius: 4 }} />
    </div>;
  }

  if (error) {
    return <div style={{ maxWidth: 600, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚠️</div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{error}</h1>
      <Link href={slug ? `/hizmet/${slug}` : '/'} style={{ color: '#0ea5e9', textDecoration: 'none' }}>Hizmete dön ←</Link>
    </div>;
  }

  if (!service) return null;

  const { unit, total } = calculateTotal();
  const mainImage = service.images?.find((i) => i.isMain) || service.images?.[0];
  const schedule = service.schedules?.find((s) => s.id === scheduleId);
  const pricing = service.pricing?.find((p) => p.id === pricingId);

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ background: '#f8fafc', padding: '0.75rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', fontSize: '0.85rem', color: '#64748b' }}>
          <Link href={`/hizmet/${slug}`} style={{ color: '#0ea5e9' }}>← Hizmete dön</Link>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '1.5rem auto', padding: '0 2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 1.5rem' }}>Seçim Özeti</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }}>
          {/* SOL: İletişim bilgileri formu */}
          <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem' }}>İletişim Bilgileri</h2>

            {formError && (
              <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', color: '#dc2626', borderRadius: 4, marginBottom: '1rem', fontSize: '0.9rem' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Ad Soyad *</label>
                <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} style={inputStyle} placeholder="Adınız soyadınız" />
              </div>
              <div>
                <label style={labelStyle}>E-posta *</label>
                <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} style={inputStyle} placeholder="ornek@email.com" />
              </div>
              <div>
                <label style={labelStyle}>Telefon *</label>
                <input type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} style={inputStyle} placeholder="+90 5XX XXX XX XX" />
              </div>
            </div>

            <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: 6, marginTop: '1.5rem', fontSize: '0.85rem', color: '#475569' }}>
              <strong>📝 Bilgi:</strong> Ödeme entegrasyonu bir sonraki fazda eklenecek.
              Bu adımda yalnızca seçim özetinizi görmektesiniz; gerçek rezervasyon ve ödeme Faz 5'te aktif olacak.
            </div>
          </div>

          {/* SAĞ: Sipariş özeti */}
          <div>
            <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', position: 'sticky', top: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem' }}>Sipariş Özeti</h2>

              {mainImage && (
                <div style={{
                  width: '100%', height: 140, borderRadius: 6, marginBottom: '0.75rem',
                  backgroundImage: `url(${mainImage.imageUrl})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }} />
              )}

              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>{service.title}</h3>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                📍 {service.city.name} · 🏷 {service.category.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
                🏢 {service.provider.companyName}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginBottom: '0.75rem' }}>
                <Row label="Varyant" value={pricing?.name || '-'} />
                <Row label="Birim fiyat" value={unit > 0 ? formatPrice(unit) : '-'} />
                {pricing?.unit === 'per_person' && <Row label="Kişi" value={`${participants} kişi`} />}
                <Row label="Tarih" value={schedule ? formatDate(schedule.startAt) : '-'} />
              </div>

              <div style={{ background: '#f0fdf4', padding: '0.75rem 1rem', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Toplam</span>
                <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '1.1rem' }}>{formatPrice(total)}</span>
              </div>

              <button
                onClick={proceed}
                style={{
                  width: '100%', marginTop: '1rem', padding: '0.85rem',
                  background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 6,
                  fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                }}
              >Devam Et →</button>

              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', textAlign: 'center' }}>
                🔒 Ödeme iyzico güvencesiyle yapılır
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.25rem 0' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#0f172a' }}>{value}</span>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem', color: '#475569' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.9rem' };

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
