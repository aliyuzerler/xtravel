'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getStoredAuth } from '@/lib/auth';
import { formatDate } from '@/components/admin-ui';

function timeAgo(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const diff = Date.now() - d.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'az önce';
  if (diff < hour) return `${Math.floor(diff / minute)} dk önce`;
  if (diff < day) return `${Math.floor(diff / hour)} saat önce`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} gün önce`;
  return formatDate(d);
}

interface Conversation {
  id: string;
  lastMessageAt: string;
  createdAt: string;
  reservation: {
    id: string; reservationCode: string;
    service: { id: string; title: string };
  };
  messages: Array<{
    id: string; content: string; senderType: string; createdAt: string; isRead: boolean;
  }>;
}

interface Paginated { items: Conversation[]; meta: { page: number; totalPages: number } }

export default function ConversationsPage() {
  const router = useRouter();
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth.accessToken) {
      router.replace('/login?next=/mesajlar');
      return;
    }
    Promise.all([
      apiFetch<Paginated>('/api/conversations?limit=20'),
      apiFetch<{ count: number }>('/api/conversations/unread-count'),
    ]).then(([conv, unread]) => {
      if (conv.success && conv.data) setData(conv.data);
      if (unread.success && unread.data) setUnreadCount(unread.data.count);
      setLoading(false);
    });
  }, [router]);

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;

  return (
    <div style={{ minHeight: '100vh', maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>💬 Mesajlar</h1>
        {unreadCount > 0 && (
          <span style={{ background: '#dc2626', color: 'white', padding: '0.25rem 0.75rem', borderRadius: 12, fontSize: '0.85rem', fontWeight: 600 }}>
            {unreadCount} okunmamış
          </span>
        )}
      </div>

      {!data || data.items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💬</div>
          <p>Henüz mesajınız yok.</p>
          <p style={{ fontSize: '0.85rem' }}>Onaylanmış rezervasyonlarınızdan mesajlaşmaya başlayabilirsiniz.</p>
          <Link href="/reservations" style={{ display: 'inline-block', marginTop: '1rem', color: '#0ea5e9', textDecoration: 'none', fontWeight: 500 }}>
            Rezervasyonlarım →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data.items.map((conv) => {
            const lastMsg = conv.messages[0];
            const hasUnread = conv.messages.some(m => !m.isRead && m.senderType !== 'user'); // basit kontrol
            return (
              <Link
                key={conv.id}
                href={`/mesajlar/${conv.id}`}
                style={{
                  display: 'block', padding: '1rem 1.25rem', background: 'white', borderRadius: 8,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textDecoration: 'none', color: 'inherit',
                  borderLeft: hasUnread ? '3px solid #0ea5e9' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      {conv.reservation.reservationCode} · {conv.reservation.service.title}
                    </div>
                    {lastMsg && (
                      <div style={{ fontSize: '0.9rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <strong>{lastMsg.senderType === 'user' ? 'Siz: ' : ''}</strong>{lastMsg.content}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                    {timeAgo(conv.lastMessageAt)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
