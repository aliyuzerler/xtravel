'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredAuth, clearStoredAuth, type StoredUser } from '@/lib/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth.accessToken || !auth.user) {
      router.replace('/login?next=/admin/dashboard');
      return;
    }
    if (auth.user.role !== 'super_admin') {
      router.replace('/');
      return;
    }
    setUser(auth.user);
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
        Yükleniyor...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar user={user!} />
      <main style={{ flex: 1, padding: '2rem', background: '#f1f5f9' }}>{children}</main>
    </div>
  );
}

function Sidebar({ user }: { user: StoredUser }) {
  const router = useRouter();
  const nav = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/admin/users', label: 'Kullanıcılar', icon: '👥' },
    { href: '/admin/providers', label: 'Sağlayıcılar', icon: '🏢' },
    { href: '/admin/services', label: 'Hizmetler', icon: '🎯' },
    { href: '/admin/categories', label: 'Kategoriler', icon: '🏷️' },
    { href: '/admin/cities', label: 'Şehirler', icon: '📍' },
    { href: '/admin/reservations', label: 'Rezervasyonlar', icon: '📅' },
    { href: '/admin/payments', label: 'Ödemeler', icon: '💳' },
    { href: '/admin/settings', label: 'Ayarlar', icon: '⚙️' },
  ];

  return (
    <aside style={{ width: 240, background: '#0f172a', color: 'white', padding: '1.5rem 0' }}>
      <div style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Turizm Pazaryeri
        </div>
        <div style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: '0.25rem' }}>Admin Panel</div>
      </div>
      <nav style={{ marginTop: '1rem' }}>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              padding: '0.75rem 1.5rem',
              color: '#cbd5e1',
              textDecoration: 'none',
              fontSize: '0.95rem',
              borderLeft: '3px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ marginRight: '0.5rem' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid #1e293b' }}>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
          {user.email}
        </div>
        <button
          onClick={() => {
            clearStoredAuth();
            router.push('/login');
          }}
          style={{
            width: '100%',
            padding: '0.5rem',
            background: 'transparent',
            border: '1px solid #475569',
            color: '#cbd5e1',
            borderRadius: 4,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
