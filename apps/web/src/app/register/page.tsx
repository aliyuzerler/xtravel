'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setStoredAuth } from '@/lib/auth';
import { UserRole } from '@turizm-pazaryeri/shared';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: UserRole.USER as UserRole.USER | UserRole.PROVIDER,
    companyName: '',
    taxNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProvider = form.role === UserRole.PROVIDER;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isProvider && !form.companyName) {
      setError('Sağlayıcı kaydı için şirket adı zorunludur.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          phone: form.phone || undefined,
          role: form.role,
          ...(isProvider ? { companyName: form.companyName, taxNumber: form.taxNumber || undefined } : {}),
        }),
      });
      const json = await res.json();

      if ((res.status === 201 || res.ok) && json.success && json.data) {
        setStoredAuth(
          {
            accessToken: json.data.accessToken,
            refreshToken: json.data.refreshToken,
          },
          json.data.user,
        );
        if (json.data.user.role === UserRole.PROVIDER) {
          router.push('/provider/pending');
        } else {
          router.push('/');
        }
      } else {
        setError(json.message || 'Kayıt başarısız');
      }
    } catch (err) {
      setError('Ağ hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>Kayıt Ol</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="role">Hesap Tipi</label>
          <select
            id="role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as any })}
          >
            <option value={UserRole.USER}>Kullanıcı (rezervasyon yapacağım)</option>
            <option value={UserRole.PROVIDER}>Hizmet Sağlayıcı (hizmet sunacağım)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="fullName">Ad Soyad</label>
          <input
            id="fullName"
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
            minLength={2}
          />
        </div>
        <div className="field">
          <label htmlFor="email">E-posta</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Şifre</label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            placeholder="En az 8 karakter"
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Telefon (opsiyonel)</label>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+90 5XX XXX XX XX"
          />
        </div>

        {isProvider && (
          <>
            <div className="field">
              <label htmlFor="companyName">Şirket Adı</label>
              <input
                id="companyName"
                type="text"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                required={isProvider}
              />
            </div>
            <div className="field">
              <label htmlFor="taxNumber">Vergi / TCKN No (opsiyonel)</label>
              <input
                id="taxNumber"
                type="text"
                value={form.taxNumber}
                onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                placeholder="10-11 hane"
                pattern="[0-9]{10,11}"
              />
            </div>
          </>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
        </button>
      </form>
      <div className="link-row">
        Hesabın var mı? <Link href="/login">Giriş yap</Link>
      </div>
    </div>
  );
}
