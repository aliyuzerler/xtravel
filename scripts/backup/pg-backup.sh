#!/usr/bin/env bash
#
# PostgreSQL günlük yedek scripti.
#
# Kullanım:
#   ./scripts/backup/pg-backup.sh
#
# Crontab ile günlük çalıştırma (gece 02:00):
#   0 2 * * * /opt/turizm-pazaryeri/scripts/backup/pg-backup.sh >> /var/log/pg-backup.log 2>&1
#
# Ortam değişkenleri (.env veya export ile):
#   PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
#   BACKUP_DIR (varsayılan: /var/backups/turizm-pazaryeri)
#   S3_BUCKET (opsiyonel — S3'e de yükle)
#   RETENTION_DAYS (varsayılan: 30)
#
set -euo pipefail

# === Konfigürasyon ===
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_DATABASE="${PG_DATABASE:-turizm_pazaryeri}"
PG_USER="${PG_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/turizm-pazaryeri}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${PG_DATABASE}-${TIMESTAMP}.sql.gz"
LATEST_FILE="${BACKUP_DIR}/${PG_DATABASE}-latest.sql.gz"

echo "=== PostgreSQL Backup ==="
echo "Database: ${PG_DATABASE}@${PG_HOST}:${PG_PORT}"
echo "Output:   ${BACKUP_FILE}"
echo "Time:     $(date)"
echo ""

# === Dizin hazırlığı ===
mkdir -p "${BACKUP_DIR}"

# === Yedek al ===
echo "→ Dumping database..."
PGPASSWORD="${PG_PASSWORD}" pg_dump \
  --host="${PG_HOST}" \
  --port="${PG_PORT}" \
  --username="${PG_USER}" \
  --dbname="${PG_DATABASE}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --compress=9 \
  --file="${BACKUP_FILE}"

if [ $? -ne 0 ]; then
  echo "✗ Backup failed!"
  exit 1
fi

# === latest symlink ===
ln -sf "${BACKUP_FILE}" "${LATEST_FILE}"

# === Boyut göster ===
SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✓ Backup completed: ${SIZE}"

# === S3'e yükle (opsiyonel) ===
if [ -n "${S3_BUCKET}" ]; then
  if command -v aws &> /dev/null; then
    echo "→ Uploading to S3..."
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/db/$(basename ${BACKUP_FILE})" \
      --storage-class STANDARD_IA
    echo "✓ S3 upload completed"
  else
    echo "⚠️  aws CLI not found, skipping S3 upload"
  fi
fi

# === Eski yedekleri temizle (retention) ===
echo "→ Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${PG_DATABASE}-*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "${PG_DATABASE}-*.sql.gz" -type f -mtime +${RETENTION_DAYS} | wc -l)
echo "✓ Deleted ${DELETED_COUNT} old backups"

# === Özet ===
TOTAL_COUNT=$(find "${BACKUP_DIR}" -name "${PG_DATABASE}-*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
echo ""
echo "=== Backup Summary ==="
echo "  New backup: ${BACKUP_FILE} (${SIZE})"
echo "  Total backups: ${TOTAL_COUNT}"
echo "  Total size: ${TOTAL_SIZE}"
echo "  Retention: ${RETENTION_DAYS} days"
echo "  Timestamp: $(date)"
echo "=== Done ==="
