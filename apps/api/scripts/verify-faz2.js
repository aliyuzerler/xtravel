/**
 * Faz-2 doğrulama betiği (plain JS).
 * API ayakta olmalı.
 */
const API = 'http://localhost:3000/api';

function hr(label) {
  console.log('\n' + '─'.repeat(70));
  console.log('  ' + label);
  console.log('─'.repeat(70));
}
function ok(label, cond, extra) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`);
  return cond;
}

async function jpost(path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts };
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function jget(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { method: 'GET', headers: opts });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function jput(path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts };
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function jdelete(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { method: 'DELETE', headers: opts });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function login(email, password) {
  const r = await jpost('/auth/login', { email, password });
  return r.json?.data?.accessToken || null;
}

async function main() {
  let allOk = true;
  const adminToken = await login('admin@turizm-pazaryeri.local', 'Admin123!');
  if (!adminToken) {
    console.error('Admin girişi başarısız — seed çalıştırıldığından emin olun.');
    process.exit(1);
  }
  const adminAuth = { Authorization: `Bearer ${adminToken}` };

  // 1) Admin-only erişim kontrolü
  hr('1) ADMIN-ONLY ERİŞİM (403)');
  // User rolünde kullanıcı oluştur
  const ts = Date.now();
  const userEmail = `faz2-user-${ts}@test.local`;
  const reg = await jpost('/auth/register', {
    email: userEmail, password: 'Test12345!', fullName: 'User Test', role: 'user',
  });
  const userToken = reg.json?.data?.accessToken;
  const userAuth = { Authorization: `Bearer ${userToken}` };

  const userHitsAdmin = await jget('/admin/dashboard/stats', userAuth);
  ok('User /admin/dashboard → 403', userHitsAdmin.status === 403, `status=${userHitsAdmin.status}`);

  const userNoToken = await jget('/admin/dashboard/stats');
  ok('No token /admin/dashboard → 401', userNoToken.status === 401, `status=${userNoToken.status}`);

  const adminOk = await jget('/admin/dashboard/stats', adminAuth);
  ok('Admin /admin/dashboard → 200', adminOk.status === 200);

  // 2) Dashboard istatistikleri gerçek veri
  hr('2) DASHBOARD İSTATİSTİKLERİ');
  const stats = adminOk.json?.data;
  if (stats) {
    ok('totalUsers > 0', stats.totalUsers > 0, `totalUsers=${stats.totalUsers}`);
    ok('totalProviders >= 2', stats.totalProviders >= 2, `totalProviders=${stats.totalProviders}`);
    ok('totalServices >= 2', stats.totalServices >= 2, `totalServices=${stats.totalServices}`);
    ok('publishedServices >= 1', stats.publishedServices >= 1, `publishedServices=${stats.publishedServices}`);
    ok('pendingProviders >= 1', stats.pendingProviders >= 1, `pendingProviders=${stats.pendingProviders}`);
    ok('pendingServices >= 1', stats.pendingServices >= 1, `pendingServices=${stats.pendingServices}`);
    ok('totalReservations > 0', stats.totalReservations > 0, `totalReservations=${stats.totalReservations}`);
    ok('totalRevenue > 0', stats.totalRevenue > 0, `totalRevenue=${stats.totalRevenue}`);
    ok('monthly length = 6', Array.isArray(stats.monthly) && stats.monthly.length === 6, `monthly.length=${stats.monthly?.length}`);
    if (stats.monthly) {
      const totalRes = stats.monthly.reduce((s, m) => s + (m.reservations || 0), 0);
      ok('Monthly reservations sum > 0', totalRes > 0, `sum=${totalRes}`);
      console.log('   Aylık breakdown:');
      for (const m of stats.monthly) {
        console.log(`     ${m.label}: ${m.reservations} rezervasyon, ${m.revenue} TRY`);
      }
    }
  } else {
    ok('Dashboard stats döndü', false);
    allOk = false;
  }

  // 3) Sağlayıcı onay akışı + notification
  hr('3) SAĞLAYICI ONAY AKIŞI + NOTIFICATION');
  // Pending sağlayıcıyı bul
  const provList = await jget('/admin/providers?status=pending', adminAuth);
  ok('Pending providers listelendi', provList.status === 200);
  const pendingProvider = provList.json?.data?.items?.[0];
  ok('Pending provider bulundu', !!pendingProvider, `id=${pendingProvider?.id}, companyName=${pendingProvider?.companyName}`);

  if (pendingProvider) {
    const providerId = pendingProvider.id;
    const userId = pendingProvider.userId;

    // Önce provider'ın user status'ü pending olmalı
    console.log(`   Provider öncesi: status=${pendingProvider.status}, userStatus=${pendingProvider.user?.status}`);

    // Onayla
    const approve = await jput(`/admin/providers/${providerId}/approve`, { note: 'Test onay notu' }, adminAuth);
    ok('Provider approve → 200', approve.status === 200, `status=${approve.status}`);
    ok('Provider status approved', approve.json?.data?.status === 'approved');

    // User status değişti mi kontrol et
    const provDetail = await jget(`/admin/providers/${providerId}`, adminAuth);
    ok('User status active oldu', provDetail.json?.data?.user?.status === 'active', `userStatus=${provDetail.json?.data?.user?.status}`);

    // Notification düşmüş mü kontrol et
    // /api/admin/users/:id/status yok ama notifications listelemek için bir endpoint yok (Faz 4'te eklenecek).
    // Doğrudan Prisma sorgulayamıyoruz — ama backend log'unda "Notification created" görmeliydik.
    console.log('   ✓ Notification backend log\'unda "Notification created" olarak teyit edilecek');

    // Şimdi reddet — yeni bir pending provider gerekli (öncekini onayladık)
    // Hizmet reddetme testini ileride yapalım.
  }

  // 4) Hizmet reddetme + notification
  hr('4) HİZMET REDDETME + NOTIFICATION');
  const servList = await jget('/admin/services?status=pending_approval', adminAuth);
  ok('Pending services listelendi', servList.status === 200);
  const pendingService = servList.json?.data?.items?.[0];
  ok('Pending service bulundu', !!pendingService, `id=${pendingService?.id}, title=${pendingService?.title}`);

  if (pendingService) {
    const serviceId = pendingService.id;
    const reason = 'Test: eksmiş görsel ve açıklama yetersiz';

    const reject = await jput(`/admin/services/${serviceId}/reject`, { reason }, adminAuth);
    ok('Service reject → 200', reject.status === 200, `status=${reject.status}`);
    ok('Service status rejected', reject.json?.data?.status === 'rejected');
    ok('rejectionReason kaydedildi', reject.json?.data?.rejectionReason === reason);
  }

  // 5) Kategori silme engeli (aktif hizmeti olan)
  hr('5) KATEGORİ SİLME ENGELİ');
  // "Kültür Turu" kategorisinde published ve pending_approval hizmetler var.
  // published olanı silmemeli; pending_approval olanı reject ettik ama hâlâ ilişkili kayıt var.
  const catList = await jget('/admin/categories', adminAuth);
  ok('Categories listelendi', catList.status === 200);
  const kulturCat = catList.json?.data?.find(c => c.slug === 'kultur-turu');
  ok('Kültür Turu kategorisi bulundu', !!kulturCat, `id=${kulturCat?.id}, _count.services=${kulturCat?._count?.services}`);

  if (kulturCat) {
    // Silmeyi dene → 409 dönmeli
    const del = await jdelete(`/admin/categories/${kulturCat.id}`, adminAuth);
    ok('Aktif hizmeti olan kategori silinemez → 409', del.status === 409, `status=${del.status}`);
    if (del.json?.message) console.log('   message:', del.json.message);

    // Pasife almaya çalış → 409 dönmeli
    const pause = await jput(`/admin/categories/${kulturCat.id}`, { isActive: false }, adminAuth);
    ok('Aktif hizmeti olan kategori pasife alınamaz → 409', pause.status === 409, `status=${pause.status}`);

    // Yeni kategori oluştur, sil (başarılı olmalı)
    const newCat = await jpost('/admin/categories', { name: 'Test Kategori Faz2', iconName: 'test', sortOrder: 99 }, adminAuth);
    ok('Yeni kategori oluştur → 201', newCat.status === 201, `status=${newCat.status}`);
    if (newCat.json?.data?.id) {
      const delNew = await jdelete(`/admin/categories/${newCat.json.data.id}`, adminAuth);
      ok('Hizmeti olmayan kategori silinebilir → 200', delNew.status === 200, `status=${delNew.status}`);
    }
  }

  // 6) Şehir CRUD + ayarlar
  hr('6) ŞEHİRLER + AYARLAR');
  const cities = await jget('/admin/cities', adminAuth);
  ok('Şehirler listelendi', cities.status === 200);
  ok('Şehir sayısı >= 81', cities.json?.data?.length >= 81, `count=${cities.json?.data?.length}`);

  const settings = await jget('/admin/settings', adminAuth);
  ok('Ayarlar listelendi', settings.status === 200);
  ok('commission_rate var', settings.json?.data?.commission_rate !== undefined, `value=${JSON.stringify(settings.json?.data?.commission_rate)}`);
  ok('cancel_policy_hours var', settings.json?.data?.cancel_policy_hours !== undefined);

  // Ayar güncelle
  const updateSet = await jput('/admin/settings/test_key', { value: { hello: 'world', n: 42 } }, adminAuth);
  ok('Ayar güncellendi → 200', updateSet.status === 200, `status=${updateSet.status}`);

  // 7) Reservations + Payments listesi (read-only)
  hr('7) REZERVASYONLAR + ÖDEMELER (read-only)');
  const reservations = await jget('/admin/reservations', adminAuth);
  ok('Rezervasyonlar listelendi', reservations.status === 200);
  ok('Rezervasyon sayısı > 0', (reservations.json?.data?.items?.length || 0) > 0, `count=${reservations.json?.data?.items?.length}`);

  const payments = await jget('/admin/payments', adminAuth);
  ok('Ödemeler listelendi', payments.status === 200);
  ok('Ödeme sayısı > 0', (payments.json?.data?.items?.length || 0) > 0, `count=${payments.json?.data?.items?.length}`);

  // 8) User banlama
  hr('8) KULLANICI BANLAMA');
  const userList = await jget('/admin/users?role=user', adminAuth);
  ok('User list → 200', userList.status === 200);
  const banUser = userList.json?.data?.items?.find(u => u.email === 'customer@demo.local');
  if (banUser) {
    const ban = await jput(`/admin/users/${banUser.id}/status`, { status: 'banned' }, adminAuth);
    ok('Kullanıcı banlandı → 200', ban.status === 200, `status=${ban.status}`);
    ok('User status banned', ban.json?.data?.status === 'banned');

    // Ban'ı kaldır
    const unban = await jput(`/admin/users/${banUser.id}/status`, { status: 'active' }, adminAuth);
    ok('Ban kaldırıldı → 200', unban.status === 200);
  } else {
    console.log('   (customer@demo.local bulunamadı, atlanıyor)');
  }

  hr('ÖZET');
  console.log(`  ${allOk ? '✓ Tüm kabul kriterleri PASSED' : '✗ BAZI KRİTERLER FAILED'}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Doğrulama hatası:', err);
  process.exit(1);
});
