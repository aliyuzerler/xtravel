'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';
import { Card, Table, PageHeader, StatusBadge, Button, Pagination, EmptyState, ErrorState, formatDate } from '@/components/admin-ui';

interface ServiceRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  rejectionReason: string | null;
  updatedAt: string;
  category: { name: string };
  city: { name: string };
  images: Array<{ isMain: boolean }>;
  _count: { reservations: number };
}

interface Paginated { items: ServiceRow[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }

export default function ProviderServicesPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    apiFetch<Paginated>(`/api/provider/services?${params.toString()}`).then((r) => {
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, [page, statusFilter]);

  return (
    <>
      <PageHeader
        title="Hizmetlerim"
        subtitle="Tüm hizmetlerinizi yönetin"
        action={<Button onClick={() => window.location.href = '/provider/new-service'}>+ Yeni Hizmet</Button>}
      />

      <Card>
        <div style={{ marginBottom: '1rem' }}>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <option value="">Tüm durumlar</option>
            <option value="draft">Taslak</option>
            <option value="pending_approval">Onay bekleyen</option>
            <option value="published">Yayında</option>
            <option value="rejected">Reddedilmiş</option>
            <option value="paused">Duraklatılmış</option>
          </select>
        </div>

        {error ? <ErrorState message={error} /> :
          data && data.items.length === 0 ? <EmptyState message="Hizmet yok" /> :
          data && (
            <>
              <Table
                columns={[
                  { key: 'title', label: 'Başlık' },
                  { key: 'category', label: 'Kategori', width: '140px' },
                  { key: 'city', label: 'Şehir', width: '120px' },
                  { key: 'status', label: 'Durum', width: '130px' },
                  { key: 'rejection', label: 'Red Gerekçesi' },
                  { key: 'reservations', label: 'Rezervasyon', width: '100px' },
                  { key: 'updatedAt', label: 'Güncelleme', width: '140px' },
                  { key: 'actions', label: '', width: '140px' },
                ]}
                rows={data.items.map((s) => ({
                  title: <strong>{s.title}</strong>,
                  category: s.category.name,
                  city: s.city.name,
                  status: <StatusBadge status={s.status} />,
                  rejection: s.rejectionReason ? <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{s.rejectionReason}</span> : '-',
                  reservations: s._count.reservations,
                  updatedAt: formatDate(s.updatedAt),
                  actions: (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <Link href={`/provider/new-service?id=${s.id}`} style={{ padding: '0.375rem 0.5rem', fontSize: '0.8rem', background: '#0ea5e9', color: 'white', textDecoration: 'none', borderRadius: 4 }}>Düzenle</Link>
                    </div>
                  ),
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
