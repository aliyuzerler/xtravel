/**
 * Test yardımcıları — API token, kullanıcı oluşturma, fixture'lar.
 */
import { request, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:3000/api';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: any;
}

/** Yeni kullanıcı kaydet ve token'larla dön. */
export async function registerUser(opts: {
  email?: string;
  password?: string;
  fullName?: string;
  role?: 'user' | 'provider';
  companyName?: string;
}): Promise<AuthSession> {
  const ts = Date.now();
  const email = opts.email || `e2e-${ts}@test.local`;
  const password = opts.password || 'Test12345!';
  const fullName = opts.fullName || `E2E Test ${ts}`;

  const res = await request.post(`${API_BASE}/auth/register`, {
    data: {
      email,
      password,
      fullName,
      role: opts.role || 'user',
      ...(opts.role === 'provider' && opts.companyName
        ? { companyName: opts.companyName, taxNumber: '1234567890' }
        : {}),
    },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return {
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken,
    user: json.data.user,
  };
}

/** Login ol ve token'larla dön. */
export async function login(email: string, password: string): Promise<AuthSession> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return {
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken,
    user: json.data.user,
  };
}

/** Admin login (seed demo hesabı). */
export async function loginAdmin(): Promise<AuthSession> {
  return login('admin@turizm-pazaryeri.local', 'Admin123!');
}

/** Demo sağlayıcı login. */
export async function loginProvider(): Promise<AuthSession> {
  return login('provider1@demo.local', 'Provider123!');
}

/** Demo müşteri login. */
export async function loginCustomer(): Promise<AuthSession> {
  return login('customer@demo.local', 'Customer123!');
}

/** Auth header'ı oluştur. */
export function authHeader(session: AuthSession): Record<string, string> {
  return { Authorization: `Bearer ${session.accessToken}` };
}

/** Bir published service'in slug'ını getir. */
export async function getFirstPublishedServiceSlug(): Promise<string> {
  const res = await request.get(`${API_BASE}/services?limit=1`);
  const json = await res.json();
  expect(json.data.items.length).toBeGreaterThan(0);
  return json.data.items[0].slug;
}

/** Sağlayıcı için yeni service oluştur (draft). */
export async function createService(provider: AuthSession, opts: {
  categoryId?: string;
  cityId?: string;
  title?: string;
} = {}): Promise<any> {
  // Category + City çek
  let categoryId = opts.categoryId;
  let cityId = opts.cityId;
  if (!categoryId) {
    const catRes = await request.get(`${API_BASE}/categories`);
    const catJson = await catRes.json();
    categoryId = catJson.data[0].id;
  }
  if (!cityId) {
    const cityRes = await request.get(`${API_BASE}/cities`);
    const cityJson = await cityRes.json();
    cityId = cityJson.data[0].id;
  }

  const res = await request.post(`${API_BASE}/provider/services`, {
    headers: authHeader(provider),
    data: {
      title: opts.title || `E2E Service ${Date.now()}`,
      description: 'E2E test için oluşturulmuş hizmet açıklaması — yeterli uzunlukta.',
      categoryId,
      cityId,
      meetingPoint: 'Test buluşma noktası',
      durationHours: 3,
    },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.data;
}

/** Service'e image, pricing, schedule ekle ve submit. */
export async function completeServiceForApproval(provider: AuthSession, serviceId: string): Promise<any> {
  // 1. Image
  await request.post(`${API_BASE}/provider/services/${serviceId}/images`, {
    headers: authHeader(provider),
    data: { imageUrl: 'https://images.unsplash.com/test?w=800', isMain: true, sortOrder: 0 },
  });

  // 2. Pricing
  await request.post(`${API_BASE}/provider/services/${serviceId}/pricing`, {
    headers: authHeader(provider),
    data: { name: 'Yetişkin', price: 250, currency: 'TRY', unit: 'per_person' },
  });

  // 3. Schedule (gelecek tarih)
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 14);
  futureDate.setHours(10, 0, 0, 0);
  const endDate = new Date(futureDate);
  endDate.setHours(endDate.getHours() + 3);
  await request.post(`${API_BASE}/provider/services/${serviceId}/schedules`, {
    headers: authHeader(provider),
    data: {
      startAt: futureDate.toISOString(),
      endAt: endDate.toISOString(),
      capacity: 10,
    },
  });

  // 4. Submit for approval
  const submitRes = await request.post(`${API_BASE}/provider/services/${serviceId}/submit`, {
    headers: authHeader(provider),
    data: {},
  });
  expect(submitRes.ok()).toBeTruthy();
  const submitJson = await submitRes.json();
  return submitJson.data;
}

/** Admin service approve. */
export async function approveService(admin: AuthSession, serviceId: string): Promise<any> {
  const res = await request.put(`${API_BASE}/admin/services/${serviceId}/approve`, {
    headers: authHeader(admin),
    data: { note: 'E2E test approve' },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data;
}

/** Mock payment success (sandbox). */
export async function mockPaymentSuccess(paymentId: string): Promise<any> {
  const res = await request.get(`${API_BASE}/payments/mock-callback?paymentId=${paymentId}&status=success`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data;
}
