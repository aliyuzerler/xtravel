'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getStoredAuth } from '@/lib/auth';
import { Card, PageHeader, Button, Input, ErrorState } from '@/components/admin-ui';

interface User {
  id: string; email: string; fullName: string | null; phone: string | null;
  role: string; status: string; providerId: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile form
  const [profile, setProfile] = useState({ fullName: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Password form
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth.accessToken) { router.replace('/login?next=/profile'); return; }
    apiFetch<User>('/api/auth/me').then((r) => {
      if (r.success && r.data) {
        setUser(r.data);
        setProfile({ fullName: r.data.fullName || '', phone: r.data.phone || '' });
      } else {
        setError(r.message || 'Yüklenemedi');
      }
      setLoading(false);
    });
  }, [router]);

  async function saveProfile() {
    setProfileSaving(true);
    setProfileMsg(null);
    const r = await apiFetch('/api/auth/me', { method: 'PUT', body: JSON.stringify(profile) });
    setProfileSaving(false);
    if (r.success) {
      setProfileMsg('Profil güncellendi');
      if (user) setUser({ ...user, ...profile });
    } else {
      setProfileMsg(null);
      setError(r.message || 'Güncellenemedi');
    }
  }

  async function changePassword() {
    setPwdMsg(null);
    if (pwd.newPassword.length < 8) { setPwdMsg({ type: 'error', text: 'Yeni şifre en az 8 karakter olmalı' }); return; }
    if (pwd.newPassword !== pwd.confirmPassword) { setPwdMsg({ type: 'error', text: 'Yeni şifre ve tekrarı eşleşmiyor' }); return; }
    if (pwd.currentPassword === pwd.newPassword) { setPwdMsg({ type: 'error', text: 'Yeni şifre mevcut şifreden farklı olmalı' }); return; }
    setPwdSaving(true);
    const r = await apiFetch<{ message: string }>('/api/auth/change-password', {
      method: 'POST', body: JSON.stringify({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword }),
    });
    setPwdSaving(false);
    if (r.success) {
      setPwdMsg({ type: 'success', text: r.data?.message || 'Şifre güncellendi' });
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } else {
      setPwdMsg({ type: 'error', text: r.message || 'Şifre değiştirilemedi' });
    }
  }

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;
  if (error && !user) return <ErrorState message={error} />;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <PageHeader title="Profilim" subtitle={user.email} />

      {user.role === 'provider' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Sağlayıcı paneline</strong>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0' }}>
                Hizmetlerinizi yönetmek için sağlayıcı paneline geçin.
              </p>
            </div>
            <a href="/provider/dashboard" style={{ padding: '0.5rem 1rem', background: '#0ea5e9', color: 'white', textDecoration: 'none', borderRadius: 4 }}>Sağlayıcı Paneli →</a>
          </div>
        </Card>
      )}

      <Card title="Bilgilerim">
        {profileMsg && <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', color: '#16a34a', borderRadius: 4, marginBottom: '1rem', fontSize: '0.9rem' }}>✓ {profileMsg}</div>}
        {error && <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', color: '#dc2626', borderRadius: 4, marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Ad Soyad</label>
            <Input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} placeholder="Adınız soyadınız" />
          </div>
          <div>
            <label style={labelStyle}>Telefon</label>
            <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+90 5XX XXX XX XX" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>E-posta (değiştirilemez)</label>
            <Input value={user.email} disabled />
          </div>
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <Button onClick={saveProfile} disabled={profileSaving}>{profileSaving ? 'Kaydediliyor...' : 'Bilgileri Kaydet'}</Button>
        </div>
      </Card>

      <Card title="Şifre Değiştir">
        {pwdMsg && (
          <div style={{
            padding: '0.75rem 1rem', borderRadius: 4, marginBottom: '1rem', fontSize: '0.9rem',
            background: pwdMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: pwdMsg.type === 'success' ? '#16a34a' : '#dc2626',
          }}>{pwdMsg.type === 'success' ? '✓ ' : '✗ '}{pwdMsg.text}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Mevcut şifre *</label>
            <Input type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} placeholder="••••••••" />
          </div>
          <div>
            <label style={labelStyle}>Yeni şifre * (en az 8 karakter)</label>
            <Input type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} placeholder="••••••••" />
          </div>
          <div>
            <label style={labelStyle}>Yeni şifre tekrar *</label>
            <Input type="password" value={pwd.confirmPassword} onChange={(e) => setPwd({ ...pwd, confirmPassword: e.target.value })} placeholder="••••••••" />
          </div>
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <Button onClick={changePassword} disabled={pwdSaving || !pwd.currentPassword || !pwd.newPassword || !pwd.confirmPassword}>
            {pwdSaving ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
          </Button>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem' }}>
          ⚠️ Şifre değişince diğer cihazlardaki oturumlarınız otomatik kapanır.
        </p>
      </Card>

      <Card title="Hesap Bilgileri">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 140, color: '#64748b' }}>Hesap tipi</div>
            <div><strong>{user.role === 'super_admin' ? 'Süper Admin' : user.role === 'provider' ? 'Sağlayıcı' : 'Kullanıcı'}</strong></div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 140, color: '#64748b' }}>Durum</div>
            <div>{user.status === 'active' ? '✓ Aktif' : user.status === 'pending' ? '⏳ Beklemede' : '⛔ Banlı'}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem', color: '#475569' };
