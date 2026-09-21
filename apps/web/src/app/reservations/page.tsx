'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';
import { Card, Table, PageHeader, StatusBadge, Button, Pagination, EmptyState, ErrorState, formatDate, formatPrice } from '@/components/admin-ui';

interface Reservation {
  id: string;
  reservationCode: string;
  status: string;
  participantCount: number;
  totalPrice: number;
  contactName: string;
  createdAt: string;
  service: { id: string; title: string; slug: string; images: Array<{ imageUrl: string }> };
  schedule: { startAt: string };
  pricing: { name: string; unit: string };
  payments: Array<{ amount: number; status: string; provider: string }>;
}

interface Paginated { items: Reservation[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }

function ReservationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    setStatusFilter(searchParams.get('status') || '');
    setPage(parseInt(searchParams.get('page') || '1', 10));
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    apiFetch<Paginated>(`/api/user/reservations?${params.toString()}`).then((r) => {
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Yüklenemedi');
    }).finally(() => setLoading(false));
  }, [page, statusFilter]);

  function updateUrl(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.delete('page');
    router.push(`/reservations?${params.toString()}`, { scroll: false });
  }

  async function doCancel() {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 3) {
      alert('İptal gerekçesi en az 3 karakter olmalı');
      return;
    }
    const r = await apiFetch(`/api/user/reservations/${cancelTarget.id}/cancel`, {
      method: 'POST', body: JSON.stringify({ reason: cancelReason }),
    });
    if (r.success) {
      alert('Rezervasyon iptal edildi. ' + (r.data?.refund ? `İade: ${r.data.refund.refundPercentage}% (${formatPrice(r.data.refund.refundAmount)})` : ''));
      setCancelTarget(null);
      setCancelReason('');
      // Reload
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      apiFetch<Paginated>(`/api/user/reservations?${params.toString()}`).then((r) => {
        if (r.success && r.data) setData(r.data);
      });
    } else {
      alert('Hata: ' + (r.message || 'Bilinmeyen'));
    }
  }

  return (
    <div style={{ minHeight: '100vh', maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
      <PageHeader title="Rezervasyonlarım" subtitle="Tüm rezervasyonlarınız" />

      <Card>
        <div style={{ marginBottom: '1rem' }}>
          <select value={statusFilter} onChange={(e) => updateUrl('status', e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <option value="">Tüm durumlar</option>
            <option value="pending_payment">Ödeme bekleyen</option>
            <option value="confirmed">Onaylı</option>
            <option value="completed">Tamamlanan</option>
            <option value="cancelled">İptal</option>
            <option value="refunded">İade edilen</option>
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Yükleniyor...</div>
        ) : error ? (
          <ErrorState message={error} />
        ) : data && data.items.length > 0 ? (
          <>
            <Table
              columns={[
                { key: 'code', label: 'Kod', width: '130px' },
                { key: 'service', label: 'Hizmet' },
                { key: 'date', label: 'Tarih', width: '140px' },
                { key: 'participants', label: 'Kişi', width: '60px' },
                { key: 'total', label: 'Tutar', width: '100px' },
                { key: 'status', label: 'Durum', width: '120px' },
                { key: 'actions', label: '', width: '100px' },
              ]}
              rows={data.items.map((r) => ({
                code: <code style={{ fontSize: '0.8rem' }}>{r.reservationCode}</code>,
                service: (
                  <Link href={`/hizmet/${r.service.slug}`} style={{ color: '#0ea5e9', textDecoration: 'none' }}>
                    {r.service.images?.[0]?.imageUrl && (
                      <img src={r.service.images[0].imageUrl} alt="" style={{ width: 32, height: 24, objectFit: 'cover', borderRadius: 2, marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    )}
                    {r.service.title}
                  </Link>
                ),
                date: formatDate(r.schedule.startAt),
                participants: r.participantCount,
                total: formatPrice(r.totalPrice),
                status: <StatusBadge status={r.status} />,
                actions: (r.status === 'pending_payment' || r.status === 'confirmed') ? (
                  <Button size="sm" variant="danger" onClick={() => setCancelTarget(r)}>İptal</Button>
                ) : null,
              }))}
            />
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={(p) => updateUrl('page', String(p))} />
          </>
        ) : (
          <EmptyState message="Henüz rezervasyonunuz yok" />
        )}
      </Card>

      {/* Cancel modal */}
      {cancelTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setCancelTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 400, maxWidth: 500 }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Rezervasyonu İptal Et</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
              {cancelTarget.reservationCode} — {cancelTarget.service.title}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.75rem' }}>
              Tarih: {formatDate(cancelTarget.schedule.startAt)}<br />
              Tutar: {formatPrice(cancelTarget.totalPrice)}
            </p>
            <label style={{ display: 'block', fontSize: '0.85rem', marginTop: '0.75rem', marginBottom: '0.25rem' }}>İptal gerekçesi (zorunlu)</label>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: 4, resize: 'vertical' }} autoFocus />
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              ℹ️ İade politikası: Tur başlangıcına ≥24 saat varsa %100, 12-24 saat arası %50, &lt;12 saat iade yok.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <Button variant="danger" onClick={doCancel}>İptal Et</Button>
              <Button variant="ghost" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>Vazgeç</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>}>
      <ReservationsContent />
    </Suspense>
  );
}
