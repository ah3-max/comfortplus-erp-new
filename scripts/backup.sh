#!/usr/bin/env sh
# ============================================================
# ComfortPlus ERP — 資料庫自動備份腳本
#
# 執行方式（手動）:
#   docker compose --profile backup run --rm backup
#
# 環境變數（由 docker-compose 注入）:
#   PGPASSWORD            DB 密碼
#   POSTGRES_USER         DB 使用者（預設 comfortplus）
#   POSTGRES_DB           DB 名稱（預設 comfortplus_erp）
#   BACKUP_KEEP_DAYS      本地備份保留天數（預設 30）
#   S3_BUCKET             選填：S3 bucket 名稱（不填則只本地備份）
#   AWS_ACCESS_KEY_ID     選填：AWS 存取金鑰
#   AWS_SECRET_ACCESS_KEY 選填：AWS 密鑰
#   AWS_DEFAULT_REGION    選填：AWS 區域（預設 ap-northeast-1）
# ============================================================
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_HOST="postgres"
DB_PORT="5432"
DB_USER="${POSTGRES_USER:-comfortplus}"
DB_NAME="${POSTGRES_DB:-comfortplus_erp}"
BACKUP_DIR="/backups"
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

echo "[$(date)] Starting backup: ${FILENAME}"

# ── 建立備份目錄 ─────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── pg_dump → gzip ───────────────────────────────────────────
pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip -9 > "$FILEPATH"

echo "[$(date)] Backup created: ${FILEPATH} ($(du -sh "$FILEPATH" | cut -f1))"

# ── 上傳 S3（選填）──────────────────────────────────────────
if [ -n "${S3_BUCKET:-}" ]; then
  if command -v aws > /dev/null 2>&1; then
    S3_PATH="s3://${S3_BUCKET}/comfortplus-erp/$(date +%Y/%m)/${FILENAME}"
    echo "[$(date)] Uploading to ${S3_PATH}..."
    aws s3 cp "$FILEPATH" "$S3_PATH" \
      --storage-class STANDARD_IA \
      --quiet
    echo "[$(date)] Upload complete"

    # 清理 S3 舊備份（超過 KEEP_DAYS）
    CUTOFF=$(date -d "-${KEEP_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
             date -v "-${KEEP_DAYS}d" +%Y-%m-%dT%H:%M:%SZ)
    aws s3 ls "s3://${S3_BUCKET}/comfortplus-erp/" --recursive \
      | awk -v cutoff="$CUTOFF" '$1" "$2 < cutoff {print $4}' \
      | while read -r key; do
          echo "[$(date)] Deleting old S3 backup: ${key}"
          aws s3 rm "s3://${S3_BUCKET}/${key}"
        done
  else
    echo "[$(date)] WARNING: S3_BUCKET set but aws CLI not found — skipping S3 upload"
  fi
fi

# ── 清理本地舊備份 ───────────────────────────────────────────
echo "[$(date)] Cleaning local backups older than ${KEEP_DAYS} days..."
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete

REMAINING=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l | tr -d ' ')
echo "[$(date)] Backup complete. Local backups retained: ${REMAINING}"
