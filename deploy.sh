#!/usr/bin/env bash
# ============================================================
# ComfortPlus ERP — 部署腳本
# 用法: ./deploy.sh [build|up|down|logs|migrate|seed|restart]
# ============================================================
set -euo pipefail

COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.production"

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
        err "  cp .env.production.example .env.production"
        exit 1
    fi
}

# ── 指令 ─────────────────────────────────────────────────────
cmd_build() {
    log "Building Docker images..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache
    log "Build 完成"
}

cmd_up() {
    log "Starting services..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    log "等待服務啟動..."
    sleep 5

    # 執行 Prisma DB push
    log "同步資料庫 schema..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm migrate
    log "所有服務已啟動"
    echo ""
    log "存取 ERP: http://localhost"
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
    log "執行資料庫 schema 同步..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm migrate
    log "Schema 同步完成"
}

cmd_seed() {
    log "建立測試資料..."
    docker compose -f "$COMPOSE_FILE" exec nextjs npx tsx prisma/seed.ts
    log "測試資料建立完成"
}

cmd_restart() {
    log "Restarting services..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart
    log "已重啟"
}

cmd_status() {
    docker compose -f "$COMPOSE_FILE" ps
}

# ── Main ─────────────────────────────────────────────────────
check_deps

case "${1:-help}" in
    build)   cmd_build ;;
    up)      cmd_build && cmd_up ;;
    down)    cmd_down ;;
    logs)    cmd_logs "$@" ;;
    migrate) cmd_migrate ;;
    seed)    cmd_seed ;;
    restart) cmd_restart ;;
    status)  cmd_status ;;
    *)
        echo "ComfortPlus ERP 部署腳本"
        echo ""
        echo "用法: $0 <command>"
        echo ""
        echo "指令:"
        echo "  build    僅 build Docker images"
        echo "  up       Build + 啟動所有服務 + 同步 DB schema"
        echo "  down     停止所有服務"
        echo "  logs     查看 logs（可指定服務: logs nextjs）"
        echo "  migrate  同步資料庫 schema（prisma db push）"
        echo "  seed     建立測試資料"
        echo "  restart  重啟所有服務"
        echo "  status   查看服務狀態"
        ;;
esac
