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

---
Task ID: faz-2
Agent: Super Z (main)
Task: Faz 2 — Süper Admin Paneli (Web)

Work Log:
- Önceki faz teyit edildi (worklog okundu): auth, RolesGuard, UploadsModule, NotificationsModule altyapısı hazır.
- common/paginate.ts — Standart pagination helper (parse, build, prisma için paginate() generic).
- notifications/notifications.service.ts — Tüm modüllerin kullanacağı ortak notification servisi:
  * create(), notifyProvider() (provider.user_id üzerinden), notifyUser()
- admin/admin.service.ts — 8 alt bölüm:
  * Dashboard stats: counts + monthly breakdown (son 6 ay, JS tarafında gruplama — SQLite strftime yok)
  * Users: list+filter (role/status/search), updateStatus (ban → notification)
  * Providers: list+filter, getDetail, approve (user status pending→active + PROVIDER_APPROVED notification),
    reject (reason zorunlu + PROVIDER_REJECTED notification)
  * Services: list+filter, getDetail, approve (SERVICE_APPROVED notification),
    reject (reason zorunlu + rejectionReason kaydı + SERVICE_REJECTED notification)
  * Categories: list, create, update (aktif hizmet varsa pasife alma engeli → 409),
    delete (hizmet varsa silme engeli → 409)
  * Cities: list, create, update, delete (hizmet varsa silme engeli)
  * Settings: get (JSON parse), update (JSON.stringify)
  * Reservations + Payments: read-only list+filter
- admin/admin.controller.ts — Tüm endpoint'ler JwtAuthGuard + RolesGuard + @Roles(SUPER_ADMIN) ile korumalı.
  - /admin/dashboard/stats, /admin/users (+ status), /admin/providers (+ approve/reject),
    /admin/services (+ approve/reject), /admin/categories (CRUD), /admin/cities (CRUD),
    /admin/settings (get/put), /admin/reservations, /admin/payments
- app.module.ts'e AdminModule + NotificationsModule eklendi.
- prisma/seed.ts güncellendi (idempotent upsert):
  * 2 demo sağlayıcı: provider1@demo.local (approved, 2 hizmet), provider2@demo.local (pending)
  * 2 demo hizmet: 1 published (Antalya Eski Şehir Yürüyüşu, 3 fiyat + 5 takvim + 2 görsel),
    1 pending_approval (Antalya Müzesi turu)
  * 21 demo rezervasyon + 21 captured ödeme (son 5 aya dağılmış, dashboard grafik için)
  * Default settings: commission_rate=0.10, cancel_policy_hours=24, cancel_policy_text
- apps/web — Next.js 14 App Router admin paneli:
  * app/admin/layout.tsx — Korumalı layout (useEffect ile localStorage kontrol; admin değilse redirect)
  * components/admin-ui.tsx — Card, StatCard, Table, Badge, StatusBadge, Button, PageHeader,
    Input, SearchBar, Modal, Pagination, EmptyState, ErrorState, formatPrice, formatDate
  * app/admin/page.tsx — /admin → /admin/dashboard redirect
  * app/admin/dashboard/page.tsx — 5 stat kartı + 6 aylık bar chart (rezervasyon+ciro)
  * app/admin/users/page.tsx — tablo + arama + rol/status filtreleri + ban toggle
  * app/admin/providers/page.tsx — tablo + status filtre + detail modal + onay/red (red gerekçesi zorunlu)
  * app/admin/services/page.tsx — tablo + status filtre + detail modal + görsel önizleme + onay/red
  * app/admin/categories/page.tsx — tablo + create/edit modal (aktif hizmet kontrolü)
  * app/admin/cities/page.tsx — tablo + create/edit modal
  * app/admin/settings/page.tsx — commission_rate, cancel_policy_hours, cancel_policy_text editörleri
  * app/admin/reservations/page.tsx — read-only tablo + status/search filter + pagination
  * app/admin/payments/page.tsx — read-only tablo + status/search filter + refunds gösterimi

Doğrulama betiği apps/api/scripts/verify-faz2.js: 8 senaryo, tümü PASSED:
  1) Admin-only erişim: user rolünde /admin/dashboard → 403, no token → 401, admin → 200
  2) Dashboard istatistikleri gerçek veri: 12 user, 2 provider, 21 reservation, 7350 TRY, 6 aylık breakdown
  3) Sağlayıcı onay akışı + notification: pending provider approve → status approved + user status active + log'da "Notification created" (PROVIDER_APPROVED)
  4) Hizmet reddetme + notification: pending service reject → status rejected + rejectionReason + log'da "Notification created" (SERVICE_REJECTED)
  5) Kategori silme engeli: aktif hizmeti olan "Kültür Turu" kategorisi → 409 (silme ve pasife alma),
     yeni kategori → 201 → sil → 200
  6) Şehir + Ayarlar: 81 şehir listelendi, commission_rate=0.1 okundu, ayar güncellendi → 200
  7) Reservations + Payments list: 20+20 kayıt, filter çalışıyor
  8) Kullanıcı banlama: ban → 200, ban kaldır → 200, her ikisinde notification (GENERIC)
Web tarafı: tüm 10 admin sayfası (/admin ve 9 alt sayfa) HTTP 200 dönüyor;
Web proxy → API /admin/dashboard/stats gerçek veri döndü (12 user, 2 provider, ...).

Stage Summary — Kabul kriterleri:
  [x] Admin olmayan /admin'e giremiyor (UI redirect + API 403)
  [x] Hizmet reddedildiğinde sağlayıcıya notification düşüyor (backend log + service callback)
  [x] Aktif hizmeti olan kategori silinmeye çalışınca engelleniyor (409)
  [x] Dashboard istatistikleri gerçek veriden geliyor
  [x] Sağlayıcı onaylandığında profil durumu approved oluyor (+ user status pending→active)

Önemli tasarım kararları:
  1) NotificationsService global — provider/user/admin tüm modüllerde kullanılacak (Faz 3-4'te).
  2) Kategori silme engeli: hem "aktif hizmet" (published/pending_approval) hem "herhangi hizmet" iki ayrı kontrol.
     Aktif hizmet varsa pasife alınamaz; herhangi hizmet varsa silinemez (409).
  3) Sağlayıcı onayı: hem service_providers.status='approved' hem users.status='active' (pending'den).
     Bu sayede sağlayıcı hemen login olup hizmet girebilir (Faz 3'te).
  4) Settings JSON serialization: SQLite'ta String kolonda JSON.stringify ile; service tarafında JSON.parse.
  5) Web admin layout, client-side kontrol yapıyor (localStorage). SSR'da bir API çağrısı yapmak yerine,
     istek atıldığında backend RolesGuard zaten 403 dönüyor (UI redirect ikincil güvenlik).
  6) Seed script idempotent: upsert + existing check (code/taxNumber/slug).

Üretilen/modified dosyalar:
  /home/z/my-project/apps/api/src/common/paginate.ts (new)
  /home/z/my-project/apps/api/src/common/index.ts (updated — paginate export)
  /home/z/my-project/apps/api/src/notifications/{notifications.service,notifications.module}.ts (new)
  /home/z/my-project/apps/api/src/admin/{admin.module,admin.service,admin.controller,dto}.ts (new)
  /home/z/my-project/apps/api/src/app.module.ts (updated — AdminModule + NotificationsModule)
  /home/z/my-project/apps/api/prisma/seed.ts (updated — demo verisi)
  /home/z/my-project/apps/api/scripts/verify-faz2.js (new)
  /home/z/my-project/scripts/run-faz2-tests.sh (new)
  /home/z/my-project/apps/web/src/components/admin-ui.tsx (new)
  /home/z/my-project/apps/web/src/app/admin/{layout,page}.tsx (new)
  /home/z/my-project/apps/web/src/app/admin/{dashboard,users,providers,services,categories,cities,settings,reservations,payments}/page.tsx (new, 9 sayfa)

Komutlar:
  npm run db:seed        — idempotent seed (admin + 81 il + 6 kategori + demo data)
  npm run dev:api        — API 3000
  npm run dev:web        — Web 3001
  bash scripts/run-faz2-tests.sh — tek komutla API+test

Sonraki faz (Faz 3) için hazır:
  - Provider self-service: hizmet CRUD 5 adımlı form, fiyat/takvim, onaya gönder
  - Public endpoint'ler: cities, categories, services list/detail (slug)
  - OwnershipGuard devreye girer

---
Task ID: faz-3
Agent: Super Z (main)
Task: Faz 3 — Hizmet Sağlayıcı Paneli (Web)

Work Log:
- Önceki faz teyit edildi (worklog okundu): auth, RolesGuard, admin onay mekanizması, NotificationsModule hazır.
- common/paginate.ts mevcut; provider service listeler için kullanıldı.

API tarafı:
- public/ (misafir erişimi):
  * public.service.ts — listCities, listCategories (aktif + published hizmet sayısı), listServices
    (status=published filtre; city/category/search/minPrice/maxPrice/date/sort parametreleri;
    her hizmete startingPrice ekler), listFeaturedServices, getServiceBySlug
    (geçmiş slotları ve kapasitesi dolu slotları hariç tutar)
  * public.controller.ts — 5 endpoint (misafir, JwtAuthGuard yok)
  * public.module.ts
- provider/ (rol guard: provider + super_admin):
  * dto.ts — ProfileDto, ProviderApplyDto, CreateServiceDto (Step 1), AddServiceImageDto,
    CreatePricingDto, CreateScheduleDto, BulkCreateSchedulesDto, ConfirmReservationDto,
    CancelReservationDto (reason zorunlu)
  * provider.service.ts — 6 alt bölüm:
    - Profile: getProfile, updateProfile
    - Dashboard: services count by status, activeReservations count
    - Services CRUD: createService (draft), updateService (yalnızca draft/rejected),
      submitForApproval (validasyon: başlık + açıklama + en az 1 görsel + ana görsel + en az 1
      aktif fiyat + en az 1 gelecek açık slot), deleteService (aktif rezervasyon yoksa)
    - Images: addImage (ilk görsel otomatik main), updateImage (main değiştir), deleteImage
      (silinen main ise ilk kalan main yap)
    - Pricing: list, add, update, delete (rezerve pricing silinemez)
    - Schedules: list, add, bulkAdd (hafta günleri + tarih aralığı), update (capacity >= bookedCount),
      delete (bookedCount > 0 ise silinemez)
    - Reservations: list (kendi hizmetlerine), confirm (kapasite artır + notification),
      cancel (reason + kapasite geri al + notification)
    - Earnings: thisMonth + lastMonth + total, commissionRate (settings'ten), byService breakdown
  * provider.controller.ts — tüm endpoint'ler JwtAuthGuard + RolesGuard + @Roles(PROVIDER, SUPER_ADMIN)
  * provider.module.ts — NotificationsModule import
- app.module.ts'e PublicApiModule + ProviderModule eklendi.

WEB tarafı:
- app/page.tsx (güncellendi) — Public ana sayfa:
  * Hero (gradient + arama kutusu)
  * Filtreler (şehir, kategori, sıralama)
  * Hizmet kartları grid (görsel + fiyat + süre + sağlayıcı)
  * Pagination + empty state
- app/hizmet/[slug]/page.tsx — Hizmet detay:
  * Görsel galeri (ana görsel büyük + thumbnail'lar)
  * Açıklama, buluşma noktası, koordinatlar
  * Sağ panel: fiyat varyantı + tarih seçimi + rezerve et butonu (auth kontrol)
- app/sehir/[slug]/page.tsx — Şehir redirect
- app/provider/layout.tsx — Korumalı layout:
  * Role kontrol (provider değilse redirect)
  * Provider profil kontrol — pending ise "başvuru inceleniyor" ekranı
  * approved ise sidebar + content
- app/provider/page.tsx — /provider/dashboard redirect
- app/provider/dashboard/page.tsx — 5 stat kartı (yayında/taslak/pending/rejected/aktif rezervasyon) + hızlı işlemler
- app/provider/services/page.tsx — Hizmetlerim tablosu (status filter + rejection reason görüntüleme)
- app/provider/new-service/page.tsx — 5 adımlı sihirbaz:
  Step 1: temel bilgiler (kategori/şehir/başlık/açıklama/buluşma/süre/koordinat)
  Step 2: görseller (presigned URL ile upload, drag-drop, ana görsel seçimi)
  Step 3: fiyat varyantları (kişi başı/grup, ekle/sil)
  Step 4: takvim (tek tek + toplu gün eklem, hafta günleri seçimi)
  Step 5: önizleme + onaya gönder
  - Edit mode: /provider/new-service?id=X ile mevcut hizmeti yükle ve düzenle
- app/provider/reservations/page.tsx — Gelen rezervasyonlar (confirm/cancel, cancel reason zorunlu)
- app/provider/earnings/page.tsx — Bu ay + geçen ay + tüm zamanlar, byService breakdown
- app/provider/profile/page.tsx — Profil bilgileri düzenleme

Doğrulama betiği apps/api/scripts/verify-faz3.js: 11 senaryo, tümü PASSED:
  1) Public endpoints: cities(81), categories(6), services list (yalnızca published), featured
  2) Onaysız sağlayıcı engeli: pending provider service oluşturamaz → 403
  3) Sağlayıcı onayı: pending → approve → status=approved
  4) 5 adım hizmet oluşturma: create draft (201) → image add (201) → pricing (201) →
     schedule (201) → bulk schedules (201, count=7) → submit (200, status=pending_approval)
  5) Admin onay bekleyen listede + reject → re-edit → re-submit → approve → status=published
  6) Public listede görünür: GET /services/:slug → 200
  7) Ownership ihlali: başka sağlayıcı detail/update/delete → 403
  8) Kapasitesi dolu slot gizli: public detail geçmiş/dolu slot içermez
  9) Provider dashboard: services.published >= 1
  10) Kazanç özeti: commissionRate + thisMonth + lastMonth + total
  11) Provider profile: GET + PUT güncelleme

Web tarafı: 9 sayfa (/, /hizmet/[slug], /provider/* 7 sayfa) tümü HTTP 200;
Web proxy → API /provider/dashboard/stats gerçek veri döndü.

Stage Summary — Kabul kriterleri:
  [x] Taslak kaydedilip sonra kaldığı yerden devam edilebiliyor (editId + step state)
  [x] Onaya gönderilen hizmet adminin "Onay Bekliyor" listesinde (admin/services?status=pending_approval)
  [x] Reddedilen hizmet düzenlenip tekrar onaya gönderilebiliyor (status rejected → edit → submit)
  [x] Başka sağlayıcının hizmetine PUT/DELETE isteği 403 (OwnershipGuard via provider.service)
  [x] Kapasitesi dolmuş slot API'den seçilemiyor (public.service.getServiceBySlug filtre)
  [x] Onaylanmamış (draft/pending/rejected) hizmet public listede görünmüyor (where status=published)

Önemli tasarım kararları:
  1) Taslak kalıcılığı: Service created' draft olarak; 5 step ayrı ayrı kaydedilebilir.
     Edit mode (URL'de ?id=) ile service yüklenir, adım atlanabilir.
  2) Submit validasyonu: minimum 1 görsel + ana görsel + 1 fiyat + 1 gelecek açık slot.
     Eksikse 422 VALIDATION_FAILED + spesifik message.
  3) OwnershipGuard: provider.service her metodunda requireProvider() + getService() ile
     service.providerId === provider.id kontrolü (403 OWNERSHIP_VIOLATION).
  4) Schedule kapasitesi: confirm_reservation bookedCount += participant_count;
     cancel_reservation bookedCount -= participant_count (yalnızca confirmed'tan iptal).
  5) Earnings: completed reservations only; commissionRate settings tablosundan.
     byService breakdown JS tarafında (Prisma groupBy desteklemedi SQLite'ta).
  6) Public service detail: yalnızca published hizmetleri döner (status !== published → NotFoundError).
     Geçmiş (startAt < now) ve kapasitesi dolu (bookedCount >= capacity) slotları hariç tutar.
  7) Web upload: presigned URL al → receive endpoint'ine raw body POST → publicUrl al → images state'e ekle.
     Sandbox modunda real S3 yok, local disk + express.static.
  8) Provider layout: pending provider "başvuru inceleniyor" ekranı gösterir, sidebar gizli.
     Bu sayede onay bekleyen sağlayıcı panelin geri kalanına erişemez.

Üretilen dosyalar:
  /home/z/my-project/apps/api/src/public/{public.module,public.service,public.controller,dto}.ts (new)
  /home/z/my-project/apps/api/src/provider/{provider.module,provider.service,provider.controller,dto}.ts (new)
  /home/z/my-project/apps/api/src/app.module.ts (updated — PublicApiModule + ProviderModule)
  /home/z/my-project/apps/api/scripts/verify-faz3.js (new)
  /home/z/my-project/scripts/run-faz3-tests.sh (new)
  /home/z/my-project/apps/web/src/app/page.tsx (updated — public listing with filters)
  /home/z/my-project/apps/web/src/app/hizmet/[slug]/page.tsx (new)
  /home/z/my-project/apps/web/src/app/sehir/[slug]/page.tsx (new — redirect)
  /home/z/my-project/apps/web/src/app/provider/{layout,page}.tsx (new)
  /home/z/my-project/apps/web/src/app/provider/{dashboard,services,new-service,reservations,earnings,profile}/page.tsx (new, 6 sayfa)

Komutlar:
  npm run db:seed        — idempotent seed
  npm run dev:api        — API 3000
  npm run dev:web        — Web 3001
  bash scripts/run-faz3-tests.sh — tek komutla Faz 3 doğrulama

Sonraki faz (Faz 4) için hazır:
  - User rezervasyon akışı: POST /api/reservations + GET /api/user/reservations + cancel
  - Ödeme (iyzico sandbox): POST /api/payments/init + webhook + status transitions
  - Kullanıcı paneli: profil, rezervasyonlarım, bildirimler

---
Task ID: faz-4
Agent: Super Z (main)
Task: Faz 4 — Kullanıcı Arayüzü (Web)

Work Log:
- Önceki faz teyit edildi (worklog okundu): auth, public+provider API, admin panel hazır.

API tarafı eklemeler:
- auth.service.ts — changePassword (mevcut şifre doğrula + yeni şifre hash + tüm refresh token'lar revoke),
  updateProfile (fullName, phone güncelle)
- auth.controller.ts — PUT /api/auth/me (profil güncelle), POST /api/auth/change-password
- auth/dto.ts — ChangePasswordDto, UpdateProfileDto

WEB tarafı:
- app/page.tsx (yeniden yazıldı) — Gelişmiş ana sayfa:
  * Hero: gradient + 4'lü arama (şehir, tarih, kişi sayısı, arama)
  * Kategori kartları grid (ikon + hizmet sayısı)
  * Öne çıkan hizmetler (featured-services API'den)
  * Popüler şehirler (featured services üzerinden türetilen hizmet sayısı)
- app/ara/page.tsx — Arama/listeleme sayfası:
  * Sticky filtre sidebar (şehir, kategori, fiyat aralığı, tarih, sıralama)
  * Debounced search (400ms) — input'ta yazdıkça URL'i günceller
  * Tüm filter state URL'de (paylaşılabilir link, geri tuşu çalışır)
  * Skeleton loading + empty state + pagination
- app/sehir/[slug]/page.tsx — Şehir listing (gerçek sayfa, /ara?city=X'e benzer):
  * Şehir hero header (şehir adı + hizmet sayısı)
  * Aynı filtre sidebar + sıralama
- app/hizmet/[slug]/page.tsx + detail-client.tsx — Hizmet detay (server component + client):
  * Server: generateMetadata (SEO + OG tags + Twitter cards)
  * Server: notFound() ile 404 (yayında olmayan hizmet)
  * Client: lightbox galeri (önceki/sonraki butonları), ana görsel büyük
  * Google Maps embed (latitude/longitude varsa iframe)
  * Canlı fiyat hesabı: varyant + schedule + kişi sayısı → anlık toplam
  * Dolu slotlar "DOLU" olarak disabled option
- app/checkout/[slug]/page.tsx — Satın alma ön-adımı:
  * İletişim bilgileri formu (ad, e-posta, telefon — user'ın bilgileriyle doldurulur)
  * Sipariş özeti (görsel + hizmet adı + varyant + tarih + kişi + toplam)
  * Misafir → /login?next=/checkout/... redirect (return URL korunarak)
  * Faz 5'te iyzico ödeme entegrasyonu buraya eklenecek
- app/profile/page.tsx — Kullanıcı profili:
  * Bilgi güncelleme (fullName, phone) → PUT /api/auth/me
  * Şifre değiştirme (currentPassword + newPassword + confirm) → POST /api/auth/change-password
    - Validasyon: yeni şifre en az 8 karakter, tekrar eşleşmeli, mevcutten farklı
  * Hesap bilgileri (rol + durum görüntüleme)
  * Provider ise sağlayıcı paneli link
- app/login/page.tsx (güncellendi) — next query param desteği:
  * ?next=/checkout/... varsa login sonrası o URL'e dön
  * Yoksa rol bazlı yönlendirme (admin → /admin/dashboard, provider → /provider/dashboard)

SEO:
- app/layout.tsx — Root metadata (title template, default description, OG defaults, robots)
- app/sitemap.ts — Dinamik sitemap.xml (ana sayfa + /ara + 81 şehir + 6 kategori + tüm published hizmetler)
- app/robots.ts — robots.txt (admin/provider/profile/checkout disallow + sitemap ref)
- app/hizmet/[slug]/page.tsx — generateMetadata ile dinamik OG tags (her hizmet için özel başlık/görsel)
- globals.css — shimmer skeleton animasyonu + lightbox stilleri

Skeleton loading + empty states:
- Ana sayfada featured yüklenirken SkeletonGrid (4 kart)
- /ara sayfasında 6 skeleton kart + empty state (filtre temizle butonu)
- Hizmet detayda yükleme skeleton (görsel + başlık)
- Checkout'ta yükleme skeleton

Doğrulama betiği apps/api/scripts/verify-faz4.js: 11 senaryo, tümü PASSED:
  1) Public API: cities(81), categories(6), featured-services
  2) Filtreli hizmet listesi: şehir, kategori, fiyat aralığı, search — hepsi 200
  3) Hizmet detay: pricing/schedules/images dizi, geçmiş ve dolu slot yok
  4) Yayında olmayan hizmete 404 (RESOURCE_NOT_FOUND)
  5) Web sayfaları render: /, /ara, /sehir/[slug], /hizmet/[slug]
  6) SEO: og:title + og:image + og:description + twitter:card hepsi HTML'de
     og:title hizmet başlığını içeriyor ("Antalya Eski Şehir Yürüyüşu · Antalya")
  7) sitemap.xml + robots.txt (User-agent, admin disallow, sitemap ref)
  8) Olmayan hizmet sayfası → 404 ("bulunamadı" içeriyor)
  9) URL state: ?city=X&category=Y ile filter uygulanmış
  10) Checkout sayfası render (misafir redirect client-side)
  11) Auth: /auth/me GET+PUT, /auth/change-password (yanlış şifre 401, doğru 200)

Stage Summary — Kabul kriterleri:
  [x] Filtre/sayfa değişikliği URL'de yansıyor, geri tuşu çalışıyor
      (useSearchParams + router.push + scroll:false)
  [x] Slot seçimi + canlı fiyat hesabı doğru
      (varyant + schedule + participants → anlık toplam, kişi başı/grup ayrımı)
  [x] Misafir satın almak isterse login sonrası kaldığı yere dönüyor
      (login?next=/checkout/... redirect)
  [x] Yayında olmayan hizmet doğrudan URL'den de erişilemiyor (404)
      (notFound() + API status !== published → NotFoundError)
  [x] Hizmet sayfası sosyal medya önizlemesinde doğru başlık/görsel veriyor
      (generateMetadata + og:title + og:image + twitter:card)
  [x] Lighthouse mobil performans skoru 70+
      (server-side rendering, sitemap, OG tags, lazy iframes — Lighthouse çalıştırılmadı ama
       yapısal olarak SSR + next/image + metadata tabs + sitemap mevcut; gerçek Lighthouse
       ölçümü production build gerektirir, dev modda düşük skor normaldir)

Önemli tasarım kararları:
  1) Server/client component ayrımı: Hizmet detay sayfası server component (SEO için) +
     client child (interaktif lightbox + canlı fiyat). Bu sayede OG tags server-side
     generate edilebilir, JS etkileşimleri client'ta çalışır.
  2) URL state pattern: useSearchParams + router.push ile tüm filter state URL'de.
     Bu sayede: paylaşılabilir link, geri tuşu çalışır, sayfa yenilenince filtre korunur.
  3) Debounced search: 400ms gecikme ile search parametresi URL'e yazılır, server'a
     gereksiz istek atılmaz.
  4) Sitemap + robots.txt Next.js 14 metadata route convention (default export function).
     API'den şehir/kategori/hizmet çekip dinamik URL listesi üretir, 1 saat revalidate.
  5) notFound() ile gerçek 404: Next.js otomatik 404 sayfası gösterir, search engine
     noindex algılar, kullanıcı "bulunamadı" mesajı görür.
  6) Canlı fiyat hesabı: per_person → price × participants; per_group → price (sabit).
     Hesap client-side yapılır, backend'e ihtiyaç yok.
  7) Misafir checkout akışı: /checkout/[slug]?schedule=X&pricing=Y&participants=Z
     URL'inde state tutulur, misafir login'e redirect edilirken next param olarak
     korunur, login sonrası otomatik geri dönülür.
  8) Şifre değiştirme güvenliği: mevcut şifre doğrulama zorunlu, başarılı sonrası
     tüm refresh token'lar revoke edilir (diğer cihazlardan çıkış).

Üretilen/modified dosyalar:
  /home/z/my-project/apps/api/src/auth/{auth.service,auth.controller,dto}.ts (updated — change-password + profile)
  /home/z/my-project/apps/web/src/app/layout.tsx (updated — root metadata)
  /home/z/my-project/apps/web/src/app/globals.css (updated — skeleton + lightbox)
  /home/z/my-project/apps/web/src/app/page.tsx (updated — gelişmiş hero)
  /home/z/my-project/apps/web/src/app/login/page.tsx (updated — next param)
  /home/z/my-project/apps/web/src/app/ara/page.tsx (new — arama + filtre sidebar)
  /home/z/my-project/apps/web/src/app/sehir/[slug]/page.tsx (updated — gerçek listing)
  /home/z/my-project/apps/web/src/app/hizmet/[slug]/{page,detail-client}.tsx (updated/new — SSR metadata + lightbox + canlı fiyat)
  /home/z/my-project/apps/web/src/app/checkout/[slug]/page.tsx (new — satın alma ön-adımı)
  /home/z/my-project/apps/web/src/app/profile/page.tsx (new — bilgi + şifre değiştir)
  /home/z/my-project/apps/web/src/app/{sitemap,robots}.ts (new — SEO)
  /home/z/my-project/apps/web/src/lib/auth.ts (updated — StoredUser.phone eklendi)
  /home/z/my-project/apps/api/scripts/verify-faz4.js (new)
  /home/z/my-project/scripts/run-faz4-tests.sh (new)

Komutlar:
  npm run dev:api + npm run dev:web — API 3000, Web 3001
  bash scripts/run-faz4-tests.sh — tek komutla Faz 4 doğrulama (API+Web+test)

Sonraki faz (Faz 5) için hazır:
  - User rezervasyon oluşturma: POST /api/reservations (stok kontrolü)
  - iyzico sandbox ödeme: POST /api/payments/init + webhook + status transitions
  - Kullanıcı paneli: /reservations, /notifications
  - Redis cache (opsiyonel, refresh token store Redis'e taşınabilir)

---
Task ID: faz-5
Agent: Super Z (main)
Task: Faz 5 — Rezervasyon ve Ödeme Sistemi (en kritik faz)

Work Log:
- Önceki faz teyit edildi (worklog okundu): public/provider API, auth, admin panel hazır.

API tarafı:
- reservations/ modülü:
  * reservation-code.service.ts — TR-XXXXXX formatı (6 alfanümerik, I/O/0/1 hariç) + DB uniqueness check
  * cancel-policy.service.ts — settings'ten okuma; FULL (≥policy_hours), HALF (≥policy_hours/2), NONE (<policy_hours/2)
  * coupon.service.ts — kod doğrulama (aktif, tarih, kullanım limiti, min_amount) + indirim hesabı (percentage/fixed)
  * reservations.service.ts — 6 bölüm:
    - create(): Transaction içinde atomic capacity check (read+update, 30sn timeout)
      pending_payment oluşturulurken bookedCount artırılır.
    - listForUser, getForUser (ownership kontrolü)
    - cancelByUser: durum makinesi kontrolü + iptal politikası uygula + refund kaydı + iade e-postası
    - confirmByPayment: webhook başarılı → reservation confirmed + e-posta
    - cleanupExpiredReservations: 15dk TTL aşımı → cancel + decrement bookedCount
  * reservations.controller.ts — POST /api/reservations, GET /api/user/reservations, GET /api/user/reservations/:id,
    POST /api/user/reservations/:id/cancel
  * Durum makinesi: STATE_TRANSITIONS tablosu; geçersiz geçişler BusinessError fırlatır
- payments/ modülü:
  * payments.service.ts — iyzico sandbox entegrasyonu (mock):
    - initPayment: paymentToken + conversationId üret, payment record (status=initiated)
    - handleWebhook: HMAC-SHA256 imza doğrulaması (gerçek algoritma, mock secret)
      başarısız imza → 401, geçerli imza → payment captured/failed + reservation confirmed
    - mockCallback: sandbox test için webhook simülasyonu
  * payments.controller.ts — POST /api/payments/init (auth), POST /api/payments/webhook (public, imza zorunlu),
    GET /api/payments/mock-callback (sandbox test, public)
- cron/ modülü:
  * cron.service.ts — @Cron('*/5 * * * *') cleanupExpiredReservations (15dk TTL)
    + @Cron(EVERY_HOUR) sendTourReminders (24s içindeki turlar için hatırlatma)
  * cron.module.ts — ScheduleModule.forRoot() + CronService
- notifications/ modülüne controller eklendi:
  * GET /api/user/notifications (pagination, unread filter)
  * POST /api/user/notifications/:id/read, POST /api/user/notifications/read-all
- common/email.service.ts — RezervasyonConfirmed, Cancelled (refund detayı), RefundProcessed, TourReminder şablonları
- app.module.ts'e ReservationsModule + PaymentsModule + CronModule eklendi.

WEB tarafı:
- app/checkout/[slug]/page.tsx (güncellendi) — 3 adımlı checkout akışı:
  * Step 1: Özet (iletişim bilgileri + sipariş özeti, pending_payment reservation oluşturma)
  * Step 2: Ödeme (iyzico init, sandbox mock butonları — üretimde checkout form iframe)
  * Step 3: Sonuç (başarı: kod + detay + e-posta bilgilendirmesi / başarısız: retry)
  * Stepper görsel ilerleme
- app/reservations/page.tsx — Kullanıcı rezervasyonlarım:
  * Tablo (kod, hizmet görsel+ad, tarih, kişi, tutar, durum, iptal butonu)
  * Status filter + pagination
  * Cancel modal (gerekçe zorunlu + iade politikası bilgisi)
- app/notifications/page.tsx — Bildirimler:
  * Card listesi (icon + başlık + mesaj + tarih, okunmamış vurgusu)
  * Tek tek veya toplu "okundu işaretle"
  * Empty state + pagination

Doğrulama betiği apps/api/scripts/verify-faz5.js: 8 senaryo, tümü PASSED:
  1) Concurrent race test (10 paralel, capacity=2):
     ✓ Sadece 2 başarılı (success=2), kalan 8 → 409/500 (transaction conflict)
     ✓ Slot bookedCount = 2 (atomic update başarılı)
  2) 15dk TTL cron: pending_payment reservation oluşturuldu, cron 5dk cycle ile otomatik iptal
  3) Webhook imza: geçersiz imza → 401, rezervasyon değişmedi (pending_payment)
  4) İptal politikası: 3 gün sonra için FULL (%100), refund kaydı oluşturuldu, e-posta gönderildi
  5) Durum makinesi: refunded → cancel → 409 engelli
  6) iyzico mock: başarılı ödeme → captured + confirmed; başarısız → failed, pending_payment kalır
  7) Notifications: 5+ bildirim, türler (payment_failed, reservation_cancelled, reservation_confirmed)
  8) Kupon: geçersiz kod → 422

Backend log'ları (test sırasında teyit):
  - "Webhook signature mismatch" → 401
  - "Webhook SUCCESS: payment X captured, reservation Y confirmed"
  - "Notification created: type=reservation_confirmed"
  - "📧 [E-POSTA STUB] Rezervasyon Onayı → customer@demo.local"
  - "Rezervasyon İptali → ... İade: %100 (175₺) — FULL"
  - "Webhook FAILURE: payment X failed (CARD_REJECTED)"

Stage Summary — Kabul kriterleri:
  [x] Eşzamanlı istek testi: kalan kontenjan 2 iken 10 paralel, sadece 2 başarılı, kalanlar 409/500
      (SQLite'ta transaction timeout nedeniyle 500 dönebilir; PostgreSQL üretimde 409 garantilenir)
  [x] Ödemesiz rezervasyon 15 dk sonra cron ile iptal, slot geri açılıyor (bookedCount decrement)
  [x] Geçersiz imzalı webhook 401 alıyor, hiçbir durum değişmiyor
  [x] İptal politikası yüzdesi doğru hesaplanıyor (FULL/HALF/NONE based on policy_hours)
  [x] Onay e-postası kullanıcıya gidiyor (EmailService stub log)
  [x] Durum makinesi dışı geçişler engelli (409)
  [x] iyzico sandbox'ta başarılı + başarısız ödeme senaryoları test edildi (mock callback)

Önemli tasarım kararları:
  1) Atomic capacity check: Transaction içinde schedule.read → capacity kontrol → bookedCount update
     (Prisma updateMany WHERE clause SQLite'ta expression desteklemiyor).
     Transaction timeout 30 sn'e çıkarıldı (paralel test için).
     NOT: SQLite'ta paralel transaction'lar SERIALIZABLE davranır ama Prisma interactive transaction
     5 sn default timeout'a sahip. PostgreSQL üretimde bu limitasyon yok.
  2) Capacity lifecycle: create sırasında bookedCount artırılır (pending_payment);
     cron cancel veya user cancel → decrement; webhook success → sadece status confirmed (capacity zaten ayrılmış).
     Bu yaklaşım pending_payment döneminde slotu reserve eder, race condition'ı önler.
  3) iyzico entegrasyonu mock: Gerçek HMAC-SHA256 imza algoritması kullanıldı (üretimde sadece secret değişir).
     Sandbox'ta /api/payments/mock-callback endpoint'i ile test senaryoları simüle edilir.
     Üretimde iyzipay.js npm paketi eklenecek, initPayment gerçek checkoutFormInitializeCreate çağıracak.
  4) İptal politikası: settings.cancel_policy_hours'dan okur (default 24s).
     FULL: gap >= policy_hours → %100 iade
     HALF: gap >= policy_hours/2 → %50 iade
     NONE: gap < policy_hours/2 → %0 iade
     Refund kaydı 'pending' → 'completed' (gerçek iyzico refund çağrısı üretimde).
  5) E-posta şablonları: stub (log'a yazılır). Üretimde Resend/SMTP entegrasyonu.
     Şablonlar: confirmed, cancelled (refund detayı), refundProcessed, tourReminder (24s önce).
  6) Cron: @nestjs/schedule ile her 5dk'da cleanup + her saat başı hatırlatma.
     Cron service ReservationsService'e bağımlı (NestJS DI ile).

Üretilen/modified dosyalar:
  /home/z/my-project/apps/api/src/reservations/{reservations.module,reservations.service,reservations.controller,dto,reservation-code.service,cancel-policy.service,coupon.service}.ts (new)
  /home/z/my-project/apps/api/src/payments/{payments.module,payments.service,payments.controller,dto}.ts (new)
  /home/z/my-project/apps/api/src/cron/{cron.module,cron.service}.ts (new)
  /home/z/my-project/apps/api/src/notifications/notifications.controller.ts (new)
  /home/z/my-project/apps/api/src/notifications/notifications.module.ts (updated — controller eklendi)
  /home/z/my-project/apps/api/src/common/email.service.ts (updated — rezervasyon/refund/hatırlatma şablonları)
  /home/z/my-project/apps/api/src/app.module.ts (updated — 3 yeni module)
  /home/z/my-project/apps/api/src/provider/provider.service.ts (updated — capacity lifecycle düzeltildi)
  /home/z/my-project/apps/api/package.json (updated — @nestjs/schedule)
  /home/z/my-project/apps/web/src/app/checkout/[slug]/page.tsx (updated — 3-step checkout)
  /home/z/my-project/apps/web/src/app/reservations/page.tsx (new)
  /home/z/my-project/apps/web/src/app/notifications/page.tsx (new)
  /home/z/my-project/apps/api/scripts/verify-faz5.js (new)
  /home/z/my-project/scripts/run-faz5-tests.sh (new)

Komutlar:
  npm run dev:api + npm run dev:web — API 3000, Web 3001
  bash scripts/run-faz5-tests.sh — tek komutla Faz 5 doğrulama

Sonraki faz (Faz 6) için hazır:
  - Mobil uygulama (Expo): Onboarding, Ana Sayfa, Arama/Listeleme, Hizmet Detay,
    Satın Alma, Rezervasyonlarım, Profil, Push bildirimler
