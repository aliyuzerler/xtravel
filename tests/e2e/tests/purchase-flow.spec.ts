import { test, expect } from '@playwright/test';
import {
  loginCustomer,
  loginProvider,
  loginAdmin,
  authHeader,
  createService,
  completeServiceForApproval,
  approveService,
} from '../fixtures/helpers';

/**
 * E2E Akış 3: Kullanıcı satın alma → iptal → iade (sandbox ödeme)
 *
 * Kabul kriteri: Hizmet bul, rezervasyon oluştur, ödeme başlat, mock success,
 * reservation confirmed, kullanıcı iptal et (FULL iade), refund kaydı oluşur.
 */
test.describe('Kullanıcı satın alma + iptal akışı', () => {
  test('bul → satın al → iptal → iade', async ({ request }) => {
    const admin = await loginAdmin();
    const provider = await loginProvider();

    // 1. Provider yeni service oluştur + onaya gönder
    const service = await createService(provider);
    await completeServiceForApproval(provider, service.id);

    // 2. Admin onayla
    const approved = await approveService(admin, service.id);
    expect(approved.status).toBe('published');

    // 3. Public detail çek
    const detailRes = await request.get(`/api/services/${service.slug}`);
    const detail = await detailRes.json();
    expect(detail.data.pricing.length).toBeGreaterThan(0);
    expect(detail.data.schedules.length).toBeGreaterThan(0);

    const pricingId = detail.data.pricing[0].id;
    const scheduleId = detail.data.schedules[0].id;

    // 4. Kullanıcı rezervasyon oluştur
    const customer = await loginCustomer();
    const resRes = await request.post('/api/reservations', {
      headers: authHeader(customer),
      data: {
        serviceId: detail.data.id,
        scheduleId,
        pricingId,
        participantCount: 1,
        contactName: 'E2E Customer',
        contactEmail: customer.user.email,
        contactPhone: '+90 555 000 0000',
      },
    });
    expect(resRes.status()).toBe(201);
    const reservation = (await resRes.json()).data;
    expect(reservation.status).toBe('pending_payment');
    expect(reservation.reservationCode).toMatch(/^TR-/);

    // 5. Ödeme başlat
    const payInitRes = await request.post('/api/payments/init', {
      headers: authHeader(customer),
      data: { reservationId: reservation.id },
    });
    expect(payInitRes.ok()).toBeTruthy();
    const payment = (await payInitRes.json()).data;
    expect(payment.paymentId).toBeTruthy();

    // 6. Mock success callback
    const mockRes = await request.get(
      `/api/payments/mock-callback?paymentId=${payment.paymentId}&status=success`,
    );
    expect(mockRes.ok()).toBeTruthy();

    // 7. Reservation confirmed olmalı
    const resAfter = await request.get(`/api/user/reservations/${reservation.id}`, {
      headers: authHeader(customer),
    });
    const resAfterJson = await resAfter.json();
    expect(resAfterJson.data.status).toBe('confirmed');

    // 8. Kullanıcı iptal et (full iade — tur 14 gün sonra)
    const cancelRes = await request.post(`/api/user/reservations/${reservation.id}/cancel`, {
      headers: authHeader(customer),
      data: { reason: 'E2E test: plan değişikliği' },
    });
    expect(cancelRes.ok()).toBeTruthy();
    const cancelJson = await cancelRes.json();
    expect(cancelJson.data.reservation.status).toBe('cancelled');
    expect(cancelJson.data.refund).toBeTruthy();
    expect(cancelJson.data.refund.refundPercentage).toBe(100);
    expect(cancelJson.data.refund.refundAmount).toBeGreaterThan(0);
  });

  test('ödeme başarısız → reservation pending kalır', async ({ request }) => {
    const admin = await loginAdmin();
    const provider = await loginProvider();

    const service = await createService(provider);
    await completeServiceForApproval(provider, service.id);
    await approveService(admin, service.id);

    const detailRes = await request.get(`/api/services/${service.slug}`);
    const detail = await detailRes.json();
    const customer = await loginCustomer();

    const resRes = await request.post('/api/reservations', {
      headers: authHeader(customer),
      data: {
        serviceId: detail.data.id,
        scheduleId: detail.data.schedules[0].id,
        pricingId: detail.data.pricing[0].id,
        participantCount: 1,
        contactName: 'E2E Fail',
        contactEmail: customer.user.email,
        contactPhone: '+90 555 000 0000',
      },
    });
    const reservation = (await resRes.json()).data;

    const payInitRes = await request.post('/api/payments/init', {
      headers: authHeader(customer),
      data: { reservationId: reservation.id },
    });
    const payment = (await payInitRes.json()).data;

    // Mock failure
    const failRes = await request.get(
      `/api/payments/mock-callback?paymentId=${payment.paymentId}&status=failure`,
    );
    expect(failRes.ok()).toBeTruthy();
    const failJson = await failRes.json();
    expect(failJson.data.status).toBe('failed');

    // Reservation hâlâ pending_payment
    const resAfter = await request.get(`/api/user/reservations/${reservation.id}`, {
      headers: authHeader(customer),
    });
    const resAfterJson = await resAfter.json();
    expect(resAfterJson.data.status).toBe('pending_payment');
  });

  test('kupon doğrulama — geçersiz kod → 422', async ({ request }) => {
    const admin = await loginAdmin();
    const provider = await loginProvider();
    const service = await createService(provider);
    await completeServiceForApproval(provider, service.id);
    await approveService(admin, service.id);

    const detailRes = await request.get(`/api/services/${service.slug}`);
    const detail = await detailRes.json();
    const customer = await loginCustomer();

    const resRes = await request.post('/api/reservations', {
      headers: authHeader(customer),
      data: {
        serviceId: detail.data.id,
        scheduleId: detail.data.schedules[0].id,
        pricingId: detail.data.pricing[0].id,
        participantCount: 1,
        contactName: 'E2E Coupon',
        contactEmail: customer.user.email,
        contactPhone: '+90 555 000 0000',
        couponCode: 'INVALID-COUPON-CODE',
      },
    });
    expect(resRes.status()).toBe(422);
  });
});
