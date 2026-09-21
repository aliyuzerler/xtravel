'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  avgRating: number | null;
  reviewCount: number;
  provider: { id: string; companyName: string; phone: string | null; description: string | null };
  category: { id: string; name: string; slug: string; iconName: string | null };
  city: { id: string; name: string; slug: string };
  images: Array<{ id: string; imageUrl: string; isMain: boolean; sortOrder: number }>;
  pricing: Array<{ id: string; name: string; price: number; currency: string; unit: string; description: string | null; isActive: boolean }>;
  schedules: Array<{ id: string; startAt: string; endAt: string; capacity: number; bookedCount: number }>;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { id: string; fullName: string | null };
}

interface ReviewSummary {
  avgRating: number | null;
  reviewCount: number;
  distribution: Record<number, number>;
}

interface Props {
  slug: string;
  initialService: ServiceDetail | null;
}

export default function ServiceDetailClient({ slug, initialService }: Props) {
  const router = useRouter();
  const [service, setService] = useState<ServiceDetail | null>(initialService);
  const [error, setError] = useState<string | null>(initialService === null ? 'Hizmet bulunamadı veya yayında değil' : null);
  const [loading, setLoading] = useState(initialService === null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [selectedPricing, setSelectedPricing] = useState<string>('');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');
  const [participants, setParticipants] = useState(1);

  // Faz-7: Reviews + Favorites state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (initialService && initialService.pricing?.length > 0) {
      setSelectedPricing(initialService.pricing[0].id);
    }
  }, [initialService]);

  // Reviews yükle
  useEffect(() => {
    if (!service) return;
    fetch(`/api/services/${service.id}/reviews?limit=10`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success && r.data) {
          setReviews(r.data.items || []);
          setReviewSummary(r.data.summary);
        }
      });
  }, [service]);

  // Favori durumunu kontrol et
  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth.accessToken || !service) return;
    fetch('/api/user/favorites/ids', { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => r.json())
      .then((r) => {
        if (r.success && r.data) {
          setIsFavorite(r.data.ids.includes(service.id));
        }
      });
  }, [service]);

  if (loading) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;
  }

  if (error || !service) return <div style={{ padding: '4rem', textAlign: 'center', color: '#dc2626' }}>{error || 'Hizmet bulunamadı'}</div>;

  const mainImage = service.images.find((i) => i.isMain) || service.images[0];
  const selectedPricingObj = service.pricing.find((p) => p.id === selectedPricing);
  const selectedScheduleObj = service.schedules.find((s) => s.id === selectedSchedule);

  let totalPrice = 0;
  let canCalculate = false;
  if (selectedPricingObj && selectedScheduleObj) {
    canCalculate = true;
    totalPrice = selectedPricingObj.unit === 'per_person' ? selectedPricingObj.price * participants : selectedPricingObj.price;
  }

  const hasGoogleMaps = service.latitude && service.longitude;

  async function toggleFavorite() {
    if (!service) return;
    const auth = getStoredAuth();
    if (!auth.accessToken) {
      router.push(`/login?next=/hizmet/${slug}`);
      return;
    }
    // Optimistik güncelleme
    setIsFavorite((prev) => !prev);
    const r = await apiFetch(`/api/services/${service.id}/favorite`, { method: 'POST' });
    if (!r.success) {
      setIsFavorite((prev) => !prev); // revert
      alert(r.message || 'Favori işlemi başarısız');
    }
  }

  async function submitReview() {
    if (!service) return;
    setReviewSubmitting(true);
    setReviewMsg(null);
    const r = await apiFetch(`/api/services/${service.id}/reviews`, {
      method: 'POST',
      body: JSON.stringify(reviewForm),
    });
    setReviewSubmitting(false);
    if (r.success) {
      setReviewMsg({ type: 'success', text: 'Yorumunuz alındı! Yönetici onayından sonra yayınlanacak.' });
      setShowReviewForm(false);
      setReviewForm({ rating: 5, comment: '' });
    } else {
      setReviewMsg({ type: 'error', text: r.message || 'Yorum gönderilemedi' });
    }
  }

  function proceedToCheckout() {
    const auth = getStoredAuth();
    const returnUrl = `/checkout/${slug}?schedule=${selectedSchedule}&pricing=${selectedPricing}&participants=${participants}`;
    if (!auth.accessToken) {
      router.push(`/login?next=${encodeURIComponent(returnUrl)}`);
      return;
    }
    router.push(returnUrl);
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Breadcrumb */}
      <div style={{ background: '#f8fafc', padding: '0.75rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', fontSize: '0.85rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Link href="/" style={{ color: '#0ea5e9' }}>Ana Sayfa</Link>
            {' / '}
            <Link href={`/?category=${service.category.slug}`} style={{ color: '#0ea5e9' }}>{service.category.name}</Link>
            {' / '}
            <Link href={`/sehir/${service.city.slug}`} style={{ color: '#0ea5e9' }}>{service.city.name}</Link>
          </div>
          <button onClick={toggleFavorite} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>
            {isFavorite ? '❤️' : '🤍'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 2rem', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
        {/* SOL: Görsel galeri + açıklama + YORUMLAR */}
        <div>
          {mainImage && (
            <button
              onClick={() => setLightboxIdx(0)}
              style={{
                width: '100%', height: 400, borderRadius: 8, cursor: 'pointer', padding: 0, border: 'none',
                backgroundImage: `url(${mainImage.imageUrl})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                marginBottom: '0.75rem',
              }}
              aria-label="Görseli büyüt"
            />
          )}

          {service.images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {service.images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setLightboxIdx(idx)}
                  style={{
                    width: 80, height: 60, padding: 0, border: img.isMain ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    borderRadius: 4, cursor: 'pointer', overflow: 'hidden',
                  }}
                >
                  <img src={img.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}

          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#0f172a' }}>{service.title}</h1>

          {/* Puan + favori satırı */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', fontSize: '0.9rem', color: '#64748b' }}>
            {service.avgRating != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ color: '#f59e0b', fontSize: '1.1rem' }}>★</span>
                <strong style={{ color: '#0f172a' }}>{service.avgRating.toFixed(1)}</strong>
                <span>({service.reviewCount} yorum)</span>
              </span>
            )}
            {service.durationHours && <span>⏱ {service.durationHours} saat</span>}
            <span>📍 {service.city.name}</span>
            <span>🏢 {service.provider.companyName}</span>
          </div>

          <section style={{ background: 'white', padding: '1.5rem', borderRadius: 8, marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.75rem' }}>Açıklama</h2>
            <p style={{ color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
              {service.description || 'Açıklama yok.'}
            </p>
          </section>

          {/* Faz-7: YORUMLAR + PUAN DAĞILIMI */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: 8, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Yorumlar ({service.reviewCount})</h2>
              <button onClick={() => setShowReviewForm(!showReviewForm)} style={{ background: '#0ea5e9', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                + Yorum Yaz
              </button>
            </div>

            {reviewMsg && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: 4, marginBottom: '1rem', fontSize: '0.9rem', background: reviewMsg.type === 'success' ? '#f0fdf4' : '#fef2f2', color: reviewMsg.type === 'success' ? '#16a34a' : '#dc2626' }}>
                {reviewMsg.text}
              </div>
            )}

            {showReviewForm && (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 6, marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>Puan</label>
                <div style={{ marginBottom: '0.75rem' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setReviewForm({ ...reviewForm, rating: n })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', padding: '0 0.25rem', color: n <= reviewForm.rating ? '#f59e0b' : '#cbd5e1' }}>★</button>
                  ))}
                </div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>Yorum</label>
                <textarea
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: 4, resize: 'vertical', marginBottom: '0.75rem' }}
                  placeholder="Deneyiminizi paylaşın..."
                />
                <button onClick={submitReview} disabled={reviewSubmitting} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                  {reviewSubmitting ? 'Gönderiliyor...' : 'Gönder'}
                </button>
              </div>
            )}

            {/* Puan dağılımı grafiği */}
            {reviewSummary && reviewSummary.reviewCount > 0 && (
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: 6 }}>
                <div style={{ textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>{reviewSummary.avgRating?.toFixed(1)}</div>
                  <div style={{ color: '#f59e0b' }}>★★★★★</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{reviewSummary.reviewCount} yorum</div>
                </div>
                <div style={{ flex: 1 }}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviewSummary.distribution[star] || 0;
                    const pct = reviewSummary.reviewCount > 0 ? (count / reviewSummary.reviewCount) * 100 : 0;
                    return (
                      <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', minWidth: 20 }}>{star}★</span>
                        <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#f59e0b' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', minWidth: 30, textAlign: 'right' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Yorum listesi */}
            {reviews.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '1rem' }}>Henüz onaylanmış yorum yok.</p>
            ) : (
              <div>
                {reviews.map((r) => (
                  <div key={r.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '1rem 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.9rem' }}>{r.user.fullName || 'Anonim'}</strong>
                        <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>{'★'.repeat(r.rating)}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatDate(r.createdAt)}</span>
                    </div>
                    <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {service.meetingPoint && (
            <section style={{ background: 'white', padding: '1.5rem', borderRadius: 8, marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Buluşma Noktası</h2>
              <p style={{ color: '#334155', margin: '0 0 0.75rem' }}>{service.meetingPoint}</p>
              {hasGoogleMaps && (
                <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <iframe
                    src={`https://maps.google.com/maps?q=${service.latitude},${service.longitude}&z=15&output=embed`}
                    width="100%"
                    height="240"
                    style={{ border: 0, display: 'block' }}
                    loading="lazy"
                    title="Buluşma noktası haritası"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
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

        {/* SAĞ: Rezervasyon paneli */}
        <div>
          <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', position: 'sticky', top: '1rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 1rem' }}>Rezervasyon</h2>

            <label style={labelStyle}>Fiyat varyantı</label>
            <select value={selectedPricing} onChange={(e) => setSelectedPricing(e.target.value)} style={selectStyle}>
              <option value="">Seçin...</option>
              {service.pricing.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatPrice(p.price, p.currency)} ({p.unit === 'per_person' ? 'kişi başı' : 'grup'})
                </option>
              ))}
            </select>

            <label style={labelStyle}>Tarih / Saat</label>
            <select value={selectedSchedule} onChange={(e) => setSelectedSchedule(e.target.value)} style={selectStyle}>
              <option value="">Seçin...</option>
              {service.schedules.map((s) => {
                const remaining = s.capacity - s.bookedCount;
                return (
                  <option key={s.id} value={s.id} disabled={remaining <= 0}>
                    {formatDate(s.startAt)} ({remaining > 0 ? `${remaining} yer kaldı` : 'DOLU'})
                  </option>
                );
              })}
            </select>

            {selectedPricingObj?.unit === 'per_person' && selectedSchedule && (
              <>
                <label style={labelStyle}>Kişi sayısı</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button onClick={() => setParticipants(Math.max(1, participants - 1))} style={{ width: 36, height: 36, borderRadius: 4, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}>−</button>
                  <input type="number" min="1" max="20" value={participants} onChange={(e) => setParticipants(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} style={{ width: 60, textAlign: 'center', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: 4 }} />
                  <button onClick={() => setParticipants(Math.min(20, participants + 1))} style={{ width: 36, height: 36, borderRadius: 4, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}>+</button>
                </div>
              </>
            )}

            {canCalculate ? (
              <div style={{ background: '#f0fdf4', padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569' }}>
                  <span>{selectedPricingObj?.name}</span>
                  <span>{formatPrice(selectedPricingObj!.price)}</span>
                </div>
                {selectedPricingObj?.unit === 'per_person' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>
                    <span>× {participants} kişi</span>
                    <span>{formatPrice(selectedPricingObj!.price * participants)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #bbf7d0', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#16a34a' }}>
                  <span>Toplam</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
              </div>
            ) : (
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                Fiyat için varyant ve tarih seçin
              </div>
            )}

            <button
              disabled={!canCalculate}
              onClick={proceedToCheckout}
              style={{
                width: '100%', padding: '0.85rem', background: canCalculate ? '#16a34a' : '#94a3b8',
                color: 'white', border: 'none', borderRadius: 6, fontSize: '1rem', fontWeight: 600,
                cursor: canCalculate ? 'pointer' : 'not-allowed', marginBottom: '0.5rem',
              }}
            >
              {canCalculate ? 'Devam Et →' : 'Seçim yapın'}
            </button>

            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', textAlign: 'center' }}>
              Ödeme iyzico güvenliği ile yapılır<br />Ücretsiz iptal 24s öncesine
            </p>
          </div>
        </div>
      </div>

      {/* LIGHTBOX */}
      {lightboxIdx !== null && service.images[lightboxIdx] && (
        <div className="lightbox-backdrop" onClick={() => setLightboxIdx(null)}>
          <button className="lightbox-close" onClick={() => setLightboxIdx(null)}>×</button>
          {service.images.length > 1 && (
            <>
              <button className="lightbox-nav prev" onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + service.images.length) % service.images.length); }}>‹</button>
              <button className="lightbox-nav next" onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % service.images.length); }}>›</button>
            </>
          )}
          <img className="lightbox-image" src={service.images[lightboxIdx].imageUrl} alt={service.title} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem', color: '#475569' };
const selectStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.9rem', marginBottom: '1rem', background: 'white' };
