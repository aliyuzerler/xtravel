/**
 * Faz-0 doğrulama betiği:
 * 1) Tüm tablolar var mı?
 * 2) Beklenen indeksler var mı?
 * 3) shared paketi api ve web tarafında çözümlenebiliyor mu?
 * 4) Enum değerleri spec ile birebir aynı mı?
 *
 * NOT: Bu betik herhangi bir workspace'ten çalışabilir. @prisma/client npm
 * workspaces tarafından root'a hoist edilmiştir ve generate edilen client
 * root node_modules/.prisma/client altına kopyalanmıştır (sync:generate script).
 */
const { PrismaClient } = require('@prisma/client');
const path = require('path');

// shared paketini root workspace üzerinden import et
const shared = require('@turizm-pazaryeri/shared');

const prisma = new PrismaClient();

const EXPECTED_TABLES = [
  'users',
  'service_providers',
  'categories',
  'cities',
  'services',
  'service_images',
  'service_pricing',
  'service_schedules',
  'reservations',
  'payments',
  'refunds',
  'coupons',
  'notifications',
  'settings',
  'reviews',
  'favorites',
  // Prisma migration tabloları (kontrol dışı)
  '_prisma_migrations',
];

// 00-ortak-baglam.txt A3'ten beklenen indeksler
const EXPECTED_INDEXES = [
  { table: 'services', columns: ['city_id', 'category_id', 'status'] },
  { table: 'services', columns: ['provider_id'] },
  { table: 'service_schedules', columns: ['service_id', 'start_at'] },
  { table: 'reservations', columns: ['user_id'] },
  { table: 'reservations', columns: ['service_id'] },
  { table: 'reservations', columns: ['schedule_id'] },
  { table: 'reservations', columns: ['status'] },
  { table: 'payments', columns: ['reservation_id'] },
  { table: 'payments', columns: ['provider_transaction_id'] },
];

// Enum doğrulama — spec ile shared paket karşılaştırması
const ENUM_SPEC = {
  UserRole: ['super_admin', 'provider', 'user'],
  UserStatus: ['active', 'banned', 'pending'],
  ProviderStatus: ['pending', 'approved', 'rejected', 'suspended'],
  ServiceStatus: ['draft', 'pending_approval', 'published', 'rejected', 'paused'],
  PricingUnit: ['per_person', 'per_group'],
  ScheduleStatus: ['open', 'closed'],
  ReservationStatus: ['pending_payment', 'confirmed', 'completed', 'cancelled', 'refunded'],
  PaymentProvider: ['iyzico', 'paytr', 'manual'],
  PaymentStatus: ['initiated', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'],
  RefundStatus: ['pending', 'completed', 'failed'],
  DiscountType: ['percentage', 'fixed'],
  ReviewStatus: ['pending', 'approved', 'rejected'],
};

function enumValues(enumObj) {
  return Object.values(enumObj).sort();
}

async function main() {
  console.log('=== FAZ-0 DOĞRULAMA ===\n');

  // 1) Tabloları kontrol et
  const tableRows = await prisma.$queryRaw`
    SELECT name FROM sqlite_master
    WHERE type='table' ORDER BY name;
  `;
  const actualTables = tableRows.map((r) => r.name).sort();
  console.log('1) Tablolar:');
  for (const t of EXPECTED_TABLES) {
    const ok = actualTables.includes(t);
    console.log(`   ${ok ? 'OK' : 'MISSING'}  ${t}`);
  }
  const unexpected = actualTables.filter((t) => !EXPECTED_TABLES.includes(t));
  if (unexpected.length) {
    console.log('   Beklenmeyen tablolar:', unexpected);
  }

  // 2) İndeksleri kontrol et
  console.log('\n2) İndeksler:');
  const idxRows = await prisma.$queryRaw`
    SELECT name, tbl_name, sql FROM sqlite_master
    WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name;
  `;
  // SQLite indeks SQL'ini sütun listesine çevir
  const indexMap = {};
  for (const row of idxRows) {
    // Prisma SQLite çıktısı: CREATE INDEX "name" ON "table"("col1", "col2")
    const m = /CREATE (?:UNIQUE )?INDEX "[^"]+" ON "[^"]+"[\s]*\(([^)]+)\)/.exec(row.sql || '');
    if (!m) continue;
    const cols = m[1].split(',').map((c) => c.trim().replace(/"/g, '')).sort();
    const key = `${row.tbl_name}::${cols.join(',')}`;
    indexMap[key] = row.name;
  }
  for (const exp of EXPECTED_INDEXES) {
    const key = `${exp.table}::${exp.columns.sort().join(',')}`;
    const ok = Boolean(indexMap[key]);
    console.log(`   ${ok ? 'OK' : 'MISSING'}  ${exp.table}(${exp.columns.join(', ')}) -> ${indexMap[key] || '—'}`);
  }

  // 3) shared paket import doğrulaması
  console.log('\n3) shared paket importu:');
  const apiResolve = require.resolve('@turizm-pazaryeri/shared', { paths: [process.cwd() + '/apps/api'] });
  const webResolve = require.resolve('@turizm-pazaryeri/shared', { paths: [process.cwd() + '/apps/web'] });
  console.log('   api  → resolve path:', apiResolve.includes('packages/shared') ? 'OK' : 'FAIL');
  console.log('   web  → resolve path:', webResolve.includes('packages/shared') ? 'OK' : 'FAIL');
  console.log('   UserRole enum erişimi:', typeof shared.UserRole === 'object' ? 'OK' : 'FAIL');

  // 4) Enum değerleri spec ile karşılaştır
  console.log('\n4) Enum değerleri (spec ↔ shared):');
  let enumMismatches = 0;
  for (const [enumName, expectedValues] of Object.entries(ENUM_SPEC)) {
    const actual = enumValues(shared[enumName] || {});
    const expected = [...expectedValues].sort();
    const match =
      actual.length === expected.length &&
      actual.every((v, i) => v === expected[i]);
    if (!match) enumMismatches++;
    console.log(`   ${match ? 'OK' : 'FAIL'}  ${enumName}: ${actual.join(' | ')}`);
  }

  console.log(`\n=== ÖZET ===`);
  console.log(`Tablolar: ${actualTables.length}/${EXPECTED_TABLES.length}`);
  console.log(`Enum mismatch: ${enumMismatches}`);
  console.log(enumMismatches === 0 ? 'FAZ-0 DOĞRULAMA BAŞARILI ✓' : 'FAZ-0 DOĞRULAMA BAŞARISIZ ✗');
}

main()
  .catch((err) => {
    console.error('Doğrulama hatası:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
