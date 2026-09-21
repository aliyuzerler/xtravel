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
  const [step, setStep] = useState<'summary' | 'payment' | 'success' | 'failure'>('summary');

  // Contact form state
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [reservation, setReservation] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);

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

  async function proceedToPayment() {
    setFormError(null);
    if (!contact.name || contact.name.length < 2) { setFormError('Ad soyad gerekli'); return; }
    if (!contact.email || !/.+@.+\..+/.test(contact.email)) { setFormError('Geçerli bir e-posta girin'); return; }
    if (!contact.phone || contact.phone.length < 7) { setFormError('Geçerli bir telefon numarası girin'); return; }

    setProcessing(true);
    // 1. Rezervasyon oluştur (pending_payment)
    if (!service) {
      setProcessing(false);
      setFormError('Hizmet bilgisi eksik');
      return;
    }
    const resResult = await apiFetch('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        serviceId: service.id,
        scheduleId,
        pricingId,
        participantCount: participants,
        contactName: contact.name,
        contactEmail: contact.email,
        contactPhone: contact.phone,
      }),
    });
    setProcessing(false);

    if (!resResult.success || !resResult.data) {
      setFormError(resResult.message || 'Rezervasyon oluşturulamadı');
      return;
    }

    setReservation(resResult.data);
    setStep('payment');
  }

  async function startPayment() {
    if (!reservation) return;
    setProcessing(true);
    const payResult = await apiFetch('/api/payments/init', {
      method: 'POST',
      body: JSON.stringify({ reservationId: reservation.id }),
    });
    setProcessing(false);

    if (!payResult.success || !payResult.data) {
      setFormError(payResult.message || 'Ödeme başlatılamadı');
      return;
    }

    setPayment(payResult.data);
    // Sandbox: mock checkout — kullanıcıya 2 buton göster (başarı/başarısız)
    // Üretimde: iyzico checkout form iframe'i yüklenir
  }

  async function completePayment(status: 'success' | 'failure') {
    if (!payment) return;
    setProcessing(true);
    const cbResult = await apiFetch(`/api/payments/mock-callback?paymentId=${payment.paymentId}&status=${status}`);
    setProcessing(false);

    if (status === 'success' && cbResult.success) {
      setStep('success');
    } else if (status === 'failure') {
      setStep('failure');
    }
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
        {/* Stepper */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'white', borderRadius: 8, padding: '0.75rem' }}>
          {[
            { n: 'summary', label: 'Özet', icon: '📋' },
            { n: 'payment', label: 'Ödeme', icon: '💳' },
            { n: 'success', label: 'Sonuç', icon: step === 'success' ? '✓' : step === 'failure' ? '✗' : '→' },
          ].map((s, idx) => {
            const isActive = step === s.n;
            const isPassed = (step === 'payment' && s.n === 'summary') || (step === 'success' && s.n !== 'success') || (step === 'failure' && s.n !== 'success');
            return (
              <div key={s.n} style={{ flex: 1, textAlign: 'center', padding: '0.5rem', borderRadius: 4, background: isActive ? '#0ea5e9' : isPassed ? '#dcfce7' : '#f8fafc', color: isActive ? 'white' : isPassed ? '#16a34a' : '#64748b' }}>
                <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* STEP: SUCCESS */}
        {step === 'success' && (
          <div style={{ background: 'white', borderRadius: 8, padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✓</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.5rem' }}>Ödemeniz Alındı!</h1>
            <p style={{ fontSize: '1.05rem', color: '#475569', marginBottom: '1.5rem' }}>
              Rezervasyonunuz başarıyla oluşturuldu ve onaylandı.
            </p>
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '1.5rem', maxWidth: 400, margin: '0 auto 1.5rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Rezervasyon Kodu:</span>
                <strong style={{ color: '#16a34a', fontFamily: 'monospace' }}>{reservation?.reservationCode}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Hizmet:</span>
                <strong>{service.title}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Tarih:</span>
                <strong>{schedule ? formatDate(schedule.startAt) : '-'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #bbf7d0', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Toplam:</span>
                <strong style={{ color: '#16a34a' }}>{formatPrice(total)}</strong>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
              📧 Onay e-postası {contact.email} adresine gönderildi.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <a href="/reservations" style={{ padding: '0.75rem 1.5rem', background: '#0ea5e9', color: 'white', textDecoration: 'none', borderRadius: 6, fontWeight: 600 }}>Rezervasyonlarım</a>
              <a href="/" style={{ padding: '0.75rem 1.5rem', background: 'white', color: '#0ea5e9', border: '1px solid #0ea5e9', textDecoration: 'none', borderRadius: 6, fontWeight: 600 }}>Ana Sayfa</a>
            </div>
          </div>
        )}

        {/* STEP: FAILURE */}
        {step === 'failure' && (
          <div style={{ background: 'white', borderRadius: 8, padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✗</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.5rem' }}>Ödeme Başarısız</h1>
            <p style={{ fontSize: '1.05rem', color: '#475569', marginBottom: '1.5rem' }}>
              Ödemeniz alınamadı. Rezervasyonunuz 15 dakika içinde geçerli olacak; bu süre içinde tekrar deneyebilirsiniz.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button onClick={() => setStep('payment')} style={{ padding: '0.75rem 1.5rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', width: 'auto' }}>Tekrar Dene</button>
              <a href="/reservations" style={{ padding: '0.75rem 1.5rem', background: 'white', color: '#0ea5e9', border: '1px solid #0ea5e9', textDecoration: 'none', borderRadius: 6, fontWeight: 600 }}>Rezervasyonlarım</a>
            </div>
          </div>
        )}

        {/* STEP: SUMMARY */}
        {step === 'summary' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }}>
            <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem' }}>İletişim Bilgileri</h2>
              {formError && (
                <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', color: '#dc2626', borderRadius: 4, marginBottom: '1rem', fontSize: '0.9rem' }}>{formError}</div>
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
              <div style={{ marginTop: '1.5rem' }}>
                <button onClick={proceedToPayment} disabled={processing} style={{ padding: '0.85rem 2rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', width: 'auto' }}>
                  {processing ? 'İşleniyor...' : 'Ödemeye Devam Et →'}
                </button>
              </div>
            </div>

            <div>
              <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', position: 'sticky', top: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem' }}>Sipariş Özeti</h2>
                {mainImage && (
                  <div style={{ width: '100%', height: 140, borderRadius: 6, marginBottom: '0.75rem', backgroundImage: `url(${mainImage.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                )}
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>{service.title}</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>📍 {service.city.name} · 🏷 {service.category.name}</div>
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
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', textAlign: 'center' }}>🔒 Ödeme iyzico güvencesiyle yapılır</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP: PAYMENT */}
        {step === 'payment' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }}>
            <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem' }}>Ödeme</h2>

              {!payment ? (
                <>
                  <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1rem' }}>
                    Rezervasyonunuz <strong>{reservation?.reservationCode}</strong> koduyla oluşturuldu (pending_payment).
                    Ödemeyi tamamlamak için aşağıdaki butona tıklayın.
                  </p>
                  <div style={{ background: '#fef3c7', padding: '0.75rem 1rem', borderRadius: 4, marginBottom: '1rem', fontSize: '0.85rem', color: '#92400e' }}>
                    ⏰ 15 dakika içinde ödeme yapmazsanız rezervasyonunuz otomatik iptal edilecek.
                  </div>
                  <button onClick={startPayment} disabled={processing} style={{ padding: '0.85rem 2rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', width: 'auto' }}>
                    {processing ? 'Başlatılıyor...' : 'Ödeme Sayfasını Aç'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: 6, marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.25rem' }}>Payment ID</div>
                    <code style={{ fontSize: '0.8rem' }}>{payment.paymentId}</code>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1rem' }}>
                    Sandbox test modu: Aşağıdaki butonlardan birini seçerek ödeme senaryosunu simüle edin.
                    Üretimde bu alan iyzico checkout form iframe'i olur.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => completePayment('success')} disabled={processing} style={{ flex: 1, padding: '0.85rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer' }}>
                      ✓ Başarılı Ödeme
                    </button>
                    <button onClick={() => completePayment('failure')} disabled={processing} style={{ flex: 1, padding: '0.85rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer' }}>
                      ✗ Başarısız Ödeme
                    </button>
                  </div>
                </>
              )}
            </div>

            <div>
              <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', position: 'sticky', top: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem' }}>Özet</h2>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>{service.title}</h3>
                <Row label="Varyant" value={pricing?.name || '-'} />
                {pricing?.unit === 'per_person' && <Row label="Kişi" value={`${participants} kişi`} />}
                <Row label="Tarih" value={schedule ? formatDate(schedule.startAt) : '-'} />
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Toplam</span>
                  <span style={{ color: '#16a34a' }}>{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
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
