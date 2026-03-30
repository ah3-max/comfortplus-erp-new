#!/usr/bin/env bash
# ============================================================
# ComfortPlus ERP — 部署腳本
# 用法: ./deploy.sh [build|up|down|logs|migrate|seed|restart|backup|ssl-init]
# ============================================================
set -euo pipefail

COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.production"
APP_VERSION="${APP_VERSION:-$(git describe --tags --always 2>/dev/null || echo 'latest')}"

# 顏色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[error]${NC} $*" >&2; }

# ── 前置檢查 ─────────────────────────────────────────────────
check_deps() {
    for cmd in docker; do
        if ! command -v "$cmd" &> /dev/null; then
            err "$cmd 未安裝，請先安裝"
            exit 1
        fi
    done

    if [ ! -f "$ENV_FILE" ]; then
        err "$ENV_FILE 不存在，請從範本建立："
        err "  cp .env.example .env.production"
        err "  # 填入所有必填項目後再執行"
        exit 1
    fi
}

# ── 指令 ─────────────────────────────────────────────────────
cmd_build() {
    log "Building Docker image (version: ${APP_VERSION})..."
    APP_VERSION="$APP_VERSION" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache
    # Tag image with version for rollback support
    docker tag "comfortplus-erp:${APP_VERSION}" "comfortplus-erp:$(date +%Y%m%d)" 2>/dev/null || true
    log "Build 完成 → comfortplus-erp:${APP_VERSION}"
}

cmd_up() {
    log "Starting services (version: ${APP_VERSION})..."
    APP_VERSION="$APP_VERSION" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres
    log "等待資料庫啟動..."
    sleep 3

    # 執行 Prisma migrate deploy（正式環境使用 migrate deploy，不用 db push）
    log "執行資料庫 migration..."
    cmd_migrate

    log "啟動所有服務..."
    APP_VERSION="$APP_VERSION" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    log "所有服務已啟動"
    echo ""
    log "存取 ERP: https://your-domain.com (HTTPS) 或 http://localhost (HTTP→HTTPS redirect)"
    echo ""
    docker compose -f "$COMPOSE_FILE" ps
}

cmd_down() {
    log "Stopping services..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    log "已停止"
}

cmd_logs() {
    docker compose -f "$COMPOSE_FILE" logs -f "${2:-}"
}

cmd_migrate() {
    log "執行資料庫 migration（prisma migrate deploy）..."
    APP_VERSION="$APP_VERSION" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
      --profile migrate run --rm migrate
    log "Migration 完成"
}

cmd_seed() {
    log "建立測試資料..."
    docker compose -f "$COMPOSE_FILE" exec nextjs npx tsx prisma/seed.ts
    log "測試資料建立完成"
}

cmd_restart() {
    log "Restarting services..."
    APP_VERSION="$APP_VERSION" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart
    log "已重啟"
}

cmd_status() {
    docker compose -f "$COMPOSE_FILE" ps
}

cmd_backup() {
    log "執行手動備份..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
      --profile backup run --rm backup /backup.sh
    log "備份完成。備份檔案在 backup_data volume 內。"
    log "查看備份: docker run --rm -v comfortplus-erp_backup_data:/backups alpine ls -lh /backups"
}

cmd_ssl_init() {
    # 建立 nginx/ssl 目錄與自簽憑證（僅供開發/測試）
    # 正式環境請改用 Let's Encrypt (certbot)
    log "初始化 SSL 憑證目錄..."
    mkdir -p nginx/ssl

    if [ -f "nginx/ssl/fullchain.pem" ]; then
        warn "nginx/ssl/fullchain.pem 已存在，跳過"
        return
    fi

    if command -v openssl &> /dev/null; then
        log "產生自簽憑證（開發用）..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/privkey.pem \
            -out nginx/ssl/fullchain.pem \
            -subj "/CN=comfortplus-erp/O=ComfortPlus/C=TW" \
            2>/dev/null
        log "自簽憑證已建立：nginx/ssl/fullchain.pem"
        warn "注意：自簽憑證僅供開發測試。正式環境請使用 Let's Encrypt:"
        warn "  certbot certonly --webroot -w /var/www/html -d your-domain.com"
        warn "  cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/"
        warn "  cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/"
    else
        warn "openssl 未安裝，請手動將 SSL 憑證放到 nginx/ssl/:"
        warn "  nginx/ssl/fullchain.pem  （憑證鏈）"
        warn "  nginx/ssl/privkey.pem    （私鑰）"
    fi
}

cmd_rollback() {
    local version="${2:-}"
    if [ -z "$version" ]; then
        log "可用的 Docker images:"
        docker images comfortplus-erp --format "{{.Tag}}\t{{.CreatedAt}}" | sort -r | head -10
        echo ""
        err "請指定版本: ./deploy.sh rollback <version>"
        err "例如: ./deploy.sh rollback 20240115"
        exit 1
    fi
    log "回溯到版本: comfortplus-erp:${version}"
    APP_VERSION="$version" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d nextjs
    log "回溯完成"
}

# ── Main ─────────────────────────────────────────────────────
check_deps

case "${1:-help}" in
    build)    cmd_build ;;
    up)       cmd_build && cmd_up ;;
    down)     cmd_down ;;
    logs)     cmd_logs "$@" ;;
    migrate)  cmd_migrate ;;
    seed)     cmd_seed ;;
    restart)  cmd_restart ;;
    status)   cmd_status ;;
    backup)   cmd_backup ;;
    ssl-init) cmd_ssl_init ;;
    rollback) cmd_rollback "$@" ;;
    *)
        echo "ComfortPlus ERP 部署腳本"
        echo ""
        echo "用法: $0 <command>"
        echo ""
        echo "指令:"
        echo "  build       僅 build Docker image（附版本 tag）"
        echo "  up          Build + 啟動所有服務 + 執行 DB migration"
        echo "  down        停止所有服務"
        echo "  logs        查看 logs（可指定服務: logs nextjs）"
        echo "  migrate     執行資料庫 migration（prisma migrate deploy）"
        echo "  seed        建立測試資料"
        echo "  restart     重啟所有服務"
        echo "  status      查看服務狀態"
        echo "  backup      手動觸發資料庫備份"
        echo "  ssl-init    初始化 SSL 憑證（開發用自簽，或設定 Let's Encrypt）"
        echo "  rollback    回溯到指定版本（例: rollback 20240115）"
        echo ""
        echo "版本標籤: APP_VERSION=1.2.3 ./deploy.sh build"
        ;;
esac
