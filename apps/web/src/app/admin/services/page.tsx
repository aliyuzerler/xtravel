'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import { Card, Table, PageHeader, StatusBadge, Button, Pagination, EmptyState, ErrorState, Modal, formatDate } from '@/components/admin-ui';

interface ServiceRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  createdAt: string;
  provider: { id: string; companyName: string; user: { email: string } };
  category: { id: string; name: string };
  city: { id: string; name: string };
  images: Array<{ id: string; imageUrl: string; isMain: boolean }>;
}

interface Paginated { items: ServiceRow[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }

function ServicesList() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Paginated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ServiceRow | null>(null);

  useEffect(() => {
    setStatusFilter(searchParams.get('status') || '');
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    apiFetch<Paginated>(`/api/admin/services?${params.toString()}`).then((r) => {
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, [page, statusFilter]);

  return (
    <>
      <PageHeader
        title="Hizmetler"
        subtitle="Hizmet onay akışı"
        action={
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <option value="">Tüm durumlar</option>
            <option value="draft">Taslak</option>
            <option value="pending_approval">Onay bekleyen</option>
            <option value="published">Yayında</option>
            <option value="rejected">Reddedilmiş</option>
            <option value="paused">Duraklatılmış</option>
          </select>
        }
      />

      <Card>
        {error ? <ErrorState message={error} /> :
          data && data.items.length === 0 ? <EmptyState message="Hizmet bulunamadı" /> :
          data && (
            <>
              <Table
                columns={[
                  { key: 'title', label: 'Başlık' },
                  { key: 'provider', label: 'Sağlayıcı' },
                  { key: 'category', label: 'Kategori', width: '140px' },
                  { key: 'city', label: 'Şehir', width: '120px' },
                  { key: 'status', label: 'Durum', width: '120px' },
                  { key: 'createdAt', label: 'Oluşturma', width: '140px' },
                  { key: 'actions', label: '', width: '120px' },
                ]}
                rows={data.items.map((s) => ({
                  title: <strong>{s.title}</strong>,
                  provider: s.provider.companyName,
                  category: s.category.name,
                  city: s.city.name,
                  status: <StatusBadge status={s.status} />,
                  createdAt: formatDate(s.createdAt),
                  actions: <Button size="sm" variant="ghost" onClick={() => setSelected(s)}>İncele</Button>,
                }))}
              />
              <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
            </>
          )
        }
      </Card>

      {selected && <ServiceDetailModal service={selected} onClose={() => setSelected(null)} onAction={() => { setPage(page); setSelected(null); }} />}
    </>
  );
}

export default function AdminServicesPage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>}>
      <ServicesList />
    </Suspense>
  );
}

function ServiceDetailModal({ service, onClose, onAction }: { service: ServiceRow; onClose: () => void; onAction: () => void }) {
  const [loading, setLoading] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');

  async function act(action: 'approve' | 'reject') {
    if (action === 'reject' && reason.trim().length < 3) {
      alert('Red gerekçesi en az 3 karakter olmalı');
      return;
    }
    setLoading(true);
    const body = action === 'reject' ? { reason } : { note: 'Onaylandı' };
    const r = await apiFetch(`/api/admin/services/${service.id}/${action}`, { method: 'PUT', body: JSON.stringify(body) });
    setLoading(false);
    if (r.success) {
      alert(action === 'approve' ? 'Hizmet onaylandı. Bildirim gönderildi.' : 'Hizmet reddedildi. Bildirim gönderildi.');
      onAction();
    } else {
      alert('Hata: ' + (r.message || 'Bilinmeyen'));
    }
  }

  return (
    <Modal title={service.title} onClose={onClose}>
      <div style={{ marginBottom: '1rem' }}>
        <Row label="Durum"><StatusBadge status={service.status} /></Row>
        <Row label="Slug"><code style={{ fontSize: '0.8rem' }}>{service.slug}</code></Row>
        <Row label="Sağlayıcı">{service.provider.companyName} <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({service.provider.user.email})</span></Row>
        <Row label="Kategori">{service.category.name}</Row>
        <Row label="Şehir">{service.city.name}</Row>
        <Row label="Oluşturma">{formatDate(service.createdAt)}</Row>
      </div>

      {service.images && service.images.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>Görseller:</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {service.images.map((img) => (
              <a key={img.id} href={img.imageUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={img.imageUrl}
                  alt={service.title}
                  style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 4, border: img.isMain ? '2px solid #16a34a' : '1px solid #e2e8f0' }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {service.status === 'pending_approval' && (
        <>
          {!rejectMode ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="success" disabled={loading} onClick={() => act('approve')}>✓ Onayla</Button>
              <Button variant="danger" disabled={loading} onClick={() => setRejectMode(true)}>✗ Reddet</Button>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>Red Gerekçesi (zorunlu)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.9rem', resize: 'vertical' }}
                placeholder="Hizmet neden reddediliyor?"
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <Button variant="danger" disabled={loading || reason.trim().length < 3} onClick={() => act('reject')}>Reddi Gönder</Button>
                <Button variant="ghost" disabled={loading} onClick={() => setRejectMode(false)}>İptal</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', padding: '0.375rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: 120, color: '#64748b', fontSize: '0.85rem' }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
