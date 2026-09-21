'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, Table, PageHeader, StatusBadge, SearchBar, Button, Pagination, EmptyState, ErrorState, formatDate } from '@/components/admin-ui';
import { UserRole, UserStatus } from '@turizm-pazaryeri/shared';

interface UserRow {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  provider?: { id: string; companyName: string; status: string } | null;
}

interface Paginated { items: UserRow[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }

export default function AdminUsersPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('status', statusFilter);
    apiFetch<Paginated>(`/api/admin/users?${params.toString()}`).then((r) => {
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, [page, search, roleFilter, statusFilter]);

  return (
    <>
      <PageHeader title="Kullanıcılar" subtitle="Tüm platform kullanıcılarını yönet" />

      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="E-posta, ad, telefon ara" />
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <option value="">Tüm roller</option>
            <option value="user">Kullanıcı</option>
            <option value="provider">Sağlayıcı</option>
            <option value="super_admin">Admin</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <option value="">Tüm durumlar</option>
            <option value="active">Aktif</option>
            <option value="banned">Banlı</option>
            <option value="pending">Beklemede</option>
          </select>
        </div>

        {error ? <ErrorState message={error} /> :
          data && data.items.length === 0 ? <EmptyState message="Kullanıcı bulunamadı" /> :
          data && (
            <>
              <Table
                columns={[
                  { key: 'email', label: 'E-posta' },
                  { key: 'fullName', label: 'Ad Soyad' },
                  { key: 'role', label: 'Rol', width: '120px' },
                  { key: 'status', label: 'Durum', width: '100px' },
                  { key: 'provider', label: 'Sağlayıcı' },
                  { key: 'createdAt', label: 'Kayıt', width: '140px' },
                  { key: 'actions', label: '', width: '120px' },
                ]}
                rows={data.items.map((u) => ({
                  email: u.email,
                  fullName: u.fullName || '-',
                  role: <code style={{ fontSize: '0.8rem', color: '#475569' }}>{u.role}</code>,
                  status: <StatusBadge status={u.status} />,
                  provider: u.provider ? <span>{u.provider.companyName} <StatusBadge status={u.provider.status} /></span> : '-',
                  createdAt: formatDate(u.createdAt),
                  actions: u.role === 'super_admin' ? <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>değiştirilemez</span> :
                    <BanToggleButton userId={u.id} currentStatus={u.status} onDone={() => setPage(page)} />,
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

function BanToggleButton({ userId, currentStatus, onDone }: { userId: string; currentStatus: UserStatus; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const newStatus = currentStatus === UserStatus.BANNED ? UserStatus.ACTIVE : UserStatus.BANNED;
  return (
    <Button
      size="sm"
      variant={currentStatus === UserStatus.BANNED ? 'success' : 'danger'}
      disabled={loading}
      onClick={async () => {
        if (!confirm(`${currentStatus === UserStatus.BANNED ? 'Banı kaldır' : 'Banla'}: emin misiniz?`)) return;
        setLoading(true);
        await apiFetch(`/api/admin/users/${userId}/status`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
        setLoading(false);
        onDone();
      }}
    >
      {loading ? '...' : currentStatus === UserStatus.BANNED ? 'Banı Kaldır' : 'Banla'}
    </Button>
  );
}
