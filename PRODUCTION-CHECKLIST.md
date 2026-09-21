# Production Checklist — Turizm Pazaryeri

Bu checklist production'a çıkmadan önce tamamlanması gereken tüm adımları içerir.
Her madde `[ ]` ile işaretlenmeli; hepsi tamamlandığında production'a çıkılabilir.

---

## 1. Güvenlik

### Kimlik Doğrulama
- [ ] **JWT secret üretildi** — en az 32 karakter, random
  - `JWT_ACCESS_SECRET` ve `JWT_REFRESH_SECRET` farklı değerler
- [ ] **JWT süreleri doğru** — access 15dk, refresh 7 gün (veya daha kısa)
- [ ] **Refresh token rotation** aktif — eski token kullanılamaz (Faz-1)
- [ ] **Bcrypt cost factor** ≥ 10 (Faz-1'de 10)
- [ ] **Password policy** — min 8 karakter, validasyon DTO'da
- [ ] **Rate limit** — login 5/dk, register 3/dk (Faz-1)
- [ ] **Forgot password** — tek kullanımlık token, 15dk TTL (Faz-1)

### Yetkilendirme (RBAC)
- [ ] **Tüm admin endpoint'leri** `@Roles(SUPER_ADMIN)` ile korumalı (Faz-2)
- [ ] **Tüm provider endpoint'leri** `@Roles(PROVIDER, SUPER_ADMIN)` (Faz-3)
- [ ] **Ownership kontrolü** — provider yalnızca kendi kaynaklarını yönetir (Faz-3)
- [ ] **User ownership** — kullanıcı yalnızca kendi rezervasyonlarını görür (Faz-5)
- [ ] **IDOR testleri** geçiyor (Faz-8 security tests)

### Güvenlik Başlıkları
- [ ] **Helmet** aktif (Faz-1) — XSS protection, clickjacking prevention, vb.
- [ ] **CORS** — yalnızca whitelisted origin'lere izin ver (`CORS_ORIGIN` env)
- [ ] **HTTPS zorunlu** — HSTS header, redirect HTTP→HTTPS
- [ ] **Cookie secure flag** — production'da `Secure` + `HttpOnly`
- [ ] **Content-Security-Policy** — script-src, img-src kısıtlı

### Input Validasyonu
- [ ] **Tüm DTO'lar** class-validator ile validasyondan geçiyor
- [ ] **Whitelist mode** — beklenmeyen alanlar reddediliyor
- [ ] **SQL injection** — Prisma parameterized queries kullanılıyor
- [ ] **XSS** — React otomatik escape + Input validasyon
- [ ] **File upload** — tip kontrolü (jpg/png/webp), boyut limiti (5MB)

### Ödeme Güvenliği
- [ ] **iyzico production API key** — sandbox'tan üretime geçiş
- [ ] **Webhook imza doğrulaması** — HMAC-SHA256 (Faz-5)
- [ ] **Webhook replay koruması** — idempotent (Faz-8 test)
- [ ] **HTTPS** — ödeme akışı yalnızca HTTPS üzerinden
- [ ] **PCI compliance** — kart bilgileri sunucumuza gitmez (iyzico iframe)

---

## 2. Veritabanı

- [ ] **PostgreSQL 15+** — SQLite'tan üretime geçiş
- [ ] **Migration'lar** — tüm faz migrate'leri deploy edildi
- [ ] **Seed çalıştırıldı** — admin + 81 il + 6 kategori + ayarlar
- [ ] **Connection pooling** — PgBouncer veya Prisma pool config
- [ ] **Backup** — günlük otomatik yedek (scripts/backup/pg-backup.sh)
- [ ] **Restore testi** — aylık restore drill yapıldı
- [ ] **Index'ler** — tüm critical query index'leri mevcut
- [ ] **Read replica** — yüksek yük için read replica (opsiyonel)

---

## 3. Uygulama

### API (NestJS)
- [ ] **Node.js 18+** — production runtime
- [ ] **Build** — `npm run build` (TypeScript → dist/)
- [ ] **PM2 veya Docker** — process manager
- [ ] **/health endpoint** — DB, memory, uptime (Faz-8)
- [ ] **/health/live** — K8s liveness probe
- [ ] **/health/ready** — K8s readiness probe
- [ ] **Graceful shutdown** — SIGTERM handler
- [ ] **Clustering** — multi-core kullanımı (PM2 cluster mode)

### Web (Next.js)
- [ ] **Build** — `npm run build` (SSG + SSR)
- [ ] **Standalone output** — Docker için optimize
- [ ] **CDN** — static asset'ler CDN'den
- [ ] **Image optimization** — next/image kullanımı
- [ ] **SEO** — sitemap.xml, robots.txt, OG tags (Faz-4)

### Mobil (Expo)
- [ ] **EAS Build** — production build alındı
- [ ] **App Store** — listing hazır, ekran görüntüleri yüklendi
- [ ] **Google Play** — listing hazır, signing key
- [ ] **CodePush** — OTA güncellemeler için (opsiyonel)
- [ ] **Push sertifikaları** — APNs (iOS) + FCM (Android)

---

## 4. Monitoring & Logging

- [ ] **Sentry** — api + web + mobil entegrasyonu (Faz-8)
  - DSN production env'de tanımlı
  - Release tracking aktif
  - Source maps upload edildi
- [ ] **Yapılandırılmış loglar** — JSON format, levels (info/warn/error)
- [ ] **Kritik olay işaretleme**:
  - [ ] Ödeme başarısız → Sentry `error` level, `feature: payment` tag
  - [ ] İade işlemi → Sentry `info` level, `feature: refund` tag
  - [ ] Webhook imza hatası → Sentry `error`, `security: signature` tag
  - [ ] IDOR denemesi → Sentry `warning`, `type: idor` tag
- [ ] **Uptime monitoring** — `/health` endpoint ping
- [ ] **Performance monitoring** — Sentry traces, p95 latency
- [ ] **Alert rules**:
  - [ ] 5xx hata oranı > 1%
  - [ ] DB connection failures
  - [ ] Cron job failure (15dk iptal, hatırlatma)
  - [ ] Disk doluluk > 80%

---

## 5. Cron Jobs

- [ ] **Pending payment cleanup** — 15dk TTL rezervasyon iptali (Faz-5)
  - Cron: `*/5 * * * *` (her 5 dakika)
  - Log: `[CRON] cleanupExpiredReservations`
- [ ] **Tour reminder** — 24 saat önce hatırlatma e-postası (Faz-5)
  - Cron: `0 * * * *` (her saat başı)
  - Log: `[CRON] sendTourReminders`
- [ ] **Daily DB backup** — gece 02:00
- [ ] **Cron monitoring** — başarısız cron için alert

---

## 6. Environment Variables

### API
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
JWT_ACCESS_SECRET=<32+ char random>
JWT_REFRESH_SECRET=<32+ char random, different from access>
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=604800
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=eu-west-1
S3_BUCKET=turizm-pazaryeri-prod
S3_ACCESS_KEY_ID=<aws-access-key>
S3_SECRET_ACCESS_KEY=<aws-secret-key>
S3_PRESIGN_EXPIRES_SECONDS=600
IYZICO_API_KEY=<production-api-key>
IYZICO_SECRET_KEY=<production-secret-key>
IYZICO_BASE_URL=https://api.iyzipay.com
SENTRY_DSN=<sentry-dsn>
CORS_ORIGIN=https://turizmpazaryeri.com
RATE_LIMIT_LOGIN_PER_MINUTE=5
RATE_LIMIT_REGISTER_PER_MINUTE=3
```

### Web
```env
NEXT_PUBLIC_SITE_URL=https://turizmpazaryeri.com
NEXT_PUBLIC_SENTRY_DSN=<sentry-dsn>
API_BASE_URL=https://api.turizmpazaryeri.com
```

### Mobil
```env
API_BASE_URL=https://api.turizmpazaryeri.com/api
SENTRY_DSN=<sentry-dsn>
```

---

## 7. Secrets Yönetimi

- [ ] **Secrets manager** — AWS Secrets Manager / Vault / Doppler
- [ ] **`.env` dosyası production'da yok** — secrets environment'dan
- [ ] **Git'te secret yok** — `.gitignore` doğru
- [ ] **Rotation** — API key'ler için rotation politikası
- [ ] **Access control** — secrets'a erişim RBAC ile kısıtlı

---

## 8. CI/CD

- [ ] **GitHub Actions** — `.github/workflows/ci.yml` (Faz-8)
  - Lint + type check + unit test
  - Security tests (IDOR, auth, rate limit)
  - E2E tests (Playwright)
  - Build production artifacts
- [ ] **Deploy workflow** — `.github/workflows/deploy.yml`
  - Staging: `staging` branch push
  - Production: `main` branch + manual approval
- [ ] **Branch protection** — PR review zorunlu, status check geçmesi gerek
- [ ] **Secrets** — GitHub Secrets'ta tanımlı (DATABASE_URL, SSH_PRIVATE_KEY vb.)
- [ ] **Docker images** — GHCR'de tag'li (sha + staging/production)

---

## 9. Testing

- [ ] **Unit tests** — critical service metodları
- [ ] **Integration tests** — API endpoint'leri
- [ ] **E2E tests** — Playwright (Faz-8)
  - [ ] Auth akışı (kayıt → giriş → me)
  - [ ] Provider akışı (hizmet oluştur → onay → yayın)
  - [ ] Purchase akışı (bul → satın al → iptal → iade)
- [ ] **Security tests** — Faz-8 security suite
  - [ ] Admin endpoint 403 (user token)
  - [ ] IDOR / ownership
  - [ ] Webhook imza + replay
  - [ ] Upload bypass
  - [ ] Rate limit
  - [ ] SQL injection / XSS
- [ ] **Load tests** — k6 veya Artillery (önerilir)
- [ ] **Smoke tests** — post-deploy

---

## 10. Ortamlar

### Staging
- [ ] URL: `https://staging.turizmpazaryeri.com`
- [ ] DB: staging PostgreSQL
- [ ] iyzico: sandbox
- [ ] Sentry: staging environment
- [ ] Cron jobs aktif
- [ ] Daily backup aktif

### Production
- [ ] URL: `https://turizmpazaryeri.com`
- [ ] DB: production PostgreSQL + read replica (opsiyonel)
- [ ] iyzico: production
- [ ] Sentry: production environment
- [ ] Cron jobs aktif + monitoring
- [ ] Daily backup aktif + S3'e upload
- [ ] SSL sertifikası (Let's Encrypt / AWS ACM)
- [ ] CDN (CloudFlare / CloudFront)

---

## 11. Admin 2FA (Önerilir)

Süper admin hesapları için 2FA (Time-based One-Time Password) önerilir:
- [ ] TOTP entegrasyonu (Google Authenticator / Authy)
- [ ] Backup kodları
- [ ] 2FA zorunlu — super_admin rolü için
- [ ] Recovery akışı

**Not**: Faz-8'de implement edilmedi, v1.1 için planlanıyor.

---

## 12. Compliance

- [ ] **KVKK** — Türk kişisel veriler kanunu uyumu
  - [ ] Gizlilik politikası yayınlandı
  - [ ] Kullanıcı sözleşmesi
  - [ ] Veri silme talebi akışı (right to be forgotten)
  - [ ] Aydınlatma metni
- [ ] **PCI DSS** — yalnızca iyzico ile uyumlu (kart bilgileri bizde yok)
- [ ] **Cookie policy** — EU GDPR uyumu
- [ ] **İade politikası** — açıkça yazıldı, kullanıcı erişebilir

---

## 13. Pre-Launch Son Kontrol

- [ ] **Smoke test** — uçtan uca satın alma akışı staging'de çalışıyor
- [ ] **DNS** — production domain'i API'ye yönlendi
- [ ] **SSL** — sertifika geçerli
- [ ] **Backup** — production DB yedeği alındı
- [ ] **Rollback planı** — sorun çıkarsa nasıl geri dönülecek
- [ ] **Team notification** — tüm takım launch saati bilgilendirildi
- [ ] **Support hazır** — müşteri hizmetleri launch'a hazır
- [ ] **Monitoring aktif** — Sentry + uptime alerts çalışıyor

---

## 14. Post-Launch

- [ ] **İlk 24 saat monitoring** — error rate, latency, DB load
- [ ] **Sentry alert'ları** kontrol edildi
- [ ] **Cron log'ları** kontrol edildi
- [ ] **Backup doğrulandı** — ilk gece yedeği alındı
- [ ] **Kullanıcı feedback** toplandı (ilk 1 hafta)
- [ ] **Performance baseline** ölçüldü (p95 latency)

---

## İmza

- [ ] **Lead Developer** — _________________ Tarih: ________
- [ ] **DevOps** — _________________ Tarih: ________
- [ ] **Product Manager** — _________________ Tarih: ________

---

Bu checklist tamamlandığında production'a güvenli çıkış yapılabilir.
Herhangi bir madde açık bırakılırsa, risk değerlendirmesi yapılmalı ve yönetim onayı alınmalıdır.
