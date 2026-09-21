'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, Table, PageHeader, StatusBadge, Button, Pagination, EmptyState, ErrorState, formatDate, formatPrice } from '@/components/admin-ui';

interface Reservation {
  id: string;
  reservationCode: string;
  status: string;
  participantCount: number;
  unitPrice: number;
  totalPrice: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createdAt: string;
  user: { email: string; fullName: string | null };
  service: { id: string; title: string };
  schedule: { startAt: string; endAt: string };
  pricing: { name: string; unit: string };
}

interface Paginated { items: Reservation[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }

export default function ProviderReservationsPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState<Reservation | null>(null);
  const [actionType, setActionType] = useState<'confirm' | 'cancel' | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    apiFetch<Paginated>(`/api/provider/reservations?${params.toString()}`).then((r) => {
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, [page, statusFilter]);

  async function doAction() {
    if (!actionTarget || !actionType) return;
    if (actionType === 'cancel' && cancelReason.trim().length < 3) {
      alert('İptal gerekçesi en az 3 karakter olmalı');
      return;
    }
    const body = actionType === 'cancel' ? { reason: cancelReason } : {};
    const r = await apiFetch(`/api/provider/reservations/${actionTarget.id}/${actionType}`, { method: 'PUT', body: JSON.stringify(body) });
    if (r.success) {
      alert(actionType === 'confirm' ? 'Rezervasyon onaylandı' : 'Rezervasyon iptal edildi');
      setActionTarget(null);
      setActionType(null);
      setCancelReason('');
      // Reload
      setPage(page);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      apiFetch<Paginated>(`/api/provider/reservations?${params.toString()}`).then((r) => {
        if (r.success && r.data) setData(r.data);
      });
    } else {
      alert('Hata: ' + (r.message || 'Bilinmeyen'));
    }
  }

  return (
    <>
      <PageHeader title="Rezervasyonlar" subtitle="Hizmetlerinize gelen rezervasyonlar" />

      <Card>
        <div style={{ marginBottom: '1rem' }}>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <option value="">Tüm durumlar</option>
            <option value="pending_payment">Ödeme bekleyen</option>
            <option value="confirmed">Onaylı</option>
            <option value="completed">Tamamlanan</option>
            <option value="cancelled">İptal</option>
            <option value="refunded">İade</option>
          </select>
        </div>

        {error ? <ErrorState message={error} /> :
          data && data.items.length === 0 ? <EmptyState message="Rezervasyon yok" /> :
          data && (
            <>
              <Table
                columns={[
                  { key: 'code', label: 'Kod', width: '120px' },
                  { key: 'service', label: 'Hizmet' },
                  { key: 'customer', label: 'Müşteri' },
                  { key: 'date', label: 'Tarih', width: '140px' },
                  { key: 'participants', label: 'Kişi', width: '60px' },
                  { key: 'total', label: 'Tutar', width: '100px' },
                  { key: 'status', label: 'Durum', width: '120px' },
                  { key: 'actions', label: '', width: '160px' },
                ]}
                rows={data.items.map((r) => ({
                  code: <code style={{ fontSize: '0.8rem' }}>{r.reservationCode}</code>,
                  service: <span title={r.service.title}>{r.service.title}</span>,
                  customer: <div><div>{r.contactName}</div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.contactEmail}</div></div>,
                  date: <div><div>{formatDate(r.schedule.startAt)}</div></div>,
                  participants: r.participantCount,
                  total: formatPrice(r.totalPrice),
                  status: <StatusBadge status={r.status} />,
                  actions: (r.status === 'pending_payment' || r.status === 'confirmed') && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {r.status === 'pending_payment' && (
                        <Button size="sm" variant="success" onClick={() => { setActionTarget(r); setActionType('confirm'); }}>Onayla</Button>
                      )}
                      <Button size="sm" variant="danger" onClick={() => { setActionTarget(r); setActionType('cancel'); }}>İptal</Button>
                    </div>
                  ),
                }))}
              />
              <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
            </>
          )
        }
      </Card>

      {/* Cancel modal */}
      {actionTarget && actionType === 'cancel' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setActionTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 400 }}>
            <h3 style={{ margin: '0 0 1rem' }}>Rezervasyonu İptal Et</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{actionTarget.reservationCode} — {actionTarget.service.title}</p>
            <label style={{ display: 'block', fontSize: '0.85rem', marginTop: '0.75rem', marginBottom: '0.25rem' }}>İptal gerekçesi (zorunlu)</label>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: 4, resize: 'vertical' }} autoFocus />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <Button variant="danger" onClick={doAction}>İptal Et</Button>
              <Button variant="ghost" onClick={() => { setActionTarget(null); setCancelReason(''); }}>Vazgeç</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
