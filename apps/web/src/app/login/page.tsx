'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setStoredAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (res.ok && json.success && json.data) {
        setStoredAuth(
          {
            accessToken: json.data.accessToken,
            refreshToken: json.data.refreshToken,
          },
          json.data.user,
        );
        // Rol bazlı yönlendirme
        if (json.data.user.role === 'super_admin') {
          router.push('/admin');
        } else if (json.data.user.role === 'provider') {
          router.push('/provider');
        } else {
          router.push('/');
        }
      } else {
        setError(json.message || 'Giriş başarısız');
      }
    } catch (err) {
      setError('Ağ hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>Giriş Yap</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">E-posta</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@email.com"
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="password">Şifre</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={1}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>
      <div className="link-row">
        Hesabın yok mu? <Link href="/register">Kayıt ol</Link>
      </div>
    </div>
  );
}
