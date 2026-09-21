# Backup & Restore — PostgreSQL

## Günlük Yedek

### Crontab kurulumu

```bash
# Crontab'ı düzenle
sudo crontab -e

# Gece 02:00'da yedek al
0 2 * * * /opt/turizm-pazaryeri/scripts/backup/pg-backup.sh >> /var/log/pg-backup.log 2>&1
```

### Manuel yedek

```bash
# Ortam değişkenleri
export PG_HOST=your-db-host
export PG_PORT=5432
export PG_DATABASE=turizm_pazaryeri
export PG_USER=postgres
export PG_PASSWORD=your-password
export BACKUP_DIR=/var/backups/turizm-pazaryeri
export RETENTION_DAYS=30
export S3_BUCKET=your-s3-bucket  # opsiyonel

# Çalıştır
./scripts/backup/pg-backup.sh
```

### S3'e otomatik yükleme

`S3_BUCKET` ortam değişkeni tanımlıysa, yedekler S3'e de yüklenir:
- Bucket: `s3://your-bucket/db/`
- Storage class: `STANDARD_IA` (düşük maliyet)
- AWS CLI gerekli: `pip install awscli`

---

## Restore

### En son yedeği restore et

```bash
./scripts/backup/pg-restore.sh latest
```

### Belirli bir yedeği restore et

```bash
./scripts/backup/pg-restore.sh /var/backups/turizm-pazaryeri/db-20250115-020000.sql.gz
```

### Restore adımları

Script otomatik olarak:
1. Mevcut DB'nin yedeğini alır (rollback için)
2. Yedeği restore eder
3. Rollback dosyasının yolunu gösterir

Restore sonrası:
```bash
# Prisma client'ı yeniden generate et
cd apps/api && npx prisma generate

# Migration kontrolü
npx prisma migrate status

# API'yi yeniden başlat
pm2 restart api

# Smoke test
curl http://localhost:3000/api/health
```

---

## Disaster Recovery Planı

### Senaryo 1: DB çöktü, son yedekten dönülecek

```bash
# 1. Yeni DB sunucusu kur
# 2. Yeni DB'ye connect ol
# 3. Restore çalıştır
./scripts/backup/pg-restore.sh latest

# 4. API'yi yeni DB'ye yönlendir (DATABASE_URL güncelle)
# 5. API'yi yeniden başlat
# 6. Smoke test
```

### Senaryo 2: Veri bozulması, 3 gün öncesine dönülecek

```bash
# 1. İlgili tarihteki yedeği bul
ls /var/backups/turizm-pazaryeri/ | grep 20250112

# 2. Restore
./scripts/backup/pg-restore.sh /var/backups/turizm-pazaryeri/turizm_pazaryeri-20250112-020000.sql.gz
```

### Senaryo 3: Tüm sunucu kaybı

1. Yeni sunucu kur
2. Repository clone: `git clone https://github.com/.../turizm-pazaryeri.git`
3. `.env` dosyasını secrets manager'dan çek
4. S3'ten son yedeği indir:
   ```bash
   aws s3 cp s3://your-bucket/db/turizm_pazaryeri-latest.sql.gz /tmp/
   ```
5. PostgreSQL kur, DB oluştur
6. Restore çalıştır
7. Uygulamayı başlat

---

## Test (Restore doğrulaması)

Aylık restore testi önerilir:

```bash
# Test DB'sine restore (production DB'sine dokunmadan)
export PG_DATABASE=turizm_pazaryeri_test
./scripts/backup/pg-restore.sh latest

# Veri sayılarını kontrol et
psql -d turizm_pazaryeri_test -c "
  SELECT 'users' as t, count(*) FROM users
  UNION ALL SELECT 'services', count(*) FROM services
  UNION ALL SELECT 'reservations', count(*) FROM reservations
  UNION ALL SELECT 'payments', count(*) FROM payments;
"

# Test DB'sini sil
dropdb turizm_pazaryeri_test
```

---

## Monitoring

Yedekleme başarısını izlemek için:

```bash
# Son yedek zamanı
stat /var/backups/turizm-pazaryeri/turizm-pazaryeri-latest.sql.gz | grep Modify

# Disk kullanımı
du -sh /var/backups/turizm-pazaryeri/

# Cron log'ları
tail -50 /var/log/pg-backup.log
```

### Alert (Opsiyonel)

```bash
# Başarısız yedek için email alert
if ! ./scripts/backup/pg-backup.sh; then
  echo "BACKUP FAILED!" | mail -s "URGENT: Backup failed" ops@turizmpazaryeri.com
fi
```
