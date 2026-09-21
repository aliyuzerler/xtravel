'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, Table, PageHeader, StatusBadge, SearchBar, Pagination, EmptyState, ErrorState, formatDate, formatPrice } from '@/components/admin-ui';

interface Reservation {
  id: string;
  reservationCode: string;
  status: string;
  participantCount: number;
  unitPrice: number;
  totalPrice: number;
  discountAmount: number;
  contactName: string;
  contactEmail: string;
  createdAt: string;
  user: { email: string; fullName: string | null };
  service: { title: string };
  schedule: { startAt: string };
  payments: Array<{ id: string; amount: number; status: string; provider: string }>;
}

interface Paginated { items: Reservation[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }

export default function AdminReservationsPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    apiFetch<Paginated>(`/api/admin/reservations?${params.toString()}`).then((r) => {
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, [page, search, statusFilter]);

  return (
    <>
      <PageHeader title="Rezervasyonlar" subtitle="Tüm platform rezervasyonları (salt okunur)" />
      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Kod, ad, e-posta ara" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <option value="">Tüm durumlar</option>
            <option value="pending_payment">Ödeme bekleyen</option>
            <option value="confirmed">Onaylı</option>
            <option value="completed">Tamamlanan</option>
            <option value="cancelled">İptal</option>
            <option value="refunded">İade edilen</option>
          </select>
        </div>

        {error ? <ErrorState message={error} /> :
          data && data.items.length === 0 ? <EmptyState message="Rezervasyon bulunamadı" /> :
          data && (
            <>
              <Table
                columns={[
                  { key: 'reservationCode', label: 'Kod', width: '140px' },
                  { key: 'service', label: 'Hizmet' },
                  { key: 'user', label: 'Kullanıcı' },
                  { key: 'participants', label: 'Kişi', width: '60px' },
                  { key: 'totalPrice', label: 'Tutar', width: '100px' },
                  { key: 'status', label: 'Durum', width: '120px' },
                  { key: 'date', label: 'Tarih', width: '140px' },
                ]}
                rows={data.items.map((r) => ({
                  reservationCode: <code style={{ fontSize: '0.8rem' }}>{r.reservationCode}</code>,
                  service: <span title={r.service.title}>{r.service.title}</span>,
                  user: <div><div>{r.contactName}</div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.contactEmail}</div></div>,
                  participants: r.participantCount,
                  totalPrice: formatPrice(r.totalPrice),
                  status: <StatusBadge status={r.status} />,
                  date: <div><div>{formatDate(r.createdAt)}</div>{r.schedule && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Başlangıç: {formatDate(r.schedule.startAt)}</div>}</div>,
                }))}
              />
              <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
            </>
          )
        }
      </Card>
    </>
  );
}
