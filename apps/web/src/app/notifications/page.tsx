'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, PageHeader, Button, Pagination, EmptyState, ErrorState, formatDate } from '@/components/admin-ui';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface Paginated { items: NotificationItem[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } }

export default function NotificationsPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    apiFetch<Paginated>(`/api/user/notifications?page=${page}&limit=20`).then((r) => {
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Yüklenemedi');
    }).finally(() => setLoading(false));
  }, [page]);

  async function markRead(id: string) {
    await apiFetch(`/api/user/notifications/${id}/read`, { method: 'POST' });
    setData((prev) => prev ? {
      ...prev,
      items: prev.items.map((n) => n.id === id ? { ...n, isRead: true } : n),
    } : null);
  }

  async function markAllRead() {
    const r = await apiFetch(`/api/user/notifications/read-all`, { method: 'POST' });
    if (r.success) {
      setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((n) => ({ ...n, isRead: true })),
      } : null);
    }
  }

  const unreadCount = data?.items?.filter(n => !n.isRead).length || 0;

  return (
    <div style={{ minHeight: '100vh', maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <PageHeader
        title="Bildirimler"
        subtitle={unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Tüm bildirimler okundu'}
        action={unreadCount > 0 ? <Button onClick={markAllRead}>Tümünü okundu işaretle</Button> : undefined}
      />

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Yükleniyor...</div>
        ) : error ? (
          <ErrorState message={error} />
        ) : data && data.items.length > 0 ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {data.items.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${n.isRead ? '#cbd5e1' : '#0ea5e9'}`,
                    background: n.isRead ? '#f8fafc' : '#f0f9ff',
                    cursor: 'pointer',
                  }}
                  onClick={() => !n.isRead && markRead(n.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                      {notificationIcon(n.type)} {n.title}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{formatDate(n.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0 }}>{n.message}</p>
                  {!n.isRead && (
                    <span style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.7rem', background: '#0ea5e9', color: 'white', padding: '0.15rem 0.5rem', borderRadius: 8, fontWeight: 600 }}>YENİ</span>
                  )}
                </div>
              ))}
            </div>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
          </>
        ) : (
          <EmptyState message="Henüz bildirim yok" />
        )}
      </Card>
    </div>
  );
}

function notificationIcon(type: string): string {
  const map: Record<string, string> = {
    reservation_confirmed: '✓',
    reservation_cancelled: '✗',
    reservation_completed: '✓',
    service_approved: '✓',
    service_rejected: '✗',
    provider_approved: '✓',
    provider_rejected: '✗',
    payment_received: '💰',
    payment_failed: '⚠',
    refund_processed: '💰',
    generic: 'ℹ',
  };
  return map[type] || 'ℹ';
}
