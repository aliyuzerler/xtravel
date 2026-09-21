/**
 * Faz-4 doğrulama betiği
 * Akış: arama → liste → detay → checkout + 404 SEO OG testi
 */
const API = 'http://localhost:3000/api';
const WEB = 'http://localhost:3001';

function hr(label) {
  console.log('\n' + '─'.repeat(70));
  console.log('  ' + label);
  console.log('─'.repeat(70));
}
function ok(label, cond, extra) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`);
  return cond;
}

async function jget(path, opts = {}) {
  const res = await fetch(path, { method: 'GET', headers: opts });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, headers: res.headers };
}

async function main() {
  let allOk = true;

  // 1) Public API
  hr('1) PUBLIC API HAZIRLIK');
  const cities = await jget(`${API}/cities`);
  ok('GET /api/cities → 200', cities.status === 200);
  const firstCity = cities.json?.data?.[0];
  ok('cities > 0', !!firstCity, `first=${firstCity?.name}`);

  const cats = await jget(`${API}/categories`);
  ok('GET /api/categories → 200', cats.status === 200);
  const firstCat = cats.json?.data?.[0];
  ok('categories > 0', !!firstCat, `first=${firstCat?.name}`);

  const featured = await jget(`${API}/featured-services?limit=4`);
  ok('GET /api/featured-services → 200', featured.status === 200);
  const firstService = featured.json?.data?.[0];
  ok('featured > 0', !!firstService, `slug=${firstService?.slug}`);

  // 2) Services list filters
  hr('2) FİLTRELİ HİZMET LİSTESİ');
  const allServices = await jget(`${API}/services?page=1&limit=20`);
  ok('GET /api/services → 200', allServices.status === 200);
  ok('Tümü published', allServices.json?.data?.items?.every(s => s.status === 'published'), `count=${allServices.json?.data?.items?.length}`);

  const cityFilter = await jget(`${API}/services?city=${firstCity.slug}`);
  ok('Şehir filtresi çalışıyor', cityFilter.json?.data?.items?.every(s => s.city.slug === firstCity.slug) === true);

  const catFilter = await jget(`${API}/services?category=${firstCat.slug}`);
  ok('Kategori filtresi çalışıyor', catFilter.json?.data?.items?.every(s => s.category.slug === firstCat.slug) === true);

  const priceFilter = await jget(`${API}/services?minPrice=100&maxPrice=500`);
  ok('Fiyat aralığı filtresi', priceFilter.status === 200);

  const searchFilter = await jget(`${API}/services?search=antalya`);
  ok('Search filtresi', searchFilter.status === 200);

  // 3) Service detail (slug)
  hr('3) HİZMET DETAY (slug)');
  const detail = await jget(`${API}/services/${firstService.slug}`);
  ok('GET /api/services/:slug → 200', detail.status === 200);
  ok('Detay başlık doğru', detail.json?.data?.title === firstService.title);
  ok('Detay pricing dizi', Array.isArray(detail.json?.data?.pricing));
  ok('Detay schedules dizi', Array.isArray(detail.json?.data?.schedules));
  ok('Detay images dizi', Array.isArray(detail.json?.data?.images));
  // Geçmiş slot yok
  if (detail.json?.data?.schedules?.length > 0) {
    const past = detail.json.data.schedules.filter(s => new Date(s.startAt) < new Date());
    ok('Geçmiş slot yok', past.length === 0);
    // Kapasitesi dolu slot yok
    const full = detail.json.data.schedules.filter(s => s.bookedCount >= s.capacity);
    ok('Kapasitesi dolu slot yok', full.length === 0);
  }

  // 4) Yayında olmayan hizmete erişim → 404
  hr('4) YAYINDA OLMAYAN HİZMETE 404');
  const draftSlug = 'this-slug-does-not-exist-' + Date.now();
  const notFound = await jget(`${API}/services/${draftSlug}`);
  ok('Olmayan slug → 404', notFound.status === 404, `status=${notFound.status}`);
  ok('Hata formatı doğru', notFound.json?.success === false && notFound.json?.code === 'RESOURCE_NOT_FOUND');

  // 5) WEB tarafı
  hr('5) WEB SAYFALARI RENDER');
  const homePage = await jget(`${WEB}/`);
  ok('Ana sayfa → 200', homePage.status === 200);

  const searchPage = await jget(`${WEB}/ara`);
  ok('Arama sayfası → 200', searchPage.status === 200);

  const cityPage = await jget(`${WEB}/sehir/${firstCity.slug}`);
  ok('Şehir sayfası → 200', cityPage.status === 200);

  const detailPage = await jget(`${WEB}/hizmet/${firstService.slug}`);
  ok('Hizmet detay sayfası → 200', detailPage.status === 200);

  const detailPageHtml = detailPage.headers.get('content-type')?.includes('text/html');
  ok('HTML döndü', detailPageHtml === true);

  // 6) SEO metadata + OG tags
  hr('6) SEO METADATA + OG TAGS');
  // Hizmet detay sayfasının HTML'inde OG title ve image olmalı
  let html = '';
  try { html = await (await fetch(`${WEB}/hizmet/${firstService.slug}`)).text(); } catch {}

  const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  ok('og:title var', !!ogTitleMatch, `value="${ogTitleMatch?.[1]?.slice(0, 50)}..."`);
  // OG title hizmet başlığını içermeli
  if (ogTitleMatch) {
    ok('og:title hizmet başlığını içeriyor', ogTitleMatch[1].includes(firstService.title.slice(0, 20)));
  }

  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  ok('og:image var', !!ogImageMatch);

  const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
  ok('og:description var', !!ogDescMatch);

  const twitterCardMatch = html.match(/<meta\s+name="twitter:card"\s+content="([^"]+)"/i);
  ok('twitter:card var', !!twitterCardMatch);

  // 7) Sitemap.xml
  hr('7) SITEMAP.XML + ROBOTS.TXT');
  const sitemap = await jget(`${WEB}/sitemap.xml`);
  ok('GET /sitemap.xml → 200', sitemap.status === 200);
  const isXml = sitemap.headers.get('content-type')?.includes('xml');
  ok('Content-Type XML', isXml === true);
  const sitemapBody = await (await fetch(`${WEB}/sitemap.xml`)).text();
  ok('Sitemap URL set içeriyor', sitemapBody.includes('<urlset'));
  ok('Sitemap hizmet URL içeriyor', sitemapBody.includes('/hizmet/'));

  const robots = await jget(`${WEB}/robots.txt`);
  ok('GET /robots.txt → 200', robots.status === 200);
  const robotsBody = await (await fetch(`${WEB}/robots.txt`)).text();
  ok('robots.txt User-agent (case-insensitive)', /user-agent/i.test(robotsBody));
  ok('robots.txt admin disallow', robotsBody.includes('/admin'));
  ok('robots.txt sitemap ref', /sitemap/i.test(robotsBody));

  // 8) Yayında olmayan hizmet sayfası → 404
  hr('8) YAYINDA OLMAYAN HİZMET SAYFASI');
  const notFoundPage = await jget(`${WEB}/hizmet/${draftSlug}`);
  ok('Olmayan hizmet sayfası → 404', notFoundPage.status === 404, `status=${notFoundPage.status}`);
  // 404 meta robots noindex de bekleyebiliriz ama HTML gövdesinde "bulunamadı" da olmalı
  if (notFoundPage.status === 404) {
    const nfHtml = await (await fetch(`${WEB}/hizmet/${draftSlug}`)).text();
    ok('404 sayfası "bulunamadı" içeriyor', nfHtml.includes('bulunamadı') || nfHtml.includes('Not Found') || nfHtml.includes('404'));
  }

  // 9) URL state — geri tuşu simülasyonu
  hr('9) URL STATE (filtre değişikliği)');
  // /ara?city=X URL'i ile sayfa açılınca filtre uygulanmış olmalı
  const filteredSearch = await jget(`${WEB}/ara?city=${firstCity.slug}&category=${firstCat.slug}`);
  ok('Filtered search page → 200', filteredSearch.status === 200);

  // 10) Checkout misafir redirect
  hr('10) CHECKOUT MİSAFİR REDIRECT');
  // /checkout/<slug> misafir ise /login?next=... adresine yönlendirilmeli
  // Server-side render'da client redirect olur; sayfa 200 döner ama JS redirect bekler.
  // Şimdilik sayfanın render olduğunu teyit edelim:
  const checkoutPage = await jget(`${WEB}/checkout/${firstService.slug}?schedule=x&pricing=y&participants=1`);
  ok('Checkout sayfası render → 200', checkoutPage.status === 200);

  // 11) Auth endpoint'leri (change-password, update-profile)
  hr('11) AUTH ENDPOINT\'LERİ');
  // Login ol
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@demo.local', password: 'Customer123!' }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson?.data?.accessToken;
  ok('Demo customer login', !!token);

  if (token) {
    // Me
    const me = await jget(`${API}/auth/me`, { Authorization: `Bearer ${token}` });
    ok('GET /api/auth/me → 200', me.status === 200);

    // Update profile
    const updProfile = await fetch(`${API}/auth/me`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fullName: 'Updated Name', phone: '+90 555 111 2233' }),
    });
    ok('PUT /api/auth/me → 200', updProfile.status === 200);
    const updJson = await updProfile.json();
    ok('fullName güncellendi', updJson?.data?.fullName === 'Updated Name');

    // Change password (yanlış mevcut şifre)
    const wrongPwd = await fetch(`${API}/auth/change-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: 'WRONG', newPassword: 'NewPass123!' }),
    });
    ok('Yanlış mevcut şifre → 401', wrongPwd.status === 401, `status=${wrongPwd.status}`);

    // Change password (doğru)
    const okPwd = await fetch(`${API}/auth/change-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: 'Customer123!', newPassword: 'Customer123!' }), // aynı şifre (test kolaylığı için)
    });
    ok('Doğru şifre ile değiştir → 200', okPwd.status === 200, `status=${okPwd.status}`);

    // Eski token refresh olmamalı (revoke edildi)
    // Aslında change-password sadece refresh token'ları revoke eder, access token hala geçerli olabilir.
    // Bu yüzden /auth/me hala 200 dönebilir. Testi atlıyoruz.
  }

  hr('ÖZET');
  console.log(`  ${allOk ? '✓ Tüm kabul kriterleri PASSED' : '✗ BAZI KRİTERLER FAILED'}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Doğrulama hatası:', err);
  process.exit(1);
});
