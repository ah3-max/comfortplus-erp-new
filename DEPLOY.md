# ComfortPlus ERP — 部署指南

## 環境需求

| 項目 | 版本 |
|------|------|
| Node.js | 20+ |
| PostgreSQL | 16+ |
| Docker | 24+ (optional) |
| npm | 10+ |

---

## 快速部署（5 步驟）

### 1. 資料庫

```bash
# 使用 Docker (推薦)
docker compose up -d

# 或連接現有 PostgreSQL
# 修改 .env 中的 DATABASE_URL
```

### 2. 環境變數

```bash
cp .env.example .env
# 編輯 .env，至少填入：
#   DATABASE_URL
#   NEXTAUTH_SECRET  (用 openssl rand -base64 32 產生)
#   NEXTAUTH_URL     (部署網址，如 https://erp.comfortplus.com)
#   CRON_SECRET      (用 openssl rand -hex 16 產生)
#   AI_PROVIDER      (anthropic 或 ollama)
```

### 3. 初始化資料庫

```bash
npm install
npx prisma db push          # 同步 schema
npx tsx prisma/seed.ts       # 建立預設帳號和測試資料
```

### 4. 啟動

```bash
# 開發模式
npm run dev

# 正式環境
npm run build
npm start
```

### 5. 驗證

```bash
# 健康檢查
curl http://localhost:3001/api/health

# 預期回傳：
# {"status":"ok","version":"1.0.0","db":true,"dbLatencyMs":2,...}
```

---

## 預設帳號

| 帳號 | 密碼 | 角色 |
|------|------|------|
| admin@comfortplus.com | admin1234 | 超級管理員 |
| gm@comfortplus.com | gm12345678 | 總經理 |
| manager@comfortplus.com | manager1234 | 業務主管 |
| sales@comfortplus.com | sales1234 | 業務專員 |
| warehouse@comfortplus.com | warehouse1234 | 倉管人員 |
| finance@comfortplus.com | finance1234 | 財務人員 |
| procurement@comfortplus.com | procurement1234 | 採購人員 |

> **正式上線前請修改所有預設密碼**

---

## 環境變數清單

### 必填

| 變數 | 說明 | 範例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 連線字串 | `postgresql://user:pass@host:5434/db` |
| `NEXTAUTH_SECRET` | JWT 簽署密鑰 | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 系統網址 | `https://erp.comfortplus.com` |
| `CRON_SECRET` | 定時任務認證 | `openssl rand -hex 16` |
| `AI_PROVIDER` | AI 提供者 | `anthropic` 或 `ollama` |

### 選填

| 變數 | 說明 |
|------|------|
| `ANTHROPIC_API_KEY` | Claude API Key（AI_PROVIDER=anthropic 時需要） |
| `OLLAMA_BASE_URL` | Ollama 伺服器 URL（預設 localhost:11434） |
| `OLLAMA_MODEL` | Ollama 模型名稱（預設 llama3.1:70b） |
| `LINE_NOTIFY_TOKEN` | LINE 通知 Token |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email SMTP |

---

## 定時任務設定

### 方法 A：系統 crontab

```bash
# 每天早上 8:00 執行
0 8 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3001/api/cron
```

### 方法 B：Vercel Cron（如部署在 Vercel）

建立 `vercel.json`：
```json
{
  "crons": [{
    "path": "/api/cron",
    "schedule": "0 0 * * *"
  }]
}
```

### 定時任務內容

| 任務 | 說明 |
|------|------|
| 報價過期 | 超過 validUntil 的報價自動標為 EXPIRED |
| 即將到期提醒 | 3 天內到期的報價通知業務 |
| 低庫存警報 | quantity ≤ safetyStock 通知主管 |
| 逾期帳款 | 60+ 天未收款通知主管 |

---

## LINE 通知設定

1. 到 https://notify-bot.line.me/ 登入
2. 點「Generate token」
3. 選擇要推播的群組
4. 將 token 填入 `.env` 的 `LINE_NOTIFY_TOKEN`
5. 重啟服務

觸發時機：出貨送達拍照、KPI 達標、低庫存警報

---

## Ollama AI 設定（Dell 770 伺服器）

```bash
# 在 Dell 770 上安裝 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 下載模型（2x RTX PRO 6000 96GB 可跑 70B+）
ollama pull qwen2.5:72b     # 中文最佳
ollama pull llama3.1:70b    # 通用

# 啟動（允許外部連線）
OLLAMA_HOST=0.0.0.0 ollama serve

# 在 ERP .env 中設定
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://192.168.x.x:11434"
OLLAMA_MODEL="qwen2.5:72b"
```

---

## 常見問題

### DB 連不上
```bash
docker compose ps          # 確認 container 正在運行
docker compose logs postgres  # 查看 DB 日誌
```

### Migration 失敗
```bash
npx prisma db push --accept-data-loss   # 強制同步 schema
npx prisma migrate resolve --applied MIGRATION_NAME  # 標記已 apply
```

### AI 小幫手無回應
1. 確認 `AI_PROVIDER` 設定正確
2. 如用 Anthropic：確認 `ANTHROPIC_API_KEY` 已設定
3. 如用 Ollama：確認 `OLLAMA_BASE_URL` 可連線
4. 到 `/settings/ai` 頁面測試連線

### 手機連不上
1. 確認手機和伺服器在同一網路
2. 用 `ifconfig` 查伺服器 IP
3. 手機瀏覽器輸入 `http://IP:3001`
4. Mac 防火牆需允許 port 3001

### 上傳照片失敗
- 檔案上限 10MB
- 支援格式：JPEG、PNG、WebP、HEIC
- 確認 `public/uploads/` 目錄有寫入權限
