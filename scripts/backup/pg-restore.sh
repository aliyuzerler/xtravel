#!/usr/bin/env bash
#
# PostgreSQL restore script.
#
# Kullanım:
#   ./scripts/backup/pg-restore.sh <backup-file>
#   ./scripts/backup/pg-restore.sh latest  # en son yedeği restore et
#
# ÖNEMLİ: Bu script mevcut DB'deki tüm verileri siler ve yedeği yükler.
#         Production'da dikkatli kullanın!
#
set -euo pipefail

# === Parametre kontrolü ===
if [ $# -lt 1 ]; then
  echo "Kullanım: $0 <backup-file.sql.gz|latest>"
  echo "Örnek:    $0 /var/backups/turizm-pazaryeri/db-20250115-020000.sql.gz"
  echo "          $0 latest"
  exit 1
fi

BACKUP_INPUT="$1"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_DATABASE="${PG_DATABASE:-turizm_pazaryeri}"
PG_USER="${PG_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/turizm-pazaryeri}"

# latest ise en son yedeği bul
if [ "${BACKUP_INPUT}" = "latest" ]; then
  BACKUP_INPUT=$(ls -t "${BACKUP_DIR}"/${PG_DATABASE}-*.sql.gz 2>/dev/null | head -1)
  if [ -z "${BACKUP_INPUT}" ]; then
    echo "✗ Hiç yedek bulunamadı: ${BACKUP_DIR}/${PG_DATABASE}-*.sql.gz"
    exit 1
  fi
fi

if [ ! -f "${BACKUP_INPUT}" ]; then
  echo "✗ Yedek dosyası bulunamadı: ${BACKUP_INPUT}"
  exit 1
fi

echo "=== PostgreSQL Restore ==="
echo "Database: ${PG_DATABASE}@${PG_HOST}:${PG_PORT}"
echo "Backup:   ${BACKUP_INPUT}"
echo "Size:     $(du -h ${BACKUP_INPUT} | cut -f1)"
echo ""

# === Onay ===
read -p "Bu işlem tüm mevcut verileri silecek ve yedeği yükleyecek. Emin misiniz? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
  echo "İptal edildi."
  exit 0
fi

# === Mevcut DB yedeğini al (rollback için) ===
PRE_RESTORE_BACKUP="${BACKUP_DIR}/${PG_DATABASE}-pre-restore-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "→ Mevcut DB'nin yedeği alınıyor (rollback için): ${PRE_RESTORE_BACKUP}"
PGPASSWORD="${PG_PASSWORD}" pg_dump \
  --host="${PG_HOST}" --port="${PG_PORT}" --username="${PG_USER}" \
  --dbname="${PG_DATABASE}" --format=custom --no-owner --no-privileges --compress=9 \
  --file="${PRE_RESTORE_BACKUP}" 2>/dev/null || echo "  (DB boş olabilir, atlanıyor)"

# === Restore ===
echo "→ Restore başlıyor..."
PGPASSWORD="${PG_PASSWORD}" pg_restore \
  --host="${PG_HOST}" \
  --port="${PG_PORT}" \
  --username="${PG_USER}" \
  --dbname="${PG_DATABASE}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  "${BACKUP_INPUT}" 2>&1 | tail -50

if [ $? -ne 0 ]; then
  echo "✗ Restore failed!"
  echo "  Rollback için: $0 ${PRE_RESTORE_BACKUP}"
  exit 1
fi

echo ""
echo "=== Restore Tamamlandı ==="
echo "  Database: ${PG_DATABASE}"
echo "  Backup:   ${BACKUP_INPUT}"
echo "  Rollback: ${PRE_RESTORE_BACKUP}"
echo ""
echo "Sonraki adımlar:"
echo "  1. Prisma client'ı yeniden generate edin: cd apps/api && npx prisma generate"
echo "  2. API'yi yeniden başlatın"
echo "  3. Smoke test: curl http://localhost:3000/api/health"
echo "  4. Migration kontrolü: cd apps/api && npx prisma migrate status"
