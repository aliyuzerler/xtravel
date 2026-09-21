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

Sonraki faz (Faz 1) için hazır: NestJS bootstrap, JWT auth, kullanıcı kayıt/giriş.
