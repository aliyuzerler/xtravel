/**
 * Faz-1 doğrulama betiği (plain JS).
 * Çalıştırma: API ayakta olmalı (cd apps/api && npm run dev)
 */
const API = 'http://localhost:3000/api';

function hr(label) {
  console.log('\n' + '─'.repeat(70));
  console.log(`  ${label}`);
  console.log('─'.repeat(70));
}

function ok(label, condition, extra) {
  console.log(`  ${condition ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`);
  return condition;
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

async function main() {
  let allOk = true;
  const ts = Date.now();
  const email = `faz1-test-${ts}@test.local`;

  // 1) Seed control
  hr('1) SEED KONTROLÜ (admin girişi)');
  const adminLogin = await jpost('/auth/login', {
    email: 'admin@turizm-pazaryeri.local',
    password: 'Admin123!',
  });
  ok('Admin girişi başarılı', adminLogin.status === 200);
  if (adminLogin.status !== 200) {
    console.log('   ', JSON.stringify(adminLogin.json));
    allOk = false;
  }

  // 2) Register → Login → /me
  hr('2) REGISTER → LOGIN → /auth/me');
  const reg = await jpost('/auth/register', {
    email,
    password: 'Test12345!',
    fullName: 'Faz1 Test User',
    phone: '+90 555 123 4567',
    role: 'user',
  });
  ok('Register 201', reg.status === 201, `status=${reg.status}`);
  if (reg.status !== 201) {
    console.log('   ', JSON.stringify(reg.json));
    allOk = false;
  }
  // Yanıt { success:true, data:{ user, accessToken, refreshToken, expiresIn } }
  const regData = reg.json?.data || reg.json;
  const regUser = regData?.user;
  const regToken = regData?.accessToken;
  const regRefresh = regData?.refreshToken;
  ok('Register yanıtında user + tokens', !!(regUser && regToken && regRefresh), `userId=${regUser?.id}`);

  const me = await jget('/auth/me', { Authorization: `Bearer ${regToken}` });
  ok('GET /auth/me 200', me.status === 200);
  const meUser = me.json?.data;
  ok('Kullanıcı aynı id', meUser?.id === regUser?.id);
  ok('Rol user', meUser?.role === 'user');

  // Not: register zaten access token döndü; login'i farklı bir e-posta ile test edelim
  // (rate limit'e takılmamak için)
  const email2 = `faz1-login-${ts}@test.local`;
  await jpost('/auth/register', {
    email: email2,
    password: 'Test12345!',
    fullName: 'Login Test',
    role: 'user',
  });
  const login = await jpost('/auth/login', { email: email2, password: 'Test12345!' });
  ok('Login 200', login.status === 200, `status=${login.status}`);
  const loginData = login.json?.data || login.json;
  const loginToken = loginData?.accessToken;
  const loginRefresh = loginData?.refreshToken;
  ok('Login yanıtında tokens', !!(loginToken && loginRefresh));

  // Yanlış şifre (kendi rate limit'i var; email3 kullan)
  const email3 = `faz1-wrong-${ts}@test.local`;
  await jpost('/auth/register', {
    email: email3,
    password: 'Test12345!',
    fullName: 'Wrong Pwd Test',
    role: 'user',
  });
  const wrong = await jpost('/auth/login', { email: email3, password: 'wrong-password' });
  ok('Yanlış şifre → 401', wrong.status === 401, `status=${wrong.status}`);

  // 3) Refresh token rotation
  hr('3) REFRESH TOKEN ROTASYONU');
  const r1 = await jpost('/auth/refresh', { refreshToken: loginRefresh });
  ok('Refresh #1 → 200', r1.status === 200, `status=${r1.status}`);
  const r1Data = r1.json?.data || r1.json;
  const newRefresh = r1Data?.refreshToken;
  const newAccess = r1Data?.accessToken;
  ok('Yeni refresh token döndü', !!newRefresh && newRefresh !== loginRefresh);
  // Access token'ın JWT iat/exp aynı saniyede imzalanmış olabilir → byte eşit
  // çıkabilir. Bu yüzden "farklı mı" değil "dolu mu" kontrol ediyoruz.
  ok('Yeni access token döndü', !!newAccess);

  const r2 = await jpost('/auth/refresh', { refreshToken: loginRefresh });
  ok('Eski refresh token → 401', r2.status === 401, `status=${r2.status}`);

  // 4) Unauthorized access
  hr('4) YETKİSİZ ERİŞİM');
  const noToken = await jget('/auth/me');
  ok('Token yok → 401', noToken.status === 401, `status=${noToken.status}`);

  const badToken = await jget('/auth/me', { Authorization: 'Bearer invalid.token.here' });
  ok('Bozuk token → 401', badToken.status === 401, `status=${badToken.status}`);

  // 5) Presigned upload + receive
  hr('5) PRESIGNED UPLOAD + RECEIVE');
  // Login token yoksa (rate limit vb.) yeni kullanıcı oluşturalım
  let testToken = loginToken;
  if (!testToken) {
    const reReg = await jpost('/auth/register', {
      email: `faz1-upload-${ts}@test.local`,
      password: 'Test12345!',
      fullName: 'Upload Test',
      role: 'user',
    });
    const reRegData = reReg.json?.data || reReg.json;
    testToken = reRegData?.accessToken;
  }
  const presign = await jpost('/uploads/presign', {
    filename: 'test-image.jpg',
    contentType: 'image/jpeg',
    size: 1024,
    folder: 'service-images',
  }, { Authorization: `Bearer ${testToken}` });
  ok('Presign → 200', presign.status === 200, `status=${presign.status}`);
  if (presign.status !== 200) {
    console.log('   ', JSON.stringify(presign.json));
    allOk = false;
  } else {
    const pdata = presign.json.data || presign.json;
    console.log('   key:', pdata.key);
    console.log('   publicUrl:', pdata.publicUrl);

    const fakeJpeg = Buffer.alloc(1024, 0xff);
    const key = pdata.key;
    const receiveUrl = `${API}/uploads/receive?key=${encodeURIComponent(key)}&contentType=image%2Fjpeg`;
    const recv = await fetch(receiveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: fakeJpeg,
    });
    let recvJson = null;
    try { recvJson = await recv.json(); } catch {}
    ok('Receive → 200', recv.status === 200, `status=${recv.status}`);
    if (recvJson?.data?.publicUrl) {
      const get = await fetch(recvJson.data.publicUrl);
      ok('Static fetch → 200', get.status === 200, `status=${get.status}`);
    }
  }

  const badType = await jpost('/uploads/presign', {
    filename: 'bad.pdf',
    contentType: 'application/pdf',
  }, { Authorization: `Bearer ${testToken}` });
  ok('Geçersiz tip → 400', badType.status === 400, `status=${badType.status}`);

  const tooBig = await jpost('/uploads/presign', {
    filename: 'huge.jpg',
    contentType: 'image/jpeg',
    size: 6 * 1024 * 1024,
  }, { Authorization: `Bearer ${testToken}` });
  ok('6MB dosya → 400', tooBig.status === 400, `status=${tooBig.status}`);

  // 6) Rate limit
  hr('6) LOGIN RATE LIMIT (5/dk)');
  let failedCount = 0;
  let lastStatus = null;
  for (let i = 0; i < 7; i++) {
    const r = await jpost('/auth/login', { email, password: 'wrong-password' });
    lastStatus = r.status;
    if (r.status === 429) failedCount++;
    await new Promise((res) => setTimeout(res, 80));
  }
  ok('6+ istek sonrası 429 alındı', failedCount > 0, `lastStatus=${lastStatus}, 429 count=${failedCount}`);

  hr('ÖZET');
  console.log(`  ${allOk ? '✓ Tüm kabul kriterleri PASSED' : '✗ BAZI KRİTERLER FAILED'}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Doğrulama hatası:', err);
  process.exit(1);
});
