import { test, expect } from '@playwright/test';
import {
  registerUser,
  login,
  authHeader,
} from '../fixtures/helpers';

/**
 * E2E Akış 1: Kayıt → Giriş → /auth/me
 *
 * Kabul kriteri: Kayıt sonrası token alınır, login ile aynı kullanıcıya erişilir,
 * /auth/me güncel bilgileri döner.
 */
test.describe('Auth akışı', () => {
  test('kayıt → giriş → /auth/me', async ({ request }) => {
    // 1. Kayıt ol
    const ts = Date.now();
    const email = `e2e-auth-${ts}@test.local`;
    const regRes = await request.post('/api/auth/register', {
      data: {
        email,
        password: 'Test12345!',
        fullName: `E2E Auth ${ts}`,
        role: 'user',
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const regJson = await regRes.json();
    expect(regJson.success).toBe(true);
    expect(regJson.data.accessToken).toBeTruthy();
    expect(regJson.data.refreshToken).toBeTruthy();
    expect(regJson.data.user.email).toBe(email);

    // 2. /auth/me (kayıt token'ı ile)
    const meRes1 = await request.get('/api/auth/me', {
      headers: authHeader({ accessToken: regJson.data.accessToken } as any),
    });
    expect(meRes1.ok()).toBeTruthy();
    const meJson1 = await meRes1.json();
    expect(meJson1.data.email).toBe(email);

    // 3. Login (kayıt olduktan sonra)
    const loginRes = await request.post('/api/auth/login', {
      data: { email, password: 'Test12345!' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginJson = await loginRes.json();
    expect(loginJson.data.accessToken).toBeTruthy();

    // 4. /auth/me (login token'ı ile)
    const meRes2 = await request.get('/api/auth/me', {
      headers: authHeader({ accessToken: loginJson.data.accessToken } as any),
    });
    expect(meRes2.ok()).toBeTruthy();
    const meJson2 = await meRes2.json();
    expect(meJson2.data.id).toBe(regJson.data.user.id);
  });

  test('yanlış şifre ile login → 401', async ({ request }) => {
    const ts = Date.now();
    const email = `e2e-wrong-${ts}@test.local`;
    await request.post('/api/auth/register', {
      data: { email, password: 'Test12345!', fullName: 'E2E', role: 'user' },
    });

    const res = await request.post('/api/auth/login', {
      data: { email, password: 'WRONG-PASSWORD' },
    });
    expect(res.status()).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  test('refresh token rotasyonu', async ({ request }) => {
    const session = await registerUser({});

    // 1. Refresh → yeni token
    const r1 = await request.post('/api/auth/refresh', {
      data: { refreshToken: session.refreshToken },
    });
    expect(r1.ok()).toBeTruthy();
    const r1Json = await r1.json();
    const newRefresh = r1Json.data.refreshToken;
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(session.refreshToken);

    // 2. Eski refresh token → 401
    const r2 = await request.post('/api/auth/refresh', {
      data: { refreshToken: session.refreshToken },
    });
    expect(r2.status()).toBe(401);
  });
});
