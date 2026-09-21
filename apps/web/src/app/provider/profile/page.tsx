'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, PageHeader, Button, Input, StatusBadge, ErrorState } from '@/components/admin-ui';

interface Provider {
  id: string;
  companyName: string;
  taxNumber: string | null;
  phone: string | null;
  description: string | null;
  logoUrl: string | null;
  status: string;
  user: { email: string; fullName: string | null; phone: string | null };
}

export default function ProviderProfilePage() {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [form, setForm] = useState({ companyName: '', phone: '', description: '', logoUrl: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch<Provider>('/api/provider/profile').then((r) => {
      if (r.success && r.data) {
        setProvider(r.data);
        setForm({
          companyName: r.data.companyName || '',
          phone: r.data.phone || r.data.user.phone || '',
          description: r.data.description || '',
          logoUrl: r.data.logoUrl || '',
        });
      } else setError(r.message || 'Yüklenemedi');
    });
  }, []);

  async function submit() {
    setLoading(true);
    setSuccess(false);
    setError(null);
    const r = await apiFetch('/api/provider/profile', {
      method: 'PUT', body: JSON.stringify(form),
    });
    setLoading(false);
    if (r.success) {
      setSuccess(true);
      if (provider) setProvider({ ...provider, ...form });
    } else {
      setError(r.message || 'Güncellenemedi');
    }
  }

  if (error && !provider) return <ErrorState message={error} />;
  if (!provider) return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;

  return (
    <>
      <PageHeader title="Profil" subtitle="Sağlayıcı firma bilgileri" />

      <Card>
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: '#475569' }}>Sağlayıcı durumu:</div>
          <StatusBadge status={provider.status} />
        </div>

        {success && (
          <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', color: '#16a34a', borderRadius: 4, marginBottom: '1rem', fontSize: '0.9rem' }}>
            ✓ Profil güncellendi
          </div>
        )}
        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', color: '#dc2626', borderRadius: 4, marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Şirket adı</label>
            <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Telefon</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+90 5XX XXX XX XX" />
          </div>
          <div>
            <label style={labelStyle}>Logo URL</label>
            <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label style={labelStyle}>Vergi no (salt okunur)</label>
            <Input value={provider.taxNumber || '-'} disabled />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Açıklama</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} style={{ ...textareaStyle, width: '100%' }} placeholder="Şirketiniz hakkında kısa açıklama..." />
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
          <Button onClick={submit} disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</Button>
        </div>
      </Card>

      <Card title="Kullanıcı Bilgileri">
        <Row label="E-posta" value={provider.user.email} />
        <Row label="Ad Soyad" value={provider.user.fullName || '-'} />
      </Card>
    </>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem', color: '#475569' };
const textareaStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: 140, color: '#64748b', fontSize: '0.85rem' }}>{label}</div>
      <div style={{ flex: 1 }}>{value}</div>
    </div>
  );
}
