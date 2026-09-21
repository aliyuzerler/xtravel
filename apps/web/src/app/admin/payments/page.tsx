'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, Table, PageHeader, StatusBadge, SearchBar, Pagination, EmptyState, ErrorState, formatDate, formatPrice } from '@/components/admin-ui';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  providerTransactionId: string | null;
  status: string;
  createdAt: string;
  reservation: {
    id: string;
    reservationCode: string;
    user: { email: string };
    service: { title: string };
  };
  refunds: Array<{ id: string; amount: number; status: string; reason: string | null }>;
}

interface Paginated { items: Payment[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }

export default function AdminPaymentsPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    apiFetch<Paginated>(`/api/admin/payments?${params.toString()}`).then((r) => {
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, [page, search, statusFilter]);

  return (
    <>
      <PageHeader title="Ödemeler" subtitle="Tüm platform ödemeleri (salt okunur)" />
      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="İşlem ID, rezervasyon kodu ara" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <option value="">Tüm durumlar</option>
            <option value="initiated">Başlatıldı</option>
            <option value="authorized">Yetkili</option>
            <option value="captured">Çekildi</option>
            <option value="failed">Başarısız</option>
            <option value="refunded">İade edildi</option>
            <option value="partially_refunded">Kısmen iade</option>
          </select>
        </div>

        {error ? <ErrorState message={error} /> :
          data && data.items.length === 0 ? <EmptyState message="Ödeme bulunamadı" /> :
          data && (
            <>
              <Table
                columns={[
                  { key: 'reservation', label: 'Rezervasyon' },
                  { key: 'amount', label: 'Tutar', width: '120px' },
                  { key: 'provider', label: 'Sağlayıcı', width: '100px' },
                  { key: 'transactionId', label: 'İşlem ID', width: '180px' },
                  { key: 'status', label: 'Durum', width: '120px' },
                  { key: 'createdAt', label: 'Tarih', width: '140px' },
                  { key: 'refunds', label: 'İadeler', width: '120px' },
                ]}
                rows={data.items.map((p) => ({
                  reservation: <div><div><code style={{ fontSize: '0.8rem' }}>{p.reservation.reservationCode}</code></div><div style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.reservation.service.title}</div></div>,
                  amount: formatPrice(p.amount, p.currency),
                  provider: <code style={{ fontSize: '0.8rem' }}>{p.provider}</code>,
                  transactionId: p.providerTransactionId ? <code style={{ fontSize: '0.75rem' }}>{p.providerTransactionId}</code> : '-',
                  status: <StatusBadge status={p.status} />,
                  createdAt: formatDate(p.createdAt),
                  refunds: p.refunds.length === 0 ? '-' : p.refunds.map((r, i) => (
                    <div key={i} style={{ fontSize: '0.8rem' }}>
                      {formatPrice(r.amount)} <StatusBadge status={r.status} />
                    </div>
                  )),
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
