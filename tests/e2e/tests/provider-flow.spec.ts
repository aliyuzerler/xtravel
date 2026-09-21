import { test, expect } from '@playwright/test';
import {
  registerUser,
  loginAdmin,
  loginProvider,
  authHeader,
  createService,
  completeServiceForApproval,
  approveService,
} from '../fixtures/helpers';

/**
 * E2E Akış 2: Sağlayıcı hizmet oluştur → onaya gönder → admin onayla
 *
 * Kabul kriteri: 5 adımlı form tamamlanır, admin onay listesinde görünür,
 * admin onaylar ve service published olur, public listede görünür.
 */
test.describe('Sağlayıcı hizmet akışı', () => {
  test('hizmet oluştur → onaya gönder → admin onayla', async ({ request }) => {
    // 1. Provider register (provider rolünde)
    const provider = await registerUser({
      role: 'provider',
      companyName: `E2E Provider ${Date.now()}`,
    });

    // 2. Admin, provider'ı onayla (approved)
    const admin = await loginAdmin();
    const provListRes = await request.get('/api/admin/providers?status=pending', {
      headers: authHeader(admin),
    });
    const provList = await provListRes.json();
    const newProvider = provList.data.items.find((p: any) => p.companyName.includes('E2E'));
    expect(newProvider).toBeTruthy();

    const approveProvRes = await request.put(`/api/admin/providers/${newProvider.id}/approve`, {
      headers: authHeader(admin),
      data: { note: 'E2E test' },
    });
    expect(approveProvRes.ok()).toBeTruthy();

    // 3. Provider yeni service oluştur (draft)
    const service = await createService(provider);
    expect(service.id).toBeTruthy();
    expect(service.status).toBe('draft');

    // 4. Service'i onaya gönder (image + pricing + schedule ekle)
    const submitted = await completeServiceForApproval(provider, service.id);
    expect(submitted.status).toBe('pending_approval');

    // 5. Admin pending listede görmeli
    const adminPendingRes = await request.get('/api/admin/services?status=pending_approval', {
      headers: authHeader(admin),
    });
    const adminPending = await adminPendingRes.json();
    const found = adminPending.data.items.find((s: any) => s.id === service.id);
    expect(found).toBeTruthy();

    // 6. Admin onayla
    const approved = await approveService(admin, service.id);
    expect(approved.status).toBe('published');

    // 7. Public listede görünür
    const publicRes = await request.get(`/services/${service.slug}`);
    expect(publicRes.ok()).toBeTruthy();
    const publicJson = await publicRes.json();
    expect(publicJson.data.title).toBe(service.title);
  });

  test('reddedilen hizmet düzenlenip tekrar onaya gönderilebilir', async ({ request }) => {
    const provider = await registerUser({
      role: 'provider',
      companyName: `E2E Reject ${Date.now()}`,
    });
    const admin = await loginAdmin();

    // Provider onayla
    const provListRes = await request.get('/api/admin/providers?status=pending', {
      headers: authHeader(admin),
    });
    const provList = await provListRes.json();
    const newProvider = provList.data.items.find((p: any) => p.companyName.includes('E2E Reject'));
    await request.put(`/api/admin/providers/${newProvider.id}/approve`, {
      headers: authHeader(admin),
      data: {},
    });

    // Service oluştur + submit
    const service = await createService(provider);
    await completeServiceForApproval(provider, service.id);

    // Admin reddet
    const rejectRes = await request.put(`/api/admin/services/${service.id}/reject`, {
      headers: authHeader(admin),
      data: { reason: 'E2E test: açıklama yetersiz' },
    });
    expect(rejectRes.ok()).toBeTruthy();
    const rejected = await rejectRes.json();
    expect(rejected.data.status).toBe('rejected');
    expect(rejected.data.rejectionReason).toBe('E2E test: açıklama yetersiz');

    // Provider düzenleyip tekrar submit
    const editRes = await request.put(`/api/provider/services/${service.id}`, {
      headers: authHeader(provider),
      data: {
        title: `${service.title} (düzeltilmiş)`,
        description: 'Çok daha uzun ve detaylı açıklama — E2E test.',
        categoryId: service.categoryId || service.category?.id,
        cityId: service.cityId || service.city?.id,
      },
    });
    expect(editRes.ok()).toBeTruthy();

    const resubmitRes = await request.post(`/api/provider/services/${service.id}/submit`, {
      headers: authHeader(provider),
      data: {},
    });
    expect(resubmitRes.ok()).toBeTruthy();
    const resubmitted = await resubmitRes.json();
    expect(resubmitted.data.status).toBe('pending_approval');
  });

  test('ownership: başkasının hizmetine erişim → 403', async ({ request }) => {
    const provider1 = await registerUser({
      role: 'provider',
      companyName: `E2E Own1 ${Date.now()}`,
    });
    const provider2 = await registerUser({
      role: 'provider',
      companyName: `E2E Own2 ${Date.now()}`,
    });
    const admin = await loginAdmin();

    // Her iki provider'ı onayla
    const provListRes = await request.get('/api/admin/providers?status=pending', {
      headers: authHeader(admin),
    });
    const provList = await provListRes.json();
    for (const p of provList.data.items) {
      if (p.companyName.includes('E2E Own')) {
        await request.put(`/api/admin/providers/${p.id}/approve`, {
          headers: authHeader(admin),
          data: {},
        });
      }
    }

    // Provider1 service oluştur
    const service = await createService(provider1);

    // Provider2 erişmeye çalış → 403
    const res = await request.get(`/api/provider/services/${service.id}`, {
      headers: authHeader(provider2),
    });
    expect(res.status()).toBe(403);
  });
});
