'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredAuth, clearStoredAuth, type StoredUser } from '@/lib/auth';
import { apiFetch } from '@/lib/auth';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth.accessToken || !auth.user) {
      router.replace('/login?next=/provider/dashboard');
      return;
    }
    if (auth.user.role !== 'provider') {
      router.replace('/');
      return;
    }
    setUser(auth.user);

    // Provider profilini yükle — onay durumuna göre yönlendir
    apiFetch<any>('/api/provider/profile').then((r) => {
      if (r.success && r.data) {
        setProvider(r.data);
        if (r.data.status === 'rejected') {
          router.replace('/provider/pending');
        }
      } else if (r.statusCode === 404 || (r.statusCode === 403 && (r as any).code === 'OWNERSHIP_VIOLATION')) {
        // Henüz provider başvurusu yok
        router.replace('/provider/apply');
      }
      setReady(true);
    });
  }, [router]);

  if (!ready) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;
  }

  // Pending provider — sadece başvuru durumu göster
  if (provider && provider.status === 'pending') {
    return (
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⏳</div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Başvurunuz inceleniyor</h1>
        <p style={{ color: '#64748b' }}>
          "{provider.companyName}" sağlayıcı başvurunuz platform yöneticileri tarafından inceleniyor.
          Onaylandıktan sonra hizmet oluşturmaya başlayabilirsiniz.
        </p>
        <button
          onClick={() => { clearStoredAuth(); router.push('/login'); }}
          style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem', background: '#64748b', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >Çıkış Yap</button>
      </div>
    );
  }

  if (!provider) {
    // Henüz başvuru yapmamış kullanıcı — apply sayfasına yönlendir
    router.replace('/provider/apply');
    return null;
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
    { href: '/provider/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/provider/services', label: 'Hizmetlerim', icon: '🎯' },
    { href: '/provider/new-service', label: 'Yeni Hizmet', icon: '➕' },
    { href: '/provider/reservations', label: 'Rezervasyonlar', icon: '📅' },
    { href: '/provider/earnings', label: 'Kazançlar', icon: '💰' },
    { href: '/provider/profile', label: 'Profil', icon: '⚙️' },
  ];

  return (
    <aside style={{ width: 240, background: '#1e293b', color: 'white', padding: '1.5rem 0', minHeight: '100vh' }}>
      <div style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid #334155' }}>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Sağlayıcı Paneli
        </div>
        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.25rem' }}>{user.email}</div>
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
            }}
          >
            <span style={{ marginRight: '0.5rem' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid #334155' }}>
        <button
          onClick={() => { clearStoredAuth(); router.push('/login'); }}
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
        >Çıkış Yap</button>
      </div>
    </aside>
  );
}
