/**
 * Faz-1 Seed scripti
 *
 * Çalıştırma: cd apps/api && npm run seed
 *
 * İçerik:
 *   1) 1 admin kullanıcı (email: admin@turizm-pazaryeri.local, şifre: Admin123!)
 *   2) 81 Türkiye ili
 *   3) 6 kategori (Kültür Turu, Gemi Turu, Yemek Turu, Doğa Yürüyüşü, Müze Gezisi, Şehir Turu)
 *   4) Birkaç default setting (commission_rate, cancel_policy_hours)
 *
 * Idempotent: var olan kayıtları atlar (upsert kullanır).
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

async function main() {
  console.log('=== FAZ-1 SEED BAŞLIYOR ===\n');

  // 1) Admin kullanıcı
  const adminEmail = 'admin@turizm-pazaryeri.local';
  const adminPassword = 'Admin123!';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingAdmin) {
    console.log(`1) Admin zaten mevcut (id=${existingAdmin.id})`);
  } else {
    const hash = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hash,
        fullName: 'Platform Admin',
        role: 'super_admin',
        status: 'active',
      },
    });
    console.log(`1) Admin oluşturuldu: ${admin.email} (id=${admin.id})`);
    console.log(`   Şifre: ${adminPassword} (üretimde değiştirin!)`);
  }

  // 2) 81 İl
  let citiesCreated = 0;
  let citiesSkipped = 0;
  for (const name of TURKISH_CITIES) {
    const slug = slugify(name);
    const created = await prisma.city.upsert({
      where: { slug },
      update: {},
      create: { name, slug, isActive: true },
    });
    if (created) {
      // upsert update:{} olduğu için created event her zaman dönmüyor;
      // count'u basit tutmak için created vs existing ayrımı yapmayalım
      citiesCreated++;
    } else {
      citiesSkipped++;
    }
  }
  const totalCities = await prisma.city.count();
  console.log(`2) Şehirler: toplam ${totalCities} (81 bekleniyor)`);

  // 3) 6 Kategori
  for (const cat of CATEGORIES) {
    const slug = slugify(cat.name);
    await prisma.category.upsert({
      where: { slug },
      update: { iconName: cat.iconName, sortOrder: cat.sortOrder },
      create: {
        name: cat.name,
        slug,
        iconName: cat.iconName,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    });
  }
  const totalCategories = await prisma.category.count();
  console.log(`3) Kategoriler: toplam ${totalCategories} (6 bekleniyor)`);

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
  const totalSettings = await prisma.setting.count();
  console.log(`4) Ayarlar: toplam ${totalSettings}`);

  // Özet
  console.log('\n=== ÖZET ===');
  console.log(`Admin: ${adminEmail}`);
  console.log(`Şehirler: ${totalCities}`);
  console.log(`Kategoriler: ${totalCategories}`);
  console.log(`Ayarlar: ${totalSettings}`);
  console.log('\nSeed tamamlandı.');
}

main()
  .catch((err) => {
    console.error('Seed hatası:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
