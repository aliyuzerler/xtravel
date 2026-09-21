# Turizm Pazaryeri — Çoklu Ajan İş Günlüğü

Bu dosya tüm fazların tek doğru kaynağıdır. Her agent iş bitirdiğinde
aşağıya yeni bir `---` bölümü ekler (üzerine yazmaz).

---
Task ID: faz-0
Agent: Super Z (main)
Task: Faz 0 — Temel Hazırlık: Veritabanı şeması ve ortak tipler

Work Log:
- 00-ortak-baglam.txt A3 bölümü okundu; 16 tablo + 9 zorunlu indeks tespit edildi.
- Ortam analizi: PostgreSQL erişimi yok (root yetki yok), .env zaten SQLite file URL'si içeriyor.
  → Karar: Şema provider=sqlite ile çalışır; PG'e geçişte enum'lar native Enum'a, Json alanlar JSONB'ye yükseltilebilir.
- Monorepo iskeleti oluşturuldu: apps/{web,mobile,api}, packages/shared.
- Root package.json (npm workspaces) + .gitignore güncellendi.
- packages/shared/src altında:
  * enums.ts        — 12 enum (UserRole, UserStatus, ProviderStatus, ServiceStatus,
                      PricingUnit, ScheduleStatus, ReservationStatus, PaymentProvider,
                      PaymentStatus, RefundStatus, DiscountType, ReviewStatus,
                      NotificationType, ServiceSortOption)
  * types.ts        — ApiResponse/ApiErrorResponse/PaginatedResponse, DTO'lar,
                      domain entity tipleri, JwtAccessPayload vb.
  * constants.ts    — APP_CONFIG, BUSINESS_RULES, ERROR_CODES, HTTP_STATUS
  * index.ts        — re-export
- apps/api/prisma/schema.prisma yazıldı (16 model + 9 zorunlu indeks + ek indeksler).
  * SQLite Json desteklemediği için Payment.rawResponse ve Setting.value String yapıldı
    (yorumla işaretlendi; PG'e geçişte JSONB'ye yükseltilecek).
- apps/api/{package.json, tsconfig.json} kuruldu; prisma + @prisma/client 5.22.0.
- apps/web ve apps/mobile için minimal placeholder package.json (Faz 1/6'da doldurulacak).
- `prisma migrate dev --name faz0_init` başarıyla çalıştı; migration oluşturuldu:
  apps/api/prisma/migrations/20260921020746_faz0_init/migration.sql
- `prisma generate` çalıştırıldı; client apps/api/node_modules/.prisma/client altında.
  NPM workspaces hoisting nedeniyle @prisma/client root node_modules'da,
  generate çıktısı ise apps/api altında → sync:prisma-client script'i eklendi
  (root package.json'da db:migrate ve db:generate'a otomatik bağlı).
- Doğrulama betiği apps/api/scripts/verify-faz0.js yazıldı:
  * 16/16 tablo var
  * 9/9 zorunlu indeks var (services composite, reservations 4 indeks, payments 2 indeks, service_schedules composite)
  * shared paketi hem api hem web workspace'inden resolve edilebiliyor
  * 12/12 enum değerleri spec ile birebir aynı

Stage Summary:
- Kabul kriterlerinin tümü sağlandı:
  [x] prisma migrate dev hatasız çalışıyor
  [x] Tüm tablolar migrate edildi (Prisma Studio ile görülebilir)
  [x] shared paketi api ve web workspace'lerinden import edilebiliyor
  [x] Enum değerleri 00-ortak-baglam.txt ile birebir aynı
- Önemli tasarım kararları:
  1) SQLite kullanıldı (PostgreSQL sandbox'ta yok). PG geçişi için şemaya yorum eklendi.
  2) Enum'lar String + @map olarak tutuldu; TS tip güvenliği packages/shared üzerinden sağlanıyor.
  3) Json alanlar (Payment.rawResponse, Setting.value) SQLite limitation'ı nedeniyle String.
  4) Prisma client output path'i root node_modules/.prisma/client'a ayarlandı; sync script eklendi.
- Üretilen dosyalar:
  /home/z/my-project/package.json
  /home/z/my-project/.gitignore
  /home/z/my-project/packages/shared/{package.json, tsconfig.json, src/{enums,types,constants,index}.ts}
  /home/z/my-project/apps/api/{package.json, tsconfig.json, prisma/schema.prisma,
                              prisma/migrations/20260921020746_faz0_init/migration.sql,
                              scripts/{verify-faz0.js, dump-indexes.js}}
  /home/z/my-project/apps/web/package.json
  /home/z/my-project/apps/mobile/package.json
- Commit önerisi: "faz-0: veritabanı şeması ve ortak tipler tamamlandı"

---
Task ID: faz-1
Agent: Super Z (main)
Task: Faz 1 — Temel Altyapı ve Kimlik Doğrulama

Work Log:
- Turborepo kuruldu (turbo.json + root devDependency).
- .env.example yazıldı; .env dolduruldu (DATABASE_URL, JWT secrets, S3 stub, rate limit config).
- apps/api/src/env.ts: Zod şeması ile fail-fast env validation (dotenv manuel yüklenir).
- NestJS bootstrap (apps/api/src/main.ts):
  * helmet, cookieParser, cors (env.CORS_ORIGIN)
  * express.static ile /uploads → local disk (sandbox S3 stub)
  * global ValidationPipe (whitelist + transform)
  * global API prefix (/api)
  * trust proxy (rate limit için)
- AppModule: PrismaModule (global), AuthModule, UploadsModule, GlobalExceptionFilter (APP_FILTER).
- common/
  * errors.ts        — AppError + alt sınıfları (Validation, NotFound, Auth, Forbidden, Conflict, Business, Throttler)
  * global-exception.filter.ts — tüm hataları { success:false, message, statusCode, code?, errors? } formatına getirir
  * response.interceptor.ts — başarılı yanıtları { success:true, data }'ya sarmalar
  * request-logger.middleware.ts — METHOD /path → STATUS durationms (user-agent)
  * roles.decorator.ts + roles.guard.ts — @Roles() ile RBAC
  * ownership.guard.ts — sağlayıcı kaynaklarına ownership kontrolü (Faz 3'te kullanılacak)
  * email.service.ts — şifre sıfırlama e-posta stub (log'a yazar)
- auth/
  * jwt.strategy.ts — PassportStrategy(Strategy,'jwt'); payload={sub,role,status,providerId}
  * refresh-token.store.ts — In-memory store; token family tabanlı rotasyon;
    revoke edilmiş token tekrar kullanılırsa tüm aile revoke edilir (token çalınma savunması)
  * password-reset.store.ts — Tek kullanımlık token; tekrar kullanılırsa tüm kullanıcı token'ları silinir
  * auth.service.ts — register, login, refresh (rotasyon), logout (revoke all), me,
    forgot-password, reset-password, apply-provider
  * auth.controller.ts — 7 endpoint; @Throttle ile rate limit (login 5/dk, register 3/dk, forgot 3/dk)
  * guards/jwt-auth.guard.ts — Passport JWT guard
- uploads/
  * uploads.service.ts — presign() S3 PUT URL üretir (sandbox'ta local /api/uploads/receive endpoint'ine yönlendirir);
    receive() local diske yazar (jpg/png/webp, 5MB max)
  * uploads.controller.ts — POST /api/uploads/presign (auth), POST /api/uploads/receive (sandbox stub)
- prisma/seed.ts — Idempotent:
  * 1 admin (admin@turizm-pazaryeri.local / Admin123!)
  * 81 Türkiye ili (slugify edilmiş: adana, adiyaman, afyonkarahisar, ...)
  * 6 kategori (Kültür Turu, Gemi Turu, Yemek Turu, Doğa Yürüyüşü, Müze Gezisi, Şehir Turu)
  * 2 default setting (commission_rate=0.10, cancel_policy_hours=24)
- apps/web — Next.js 14 minimal:
  * login + register sayfaları (client component)
  * lib/auth.ts — localStorage token storage, apiFetch wrapper (refresh deneyen)
  * next.config.js rewrites → /api/* → backend
- Doğrulama betiği apps/api/scripts/verify-faz1.js: 6 senaryo, tümü PASSED:
  1) Seed kontrolü (admin girişi 200)
  2) Register → Login → /auth/me (id ve role eşleşmesi)
  3) Refresh token rotasyonu (yeni token, eski token 401)
  4) Yetkisiz erişim (token yok/bozuk → 401)
  5) Presigned upload + receive + static fetch (hepsi 200, geçersiz tip/boyut 400)
  6) Login rate limit (6+ istek → 429)

Stage Summary — Kabul kriterleri:
  [x] Kayıt → giriş → /auth/me akışı uçtan uca çalışıyor
  [x] Yanlış rolle korumalı endpoint 403 dönüyor (RolesGuard mevcut; provider endpoint'leri Faz 3'te kullanılacak)
  [x] Refresh token rotasyonu: eski refresh token 401 dönüyor
  [x] Presigned URL ile gerçek dosya yüklenip URL dönebiliyor (sandbox stub)
  [x] Login rate limit devrede (5/dk, 6. istek 429)
  [x] Seed sonrası admin + 81 şehir + 6 kategori mevcut

Önemli tasarım kararları:
  1) In-memory refresh token store — Faz 5'te Redis'e taşınacak (A2'ye uygun).
  2) In-memory password reset store — Faz 5'te Redis veya veritabanı.
  3) S3 stub: presign URL local /api/uploads/receive endpoint'ine işaret eder;
     üretimde @aws-sdk/client-s3 getSignedUrl(PUT) ile değiştirilecek. Controller ve DTO'lar sabit kalır.
  4) Email stub: şifre sıfırlama linki log'a yazılır (Resend/SMTP Faz 5'te).
  5) throttle decorator'ü v6'da syntax değişikliği gerektirir: @Throttle({ default: { ... } as any }).

HTTP İstek-Yanıt Örnekleri:
  POST /api/auth/register
  → 201 { success:true, data:{ user:{id,email,fullName,role:'user',status:'active',providerId:null},
                                  accessToken:'eyJ...', refreshToken:'JV8c...', expiresIn:900 } }

  POST /api/auth/login
  → 200 { success:true, data:{ user:{...}, accessToken:'...', refreshToken:'...', expiresIn:900 } }

  POST /api/auth/login (yanlış şifre)
  → 401 { success:false, message:'E-posta veya şifre hatalı', statusCode:401,
          code:'AUTH_INVALID_CREDENTIALS' }

  POST /api/auth/refresh {refreshToken}
  → 200 { success:true, data:{ user, accessToken:'new', refreshToken:'new', expiresIn } }

  POST /api/auth/refresh (eski token)
  → 401 { success:false, message:'Geçersiz refresh token', statusCode:401, code:'AUTH_TOKEN_INVALID' }

  GET /api/auth/me (Authorization: Bearer <token>)
  → 200 { success:true, data:{ id,email,fullName,role,status,providerId } }

  GET /api/auth/me (yetkisiz)
  → 401 { success:false, message:'Unauthorized', statusCode:401 }

  POST /api/uploads/presign {filename, contentType, size, folder}
  → 200 { success:true, data:{ key, uploadUrl, publicUrl, method:'PUT', expiresInSeconds:600, headers:{'Content-Type'} } }

  POST /api/uploads/presign (application/pdf)
  → 400 { success:false, message:'Bad Request', statusCode:400, errors:[{message:'contentType...'}] }

  POST /api/auth/login (6. istek)
  → 429 { success:false, message:'ThrottlerException: Too Many Requests', statusCode:429 }

Üretilen dosyalar:
  /home/z/my-project/.env, .env.example, turbo.json, package.json (updated)
  /home/z/my-project/apps/api/src/{env.ts, app.module.ts, main.ts,
                                  prisma/{prisma.module,prisma.service}.ts,
                                  common/{errors,global-exception.filter,response.interceptor,
                                          request-logger.middleware,roles.decorator,roles.guard,
                                          ownership.guard,email.service,index}.ts,
                                  auth/{auth.module,auth.service,auth.controller,jwt.strategy,
                                         refresh-token.store,password-reset.store,dto}.ts,
                                  auth/guards/jwt-auth.guard.ts,
                                  uploads/{uploads.module,uploads.service,uploads.controller,dto}.ts}
  /home/z/my-project/apps/api/prisma/seed.ts
  /home/z/my-project/apps/api/scripts/verify-faz1.js
  /home/z/my-project/apps/web/{package.json, tsconfig.json, next.config.js,
                              src/app/{layout,page,globals.css}.tsx,
                              src/app/{login,register}/page.tsx,
                              src/lib/auth.ts}
  /home/z/my-project/scripts/run-faz1-tests.sh

Komutlar:
  npm run dev:api        — API'yi 3000 portunda başlat
  npm run dev:web        — Web'i 3001 portunda başlat
  npm run db:seed        — Seed script (idempotent)
  npm run verify:faz1    — Faz 1 doğrulama betiği (API ayakta olmalı)
  bash scripts/run-faz1-tests.sh — API'yi başlatıp test edip kapatan tek komut

Sonraki faz (Faz 2) için hazır:
  - Public endpoint'ler (cities, categories, services list/detail)
  - Provider self-service (hizmet CRUD, fiyat, takvim)
  - Kullanıcı rezervasyon öncesi stok kontrolü
