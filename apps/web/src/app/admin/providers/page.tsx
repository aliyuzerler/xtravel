'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import { Card, Table, PageHeader, StatusBadge, Button, Pagination, EmptyState, ErrorState, Modal, formatDate } from '@/components/admin-ui';

interface ProviderRow {
  id: string;
  userId: string;
  companyName: string;
  taxNumber: string | null;
  phone: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  user: { id: string; email: string; fullName: string | null; phone: string | null; status: string };
}

interface Paginated { items: ProviderRow[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }

function ProvidersList() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Paginated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ProviderRow | null>(null);

  useEffect(() => {
    setStatusFilter(searchParams.get('status') || '');
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    apiFetch<Paginated>(`/api/admin/providers?${params.toString()}`).then((r) => {
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, [page, statusFilter]);

  return (
    <>
      <PageHeader
        title="Sağlayıcılar"
        subtitle="Sağlayıcı başvurularını onayla / reddet"
        action={
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <option value="">Tüm durumlar</option>
            <option value="pending">Beklemede ({statusFilter === 'pending' ? 'aktif' : ''})</option>
            <option value="approved">Onaylı</option>
            <option value="rejected">Reddedilmiş</option>
            <option value="suspended">Askıya alınmış</option>
          </select>
        }
      />

      <Card>
        {error ? <ErrorState message={error} /> :
          data && data.items.length === 0 ? <EmptyState message="Sağlayıcı bulunamadı" /> :
          data && (
            <>
              <Table
                columns={[
                  { key: 'companyName', label: 'Şirket' },
                  { key: 'email', label: 'E-posta' },
                  { key: 'phone', label: 'Telefon' },
                  { key: 'taxNumber', label: 'Vergi No', width: '120px' },
                  { key: 'status', label: 'Durum', width: '120px' },
                  { key: 'createdAt', label: 'Başvuru', width: '140px' },
                  { key: 'actions', label: '', width: '120px' },
                ]}
                rows={data.items.map((p) => ({
                  companyName: <strong>{p.companyName}</strong>,
                  email: p.user.email,
                  phone: p.phone || p.user.phone || '-',
                  taxNumber: p.taxNumber || '-',
                  status: <StatusBadge status={p.status} />,
                  createdAt: formatDate(p.createdAt),
                  actions: <Button size="sm" variant="ghost" onClick={() => setSelected(p)}>Detay</Button>,
                }))}
              />
              <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
            </>
          )
        }
      </Card>

      {selected && <ProviderDetailModal provider={selected} onClose={() => setSelected(null)} onAction={() => { setPage(page); setSelected(null); }} />}
    </>
  );
}

export default function AdminProvidersPage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>}>
      <ProvidersList />
    </Suspense>
  );
}

function ProviderDetailModal({ provider, onClose, onAction }: { provider: ProviderRow; onClose: () => void; onAction: () => void }) {
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
    const r = await apiFetch(`/api/admin/providers/${provider.id}/${action}`, { method: 'PUT', body: JSON.stringify(body) });
    setLoading(false);
    if (r.success) {
      alert(action === 'approve' ? 'Sağlayıcı onaylandı. Bildirim gönderildi.' : 'Sağlayıcı reddedildi. Bildirim gönderildi.');
      onAction();
    } else {
      alert('Hata: ' + (r.message || 'Bilinmeyen'));
    }
  }

  return (
    <Modal title={provider.companyName} onClose={onClose}>
      <div style={{ marginBottom: '1rem' }}>
        <Row label="Durum"><StatusBadge status={provider.status} /></Row>
        <Row label="Sorumlu">{provider.user.fullName || '-'}</Row>
        <Row label="E-posta">{provider.user.email}</Row>
        <Row label="Telefon">{provider.phone || provider.user.phone || '-'}</Row>
        <Row label="Vergi No">{provider.taxNumber || '-'}</Row>
        <Row label="Başvuru Tarihi">{formatDate(provider.createdAt)}</Row>
        {provider.description && <Row label="Açıklama">{provider.description}</Row>}
      </div>

      {provider.status === 'pending' && (
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
                placeholder="Başvuru neden reddediliyor?"
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
      <div style={{ width: 140, color: '#64748b', fontSize: '0.85rem' }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
