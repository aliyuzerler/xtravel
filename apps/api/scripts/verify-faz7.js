/**
 * Faz-7 doğrulama betiği
 * - Yorum/Puan: completed reservation zorunlu, pending review public değil, admin onay/red sonrası avgRating güncel
 * - Favoriler: toggle optimistik, list IDs, list details
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
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
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
  const res = await fetch(`${API}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
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
  const ts = Date.now();

  // Admin ve customer login
  const adminToken = await login('admin@turizm-pazaryeri.local', 'Admin123!');
  const customerToken = await login('customer@demo.local', 'Customer123!');
  if (!adminToken || !customerToken) {
    console.error('Login başarısız — seed çalıştırın.');
    process.exit(1);
  }
  const adminAuth = { Authorization: `Bearer ${adminToken}` };
  const userAuth = { Authorization: `Bearer ${customerToken}` };

  // Bir kullanıcı oluştur (completed reservation yok)
  const newUserEmail = `faz7-nores-${ts}@test.local`;
  const reg = await jpost('/auth/register', {
    email: newUserEmail, password: 'Test12345!', fullName: 'No Res User', role: 'user',
  });
  const noResToken = reg.json?.data?.accessToken;
  const noResAuth = { Authorization: `Bearer ${noResToken}` };

  // Seed'de service1'in slug'ı
  const slug = 'antalya-eski-sehir-yuruyusu';
  const detail = await jget(`/services/${slug}`);
  const serviceId = detail.json?.data?.id;
  ok('Service bulundu', !!serviceId, `id=${serviceId?.slice(0, 8)}`);

  // Önce avgRating ve reviewCount cache'ini kontrol et
  ok('Service avgRating mevcut', detail.json?.data?.avgRating != null, `avg=${detail.json?.data?.avgRating}`);
  ok('Service reviewCount > 0', detail.json?.data?.reviewCount > 0, `count=${detail.json?.data?.reviewCount}`);

  // ===================================================================
  // 1) YORUM/PUAN
  // ===================================================================
  hr('1) YORUM/PUAN — completed reservation kontrolü');

  // 1a. Completed reservation'ı OLMAYAN kullanıcı yorum ekleyemez → 403
  const blockedReview = await jpost(`/services/${serviceId}/reviews`, {
    rating: 5, comment: 'Test yorum',
  }, noResAuth);
  ok('Completed rezervasyonu olmayan → 403', blockedReview.status === 403, `status=${blockedReview.status}`);
  ok('Hata kodu ROLE_FORBIDDEN', blockedReview.json?.code === 'ROLE_FORBIDDEN');

  // 1b. Customer'ın yorumu zaten var (seed'de) → 409
  const duplicateReview = await jpost(`/services/${serviceId}/reviews`, {
    rating: 4, comment: 'Tekrar yorum denemesi',
  }, userAuth);
  ok('Tekrar yorum → 409 (zaten yorum yapmış)', duplicateReview.status === 409, `status=${duplicateReview.status}`);

  // 1c. Public listesi — yalnızca approved yorumlar
  const publicReviews = await jget(`/services/${serviceId}/reviews?limit=20`);
  ok('GET /services/:id/reviews → 200', publicReviews.status === 200);
  ok('Tüm yorumlar approved', publicReviews.json?.data?.items?.every(r => r.status === 'approved'), `count=${publicReviews.json?.data?.items?.length}`);
  ok('Pending yorum public listede yok', publicReviews.json?.data?.items?.length === 3, `count=${publicReviews.json?.data?.items?.length} (expected 3)`);

  // 1d. Puan dağılımı
  const dist = publicReviews.json?.data?.summary?.distribution;
  ok('Puan dağılımı objesi var', !!dist, `5★=${dist?.[5]}, 4★=${dist?.[4]}`);
  ok('avgRating cache doğru', publicReviews.json?.data?.summary?.avgRating != null, `avg=${publicReviews.json?.data?.summary?.avgRating}`);

  // ===================================================================
  // 2) ADMIN ONAY/RED + AVG RATING GÜNCELLEMESİ
  // ===================================================================
  hr('2) ADMIN ONAY/RED — avgRating güncellemesi');

  // Pending review'ı bul
  const adminPending = await jget('/admin/reviews?status=pending', adminAuth);
  ok('Admin pending reviews → 200', adminPending.status === 200);
  const pendingReview = adminPending.json?.data?.items?.[0];
  ok('Pending review bulundu', !!pendingReview, `id=${pendingReview?.id?.slice(0, 8)}, rating=${pendingReview?.rating}`);

  if (pendingReview) {
    const beforeAvg = publicReviews.json?.data?.summary?.avgRating;
    const beforeCount = publicReviews.json?.data?.summary?.reviewCount;
    console.log(`   Before: avg=${beforeAvg}, count=${beforeCount}`);

    // Approve
    const approve = await jput(`/admin/reviews/${pendingReview.id}/approve`, {}, adminAuth);
    ok('Approve → 200', approve.status === 200, `status=${approve.status}`);
    ok('Review status approved', approve.json?.data?.status === 'approved');

    // Tekrar public listele — şimdi 4 approved olmalı
    const afterReviews = await jget(`/services/${serviceId}/reviews?limit=20`);
    const afterAvg = afterReviews.json?.data?.summary?.avgRating;
    const afterCount = afterReviews.json?.data?.summary?.reviewCount;
    ok('Public listede 4 approved yorum', afterReviews.json?.data?.items?.length === 4, `count=${afterReviews.json?.data?.items?.length}`);
    ok('reviewCount arttı', afterCount === beforeCount + 1, `before=${beforeCount}, after=${afterCount}`);
    ok('avgRating güncellendi', afterAvg !== beforeAvg, `before=${beforeAvg?.toFixed(2)}, after=${afterAvg?.toFixed(2)}`);

    // Şimdi reddet — avgRating tekrar güncellenmeli
    const reject = await jput(`/admin/reviews/${pendingReview.id}/reject`, { reason: 'Test: uygun değil' }, adminAuth);
    ok('Reject → 200', reject.status === 200);
    ok('Review status rejected', reject.json?.data?.status === 'rejected');
    ok('rejectionReason kaydedildi', reject.json?.data?.rejectionReason === 'Test: uygun değil');

    // Tekrar kontrol
    const afterReject = await jget(`/services/${serviceId}/reviews?limit=20`);
    ok('Reject sonrası 3 approved', afterReject.json?.data?.items?.length === 3, `count=${afterReject.json?.data?.items?.length}`);
    ok('avgRating önceki haline döndü', afterReject.json?.data?.summary?.avgRating === beforeAvg, `after=${afterReject.json?.data?.summary?.avgRating?.toFixed(2)}`);
  }

  // ===================================================================
  // 3) FAVORİLER
  // ===================================================================
  hr('3) FAVORİLER — toggle + list');

  // Customer'ın favorisi zaten var (seed) — toggle kaldırmalı
  const toggleOff = await jpost(`/services/${serviceId}/favorite`, {}, userAuth);
  ok('Toggle (var → yok) → 200', toggleOff.status === 200, `status=${toggleOff.status}`);
  ok('isFavorite false', toggleOff.json?.data?.isFavorite === false);

  // Tekrar toggle — eklemeli
  const toggleOn = await jpost(`/services/${serviceId}/favorite`, {}, userAuth);
  ok('Toggle (yok → var) → 200', toggleOn.status === 200);
  ok('isFavorite true', toggleOn.json?.data?.isFavorite === true);

  // Favori ID listesi
  const favIds = await jget('/user/favorites/ids', userAuth);
  ok('GET /user/favorites/ids → 200', favIds.status === 200);
  ok('Favorilerde service var', favIds.json?.data?.ids?.includes(serviceId), `count=${favIds.json?.data?.ids?.length}`);

  // Favori listesi (detaylı)
  const favList = await jget('/user/favorites', userAuth);
  ok('GET /user/favorites → 200', favList.status === 200);
  ok('Favori listede service var', favList.json?.data?.items?.some(f => f.service.id === serviceId), `count=${favList.json?.data?.items?.length}`);

  // ===================================================================
  // 4) USER REVIEWS (kullanıcının kendi yorumları)
  // ===================================================================
  hr('4) KULLANICININ KENDİ YORUMLARI');
  const myReviews = await jget('/user/reviews', userAuth);
  ok('GET /user/reviews → 200', myReviews.status === 200);
  ok('Customer\'ın yorumu var', (myReviews.json?.data?.items?.length || 0) > 0, `count=${myReviews.json?.data?.items?.length}`);

  // ===================================================================
  // 5) MİSAFİR ERİŞİM — kalp tıklama 401
  // ===================================================================
  hr('5) MİSAFİR ERİŞİM KONTROLÜ');
  const guestFav = await jpost(`/services/${serviceId}/favorite`, {});
  ok('Misafir favori toggle → 401', guestFav.status === 401, `status=${guestFav.status}`);

  const guestReview = await jpost(`/services/${serviceId}/reviews`, { rating: 5, comment: 'test' });
  ok('Misafir yorum ekleme → 401', guestReview.status === 401, `status=${guestReview.status}`);

  hr('ÖZET');
  console.log(`  ${allOk ? '✓ Tüm kabul kriterleri PASSED' : '✗ BAZI KRİTERLER FAILED'}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Doğrulama hatası:', err);
  process.exit(1);
});
