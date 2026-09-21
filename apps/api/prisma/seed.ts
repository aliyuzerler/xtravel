/**
 * Faz-2 Seed scripti
 *
 * Çalıştırma: cd apps/api && npm run seed
 *
 * İçerik:
 *   1) 1 admin kullanıcı
 *   2) 81 Türkiye ili
 *   3) 6 kategori
 *   4) Default settings (commission_rate, cancel_policy_hours)
 *
 *   --- Faz 2 eklemeleri (demo verisi) ---
 *   5) 2 demo sağlayıcı:
 *      a) "Antalya Kültür Turları A.Ş." — APPROVED, 2 hizmet (1 published, 1 pending_approval)
 *      b) "İstanbul Boğaz Turu Ltd." — PENDING (admin onayı bekliyor)
 *   6) Demo hizmete 3 fiyat varyantı, 3 takvim slotu, 2 görsel (placeholder URL)
 *   7) Demo rezervasyon + ödeme (son 4 ay içinde dağılmış, dashboard grafik için)
 *
 * Idempotent: var olan kayıtları atlar (upsert kullanır).
 * Faz-2 demo verisi için: kullanıcı email/şifre = provider1@demo.local / Provider123!
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TURKISH_CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya',
  'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu',
  'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır',
  'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep',
  'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin', 'İstanbul',
  'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir',
  'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş',
  'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya',
  'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon',
  'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray',
  'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan',
  'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
];

const CATEGORIES = [
  { name: 'Kültür Turu', iconName: 'landmark', sortOrder: 1 },
  { name: 'Gemi Turu', iconName: 'ship', sortOrder: 2 },
  { name: 'Yemek Turu', iconName: 'utensils', sortOrder: 3 },
  { name: 'Doğa Yürüyüşü', iconName: 'mountain', sortOrder: 4 },
  { name: 'Müze Gezisi', iconName: 'building', sortOrder: 5 },
  { name: 'Şehir Turu', iconName: 'map-pin', sortOrder: 6 },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureUser(email: string, password: string, fullName: string, role: string, status: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const hash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { email, passwordHash: hash, fullName, role, status },
  });
}

async function main() {
  console.log('=== SEED BAŞLIYOR ===\n');

  // 1) Admin
  const admin = await ensureUser(
    'admin@turizm-pazaryeri.local',
    'Admin123!',
    'Platform Admin',
    'super_admin',
    'active',
  );
  console.log(`1) Admin: ${admin.email}`);

  // 2) 81 il
  for (const name of TURKISH_CITIES) {
    const slug = slugify(name);
    await prisma.city.upsert({ where: { slug }, update: {}, create: { name, slug, isActive: true } });
  }
  console.log(`2) Şehirler: ${await prisma.city.count()}`);

  // 3) 6 kategori
  for (const cat of CATEGORIES) {
    const slug = slugify(cat.name);
    await prisma.category.upsert({
      where: { slug },
      update: { iconName: cat.iconName, sortOrder: cat.sortOrder },
      create: { name: cat.name, slug, iconName: cat.iconName, sortOrder: cat.sortOrder, isActive: true },
    });
  }
  console.log(`3) Kategoriler: ${await prisma.category.count()}`);

  // 4) Default settings
  await prisma.setting.upsert({
    where: { key: 'commission_rate' },
    update: {},
    create: { key: 'commission_rate', value: JSON.stringify(0.10) },
  });
  await prisma.setting.upsert({
    where: { key: 'cancel_policy_hours' },
    update: {},
    create: { key: 'cancel_policy_hours', value: JSON.stringify(24) },
  });
  await prisma.setting.upsert({
    where: { key: 'cancel_policy_text' },
    update: {},
    create: {
      key: 'cancel_policy_text',
      value: JSON.stringify('Rezervasyon başlangıcından 24 saat öncesine kadar ücretsiz iptal. Sonrasında %50 kesinti uygulanır.'),
    },
  });
  console.log(`4) Ayarlar: ${await prisma.setting.count()}`);

  // =====================================================================
  // Faz-2 demo verisi
  // =====================================================================
  console.log('\n--- Faz-2 demo verisi ---');

  // 5a) Approved sağlayıcı (Antalya Kültür Turları)
  const provider1User = await ensureUser(
    'provider1@demo.local',
    'Provider123!',
    'Antalya Kültür Turları A.Ş.',
    'provider',
    'active',
  );
  const provider1 = await prisma.serviceProvider.upsert({
    where: { userId: provider1User.id },
    update: {},
    create: {
      userId: provider1User.id,
      companyName: 'Antalya Kültür Turları A.Ş.',
      taxNumber: '1234567890',
      phone: '+90 242 123 4567',
      description: 'Antalya bölgesinde kültür ve doğa turları.',
      status: 'approved',
    },
  });
  console.log(`5a) Provider #1 (approved): ${provider1.companyName}`);

  // 5b) Pending sağlayıcı (İstanbul Boğaz Turu)
  const provider2User = await ensureUser(
    'provider2@demo.local',
    'Provider123!',
    'İstanbul Boğaz Turu Ltd.',
    'provider',
    'pending',
  );
  const provider2 = await prisma.serviceProvider.upsert({
    where: { userId: provider2User.id },
    update: {},
    create: {
      userId: provider2User.id,
      companyName: 'İstanbul Boğaz Turu Ltd.',
      taxNumber: '0987654321',
      phone: '+90 212 987 6543',
      description: 'Boğaz turu ve şehir gezileri.',
      status: 'pending',
    },
  });
  console.log(`5b) Provider #2 (pending): ${provider2.companyName}`);

  // 6) Provider 1 için 2 hizmet
  const antalya = await prisma.city.findUnique({ where: { slug: 'antalya' } });
  const istanbul = await prisma.city.findUnique({ where: { slug: 'istanbul' } });
  const kulturCat = await prisma.category.findUnique({ where: { slug: 'kultur-turu' } });
  const gemiCat = await prisma.category.findUnique({ where: { slug: 'gemi-turu' } });

  if (antalya && kulturCat) {
    // Yayında hizmet
    const service1 = await prisma.service.upsert({
      where: { slug: 'antalya-eski-sehir-yuruyusu' },
      update: {},
      create: {
        providerId: provider1.id,
        categoryId: kulturCat.id,
        cityId: antalya.id,
        title: 'Antalya Eski Şehir Yürüyüşu',
        slug: 'antalya-eski-sehir-yuruyusu',
        description: 'Kaleiçi, Hadrian Kapısı ve Yivli Minare etrafında rehberli yürüyüş.',
        meetingPoint: 'Hadrian Kapısı önü',
        latitude: 36.8841,
        longitude: 30.7055,
        durationHours: 3,
        status: 'published',
        isFeatured: true,
      },
    });
    console.log(`6) Service (published): ${service1.title}`);

    // Fiyat varyantları
    for (const p of [
      { name: 'Yetişkin', price: 350, unit: 'per_person' },
      { name: 'Çocuk (7-12)', price: 175, unit: 'per_person' },
      { name: 'Grup (10+)', price: 3000, unit: 'per_group' },
    ]) {
      const existing = await prisma.servicePricing.findFirst({
        where: { serviceId: service1.id, name: p.name },
      });
      if (!existing) {
        await prisma.servicePricing.create({
          data: { serviceId: service1.id, name: p.name, price: p.price, currency: 'TRY', unit: p.unit, isActive: true },
        });
      }
    }

    // Takvim slotları
    for (let i = 0; i < 5; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i + 1);
      date.setHours(10, 0, 0, 0);
      const end = new Date(date);
      end.setHours(end.getHours() + 3);
      const existing = await prisma.serviceSchedule.findFirst({
        where: { serviceId: service1.id, startAt: date },
      });
      if (!existing) {
        await prisma.serviceSchedule.create({
          data: {
            serviceId: service1.id,
            startAt: date,
            endAt: end,
            capacity: 20,
            bookedCount: 0,
            status: 'open',
          },
        });
      }
    }

    // Görseller (placeholder URL)
    for (const img of [
      { url: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800', main: true, sort: 0 },
      { url: 'https://images.unsplash.com/photo-1602941525436-9b21cd2c5929?w=800', main: false, sort: 1 },
    ]) {
      const existing = await prisma.serviceImage.findFirst({
        where: { serviceId: service1.id, imageUrl: img.url },
      });
      if (!existing) {
        await prisma.serviceImage.create({
          data: { serviceId: service1.id, imageUrl: img.url, isMain: img.main, sortOrder: img.sort },
        });
      }
    }

    // 7) Demo rezervasyon + ödeme (son 4 ay dağılmış)
    const customerUser = await ensureUser(
      'customer@demo.local',
      'Customer123!',
      'Demo Müşteri',
      'user',
      'active',
    );
    const now = new Date();
    const reservations = [
      { monthsAgo: 4, count: 3, total: 1050, status: 'completed' },
      { monthsAgo: 3, count: 5, total: 1750, status: 'completed' },
      { monthsAgo: 2, count: 7, total: 2450, status: 'completed' },
      { monthsAgo: 1, count: 4, total: 1400, status: 'completed' },
      { monthsAgo: 0, count: 2, total: 700, status: 'confirmed' },
    ];
    for (const r of reservations) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - r.monthsAgo, 15, 14, 0, 0, 0);
      const schedule = await prisma.serviceSchedule.findFirst({
        where: { serviceId: service1.id, startAt: { gte: monthDate } },
      });
      if (!schedule) continue;
      const pricing = await prisma.servicePricing.findFirst({
        where: { serviceId: service1.id, name: 'Yetişkin' },
      });
      if (!pricing) continue;
      for (let i = 0; i < r.count; i++) {
        const code = `DEMO${r.monthsAgo}${i}${Date.now().toString().slice(-4)}`;
        const existing = await prisma.reservation.findUnique({ where: { reservationCode: code } });
        if (existing) continue;
        const reservation = await prisma.reservation.create({
          data: {
            reservationCode: code,
            userId: customerUser.id,
            serviceId: service1.id,
            scheduleId: schedule.id,
            pricingId: pricing.id,
            participantCount: 1,
            unitPrice: 350,
            totalPrice: 350,
            discountAmount: 0,
            status: r.status,
            contactName: 'Demo Müşteri',
            contactPhone: '+90 555 000 0000',
            contactEmail: 'customer@demo.local',
            createdAt: monthDate,
            updatedAt: monthDate,
          },
        });
        // Ödeme
        await prisma.payment.create({
          data: {
            reservationId: reservation.id,
            amount: 350,
            currency: 'TRY',
            provider: 'iyzico',
            providerTransactionId: `iyz_demo_${reservation.id.slice(0, 8)}`,
            status: 'captured',
            rawResponse: JSON.stringify({ status: 'success', demo: true }),
            createdAt: monthDate,
          },
        });
      }
    }
    console.log(`7) Demo reservations: ${await prisma.reservation.count()}`);
    console.log(`   Demo payments: ${await prisma.payment.count()}`);
  }

  // 6b) Provider 1 için onay bekleyen 2. hizmet (pending_approval)
  if (antalya && kulturCat) {
    const service2 = await prisma.service.upsert({
      where: { slug: 'antalya-muzesi-ve-kaleici-aksam-turu' },
      update: {},
      create: {
        providerId: provider1.id,
        categoryId: kulturCat.id,
        cityId: antalya.id,
        title: 'Antalya Müzesi ve Kaleiçi Akşam Turu',
        slug: 'antalya-muzesi-ve-kaleici-aksam-turu',
        description: 'Antalya Müzesi gezisi sonrası Kaleiçi\'nde akşam yürüyüşü ve akşam yemeği.',
        meetingPoint: 'Antalya Müzesi girişi',
        durationHours: 5,
        status: 'pending_approval',
      },
    });
    console.log(`6b) Service (pending_approval): ${service2.title}`);
  }

  // Özet
  console.log('\n=== ÖZET ===');
  const userCount = await prisma.user.count();
  const provCount = await prisma.serviceProvider.count();
  const provApproved = await prisma.serviceProvider.count({ where: { status: 'approved' } });
  const provPending = await prisma.serviceProvider.count({ where: { status: 'pending' } });
  const servCount = await prisma.service.count();
  const servPublished = await prisma.service.count({ where: { status: 'published' } });
  const servPending = await prisma.service.count({ where: { status: 'pending_approval' } });
  const resCount = await prisma.reservation.count();
  const payCount = await prisma.payment.count();
  const cityCount = await prisma.city.count();
  const catCount = await prisma.category.count();
  const setCount = await prisma.setting.count();
  console.log(`Users:        ${userCount}`);
  console.log(`Providers:    ${provCount} (approved=${provApproved}, pending=${provPending})`);
  console.log(`Services:     ${servCount} (published=${servPublished}, pending=${servPending})`);
  console.log(`Reservations: ${resCount}`);
  console.log(`Payments:     ${payCount}`);
  console.log(`Cities:       ${cityCount}`);
  console.log(`Categories:   ${catCount}`);
  console.log(`Settings:     ${setCount}`);
  console.log('\nSeed tamamlandı.');
  console.log('Demo giriş bilgileri:');
  console.log('  Admin:    admin@turizm-pazaryeri.local / Admin123!');
  console.log('  Provider: provider1@demo.local / Provider123!');
  console.log('  Customer: customer@demo.local / Customer123!');
}

main()
  .catch((err) => {
    console.error('Seed hatası:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
