# ComfortPlus ERP — 系統架構總覽

> 最後更新：2026-04-07

---

## 目錄

1. [部署架構](#部署架構)
2. [Tech Stack](#tech-stack)
3. [環境變數設定](#環境變數設定)
4. [資料庫結構](#資料庫結構)
5. [API 路由總覽](#api-路由總覽)
6. [Dashboard 頁面](#dashboard-頁面)
7. [認證系統](#認證系統)
8. [AI 整合](#ai-整合)
9. [核心 Library](#核心-library)
10. [角色與資料範圍](#角色與資料範圍)
11. [關鍵業務流程](#關鍵業務流程)

---

## 部署架構

```
瀏覽器 (內網)
    │
    ▼
Nginx :80 / :443          (comfortplus_nginx)
    │  反向代理
    ▼
Next.js App :3000          (comfortplus_app, 對外 :3100)
    │
    ├── Prisma ORM
    │       │
    │       ▼
    │   PostgreSQL :5432    (comfortplus_db, 對外 :5434)
    │
    └── AI Provider
            ├── Ollama :11434  (host.docker.internal，本機 GPU 伺服器)
            └── Anthropic Claude API (雲端備用)
```

### Docker Compose Services

| Container | Image | 對外 Port | 說明 |
|---|---|---|---|
| `comfortplus_nginx` | nginx:alpine | 80, 443 | 反向代理 + SSL |
| `comfortplus_app` | comfortplus-erp | 3100→3000 | Next.js 應用 |
| `comfortplus_db` | postgres:16 | 5434→5432 | 主資料庫 |
| `comfortplus_migrate` | (profile: migrate) | — | 執行 DB migration |
| `comfortplus_backup` | (profile: backup) | — | 每日 02:00 備份 |

### Nginx 設定重點

- 設定檔：`nginx/nginx.conf`
- Upstream：`comfortplus_app:3000`
- Rate limit：30r/s（API 路由，burst 50）
- 上傳限制：10MB
- Security headers：X-Frame-Options、CSP、HSTS 等

---

## Tech Stack

| 分類 | 技術 | 版本 |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.7 |
| UI | React | 19.2.3 |
| 型別 | TypeScript | ^5 |
| 樣式 | Tailwind CSS | ^4 |
| UI 元件 | shadcn/ui (Base UI) | ^1.3.0 |
| 圖表 | Recharts | ^3.8.0 |
| 狀態管理 | Zustand | ^5.0.12 |
| 通知 | Sonner | ^2.0.7 |
| ORM | Prisma | ^7.5.0 |
| DB Driver | @prisma/adapter-pg + pg | ^7.5.0 |
| 資料庫 | PostgreSQL | 16 |
| 認證 | NextAuth | 5.0.0-beta.30 |
| 密碼加密 | bcryptjs | ^3.0.3 |
| AI (本地) | Ollama | — |
| AI (雲端) | Anthropic Claude SDK | ^0.79.0 |
| Excel | ExcelJS | ^4.4.0 |
| PDF | PDFKit | ^0.18.0 |

---

## 環境變數設定

設定檔：`.env.production`（Docker 部署用）、`.env`（本機開發用）

### 必填

| 變數 | 說明 | 範例 |
|---|---|---|
| `POSTGRES_USER` | DB 使用者名稱 | `comfortplus` |
| `POSTGRES_PASSWORD` | DB 密碼 | — |
| `POSTGRES_DB` | 資料庫名稱 | `comfortplus_erp` |
| `DATABASE_URL` | Prisma 連線字串（docker-compose 自動組合） | `postgresql://user:pass@postgres:5432/db` |
| `NEXTAUTH_SECRET` | JWT 簽署密鑰 | 隨機 32+ 字元 |
| `NEXTAUTH_URL` | 應用程式對外 URL | `http://192.168.0.138` |
| `CRON_SECRET` | Cron job Bearer token | 隨機字串 |

### 選填

| 變數 | 說明 |
|---|---|
| `AI_PROVIDER` | `ollama`（預設）或 `anthropic` |
| `OLLAMA_BASE_URL` | Ollama 伺服器位址（預設 `http://host.docker.internal:11434`） |
| `OLLAMA_MODEL` | 模型名稱（預設 `llama3.1:70b`） |
| `ANTHROPIC_API_KEY` | Claude API 金鑰 |
| `LINE_NOTIFY_TOKEN` | LINE Notify 通知 |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Email 通知 |
| `AUTH_TRUST_HOST` | NextAuth 信任 host（Docker 環境設 `true`） |

---

## 資料庫結構

Schema 採模組化管理，分布於 `prisma/schema/` 目錄（44 個檔案，170+ Models）。

> **注意**：請勿修改 `prisma/schema.prisma`（舊版單檔），實際 schema 在 `prisma/schema/` 目錄。

| 檔案 | 模組 | 主要 Models |
|---|---|---|
| `00-config.prisma` | 配置 | generator / datasource |
| `01-enums.prisma` | 列舉 | Role, OrderStatus, CustomerType 等 20+ Enum |
| `02-auth.prisma` | 認證 | User, Department, RolePermission, ApprovalFlow |
| `03-products.prisma` | 商品 | Product, ProductSupplier, ProductBOM, UnitConversion |
| `04-customers.prisma` | 客戶 | Customer, CustomerContact, CustomerUsageProfile, CustomerDeliveryProfile |
| `05-crm.prisma` | CRM | VisitRecord, CallRecord, SampleRecord, ComplaintRecord, SalesOpportunity, SalesTarget, SalesDailyReport |
| `06-sales.prisma` | 銷售 | PriceList, Quotation, QuotationItem, SalesOrder, SalesOrderItem, RecurringOrder |
| `07-inventory.prisma` | 庫存 | Inventory, InventoryTransaction, Warehouse, InboundRecord, OutboundRecord, InventoryLot, StockTransfer, StockCount |
| `08-logistics.prisma` | 物流 | LogisticsProvider, DeliveryTrip, Vehicle, Driver, DeliveryRoute, ProofOfDelivery, ReturnOrder, Shipment |
| `09-procurement.prisma` | 採購 | Supplier, PurchaseOrder, PurchaseReceipt, PackagingMaterial, MaterialShipment |
| `10-finance.prisma` | 財務 | PaymentRecord, AccountsReceivable, Invoice, BillingRequest, ReconciliationStatement, CreditDebitNote |
| `11-qc.prisma` | 品管 | QualityCheck, QcCheckItem, QcDiaperChecklist, QcDefect |
| `12-care.prisma` | 照護 | CareSchedule, ServiceRequest, CareIncident, IncidentAttachment |
| `13-production.prisma` | 生產 | ProductionOrder, SeaFreight |
| `14-channels.prisma` | 通路 | SalesChannel, ChannelOrder, ProductSkuMapping |
| `15-retail.prisma` | 零售 | RetailBrand, RetailOutlet, RetailSalesPlan, RetailEvent |
| `16-system.prisma` | 系統 | SystemConfig, AuditLog, Notification, AlertRule, ExportLog, ImportLog |
| `17-knowledge.prisma` | 知識庫 | KnowledgeBaseEntry, AIQueryLog, DocumentVersion |
| `18-operations.prisma` | 運營 | WorkHandover, SLARule, KPIDefinition |
| `19-calendar.prisma` | 行事曆 | PromoCalendar, BusinessEvent, MeetingRecord |
| `20-sales-invoice.prisma` | 銷貨單 | SalesInvoice, SalesInvoiceItem |
| `21-material-requisition.prisma` | 領料/生產入庫 | MaterialRequisition, ProductionReceipt |
| `22-e-invoice.prisma` | 電子發票 | EInvoice |
| `23-purchase-request.prisma` | 請購/詢價 | PurchaseRequest, RequestForQuotation, RFQItem, RFQSupplier |
| `24-picking-dispatch.prisma` | 理貨派貨 | PickingOrder, DispatchOrder |
| `25-wms.prisma` | WMS | WmsZone, WmsLocation, WmsInventory, WmsInbound, WmsOutbound |
| `26-price-tiers.prisma` | 多級單價 | ProductPriceTier, CustomerPriceLevel, SpecialPrice |
| `27-accounting.prisma` | 會計 | AccountingAccount, FiscalPeriod, JournalEntry, BankAccount, BankTransaction, VatFiling |
| `28-internal-use.prisma` | 內部使用 | InternalUse, DefectiveGoods |
| `29-approval.prisma` | 電子簽核 | ApprovalTemplate, ApprovalRequest, ApprovalStep |
| `30-import-cost.prisma` | 進口費用 | ImportProject, ImportCostItem, ImportPayment, ImportCustoms |
| `31-contracts.prisma` | 合約 | Contract, ContractPaySchedule, ContractRenewal |
| `32-after-sales.prisma` | 售後 | AfterSalesOrder, AfterSalesLog |
| `33-fixed-assets.prisma` | 固定資產 | FixedAsset, FixedAssetDepreciation |
| `34-budget.prisma` | 預算 | Budget, CashFlowPlan |
| `35-expense.prisma` | 費用報銷 | ExpenseReport, ExpenseItem |
| `36-hr.prisma` | 人事 | EmployeeProfile, Appointment, Attendance, PayrollRecord |
| `37-admin.prisma` | 行政 | Announcement, AssetLoan |
| `38-purchase-plan.prisma` | 採購計畫 | PurchasePlan, PurchasePlanItem |
| `39-discount.prisma` | 折扣 | DiscountRule |
| `40-petty-cash.prisma` | 零用金 | PettyCashFund, PettyCashRecord |
| `41-daily-reminder.prisma` | 每日提醒 | DailyReminderLog |
| `42-institution-tour.prisma` | 機構巡迴 | InstitutionTour |
| `43-einvoice-range.prisma` | 發票號碼段 | EInvoiceNumberRange |
| `44-competitor-price.prisma` | 競品價格 | CompetitorPrice |

### 已知技術債

- **三套入庫系統**：`InboundRecord`（海運到倉）/ `WmsInbound`（WMS）/ `ProductionReceipt`（製令），長期目標合併為 `InboundRecord + sourceType`
- **兩套 QC 系統**：`/api/inbound/[id]/qc`（進貨驗收）+ `QualityCheck` model（製令/獨立品檢），長期目標統一為 `QualityCheck + sourceType`

---

## API 路由總覽

所有路由位於 `src/app/api/`，共 390+ 端點。

### 規範

- 所有路由必須有 `auth()` 驗證（除 `/api/health`、`/api/auth/`）
- `/api/cron/*` 用 `CRON_SECRET` Bearer token 認證
- List 回傳格式：`{ data: T[], pagination: { page, pageSize, total, totalPages } }`
- 錯誤處理：`handleApiError(error, 'module.action')`

### 路由群組

| 路由前綴 | 說明 |
|---|---|
| `/api/auth/` | NextAuth 認證（login, reset-password, forgot-password） |
| `/api/customers/` | 客戶管理（CRUD、信用額度、聯絡人、標籤） |
| `/api/orders/` | 訂單管理（CRUD、出貨、退貨分析） |
| `/api/quotations/` | 報價（CRUD、審批、轉換訂單） |
| `/api/sales-orders/` | 銷售訂單（CRUD、邊際率計算） |
| `/api/sales-invoices/` | 銷貨單（CRUD、匯出） |
| `/api/products/` | 商品（CRUD、供應商、SKU 對應） |
| `/api/suppliers/` | 供應商（CRUD、價格歷史、績效） |
| `/api/purchases/` | 採購單（CRUD、收貨） |
| `/api/purchase-requests/` | 請購單 + RFQ |
| `/api/inventory/` | 庫存（CRUD、調整、盤點、轉移、ABC 分析、FIFO 建議） |
| `/api/shipments/` | 出貨單（CRUD、簽收、POD） |
| `/api/picking-orders/` | 理貨單（CRUD、路徑優化、短撿） |
| `/api/dispatch-orders/` | 派貨單（CRUD、容量檢查、打印） |
| `/api/wms/` | WMS（ABC 分析、FIFO 建議、Cycle Count、入出庫） |
| `/api/material-requisitions/` | 領料單 |
| `/api/production-receipts/` | 生產入庫 |
| `/api/finance/` | 財務（50+ 端點，含帳戶、日記帳、銀行、現金流、VAT、試算表、三表） |
| `/api/e-invoices/` | 電子發票（CRUD、作廢、折讓） |
| `/api/approvals/` | 電子簽核（CRUD、流程管理） |
| `/api/crm/` | CRM（拜訪、來電、樣品、客訴、追蹤） |
| `/api/sales-opportunities/` | 銷售機會 |
| `/api/sales-daily-report/` | 業務日報（CRUD、審核） |
| `/api/sales-analysis/` | 銷售分析 |
| `/api/margin/` | 邊際率模擬 |
| `/api/care/` | 照護排程、服務請求 |
| `/api/incidents/` | 事件管理（附件、音頻、訓練日誌） |
| `/api/vehicles/` | 車輛管理（CRUD、保養、檢查） |
| `/api/calendar/` | 行事曆 |
| `/api/business-events/` | 業務活動 |
| `/api/meeting-records/` | 會議記錄（音頻、轉錄、行動項目） |
| `/api/dashboard/` | 各角色 Dashboard 資料（sales, finance, procurement, warehouse, sales-manager） |
| `/api/ai/` | AI 功能（chat, analyze, health, skills） |
| `/api/cron/` | 定時任務（daily-reminder, tour-reminder, auto-schedule-tours） |
| `/api/users/` | 使用者管理（CRUD、revoke-sessions） |
| `/api/settings/` | 系統設定（audit-log、security-check） |
| `/api/notifications/` | 通知（CRUD、推送） |
| `/api/upload/` | 檔案上傳（JPEG/PNG/WebP/HEIC，最大 10MB） |
| `/api/webhooks/line/` | LINE Bot Webhook |
| `/api/health` | 健康檢查（無須認證） |

---

## Dashboard 頁面

頁面位於 `src/app/(dashboard)/`，共 166 個頁面。

| 模組 | 頁面 |
|---|---|
| 銷售 | orders, quotations, sales-invoices, sales-opportunities, sales-returns, sales-daily-report, sales-analysis, salesperson-performance |
| 庫存物流 | inventory, shipments, delivery-trips, picking-dispatch, wms, stock-counts, warehouses |
| 財務 | 帳戶管理、日記帳、銀行帳戶、現金簿、現金流、資產負債表、損益表、VAT、試算表、應收應付、發票、支付、收據、成本/毛利分析、每月銷售/採購報表 |
| 採購 | purchase-orders, purchase-requests, rfq, suppliers, sea-freight, purchase-returns, purchase-plans |
| CRM & 客戶 | customers, customer-tags, follow-up, complaints, samples, visits, calls, key-accounts, health-score |
| 生產/品管 | production, material-requisitions, qc, defective-goods, internal-use, production-receipts |
| 系統管理 | users, settings, audit-log, announcements, calendar, tasks, business-events, incidents |

---

## 認證系統

設定檔：`src/auth.ts`

| 項目 | 設定 |
|---|---|
| Provider | Credentials（Email/Password）+ Google OAuth（選填） |
| Session 類型 | JWT |
| Session 最長 | 8 小時 |
| Access Token 有效 | 15 分鐘 |
| Token 自動延展 | 剩餘 < 5 分鐘時自動展延（Sliding Window） |
| Token 撤銷 | `tokenVersion` 遞增，立即失效所有 session |
| 密碼加密 | bcryptjs |
| AUTH_TRUST_HOST | Docker 部署需設為 `true` |

---

## AI 整合

設定檔：`src/lib/ai.ts`、`src/lib/ai-skills.ts`

### Provider 設定

| Provider | 觸發條件 | 說明 |
|---|---|---|
| Ollama | `AI_PROVIDER=ollama`（預設） | 本機 GPU 伺服器，`host.docker.internal:11434` |
| Anthropic Claude | `AI_PROVIDER=anthropic` | 雲端備用，需 `ANTHROPIC_API_KEY` |

### AI Skills（`src/lib/ai-skills.ts`）

AI 可執行的 ERP 操作，以中文關鍵字觸發意圖辨識：

- 報價建立/查詢
- 出貨建立/查詢
- 庫存查詢/調整
- KPI 查詢與分析

### API 端點

| 端點 | 說明 |
|---|---|
| `POST /api/ai/chat` | 對話（帶 ERP 上下文） |
| `POST /api/ai/analyze` | 資料分析 |
| `GET /api/ai/health` | AI 服務狀態 |
| `POST /api/ai/skills` | 執行 AI Skill |

---

## 核心 Library

位於 `src/lib/`：

| 檔案 | 用途 |
|---|---|
| `prisma.ts` | Prisma Client 初始化（單例） |
| `api-error.ts` | API 統一錯誤處理（`handleApiError`） |
| `auth.ts` | NextAuth 設定 |
| `scope.ts` | 角色資料範圍過濾（SALES 只看自己的訂單） |
| `audit.ts` | 稽核日誌寫入 |
| `logger.ts` | 結構化日誌（生產環境隱藏 stack trace） |
| `notify.ts` | 多通路通知（系統 / LINE / Email） |
| `rate-limit.ts` | API Rate limiter |
| `sequence.ts` | 單號產生器（訂單號、出貨號等） |
| `kpi-check.ts` | KPI 里程碑自動通知（50/80/100%） |
| `auto-journal.ts` | 自動化日記帳分錄 |
| `gross-margin.ts` | 毛利計算 |
| `health-score.ts` | 客戶健康度評分 |
| `order-prediction.ts` | 訂單預測 |
| `line-messaging.ts` | LINE Messaging API |
| `upload.ts` | 檔案上傳（JPEG/PNG/WebP/HEIC，10MB 上限） |
| `encryption.ts` | 加密工具 |
| `utils.ts` | 通用工具函式 |
| `ai.ts` | AI Provider 抽象層 |
| `ai-skills.ts` | AI Skill 定義 |
| `i18n/` | 國際化（zh-TW / en / th） |

---

## 角色與資料範圍

11 個角色，資料範圍由 `src/lib/scope.ts` 控制：

| 角色 | Dashboard | 資料範圍 |
|---|---|---|
| SUPER_ADMIN | 全局 | 所有資料 |
| GM | 全局 | 所有資料 |
| SALES_MANAGER | 團隊管理 | 所有業務員資料 |
| SALES | 個人工作台 | 自己的訂單/客戶/報價 |
| CS | 個人工作台 | 客服相關 |
| CARE_SUPERVISOR | 個人工作台 | 照護相關 |
| WAREHOUSE_MANAGER | 倉儲管理台 | 所有倉儲資料 |
| WAREHOUSE | 倉儲作業台 | 倉儲操作 |
| FINANCE | 財務工作台 | 財務相關 |
| PROCUREMENT | 採購工作台 | 採購相關 |
| ECOMMERCE | GM 視角 | Phase 2 獨立 |

---

## 關鍵業務流程

### 銷售

```
客戶建立 → 拜訪/樣品 → 機會管理 → 報價 → 審批
    → 訂單確認（自動建銷貨單）→ 理貨 → 派貨 → 出貨 → 簽收（POD）
```

- 訂單確認時用 `SELECT FOR UPDATE` 行級鎖防止超賣
- 建單後自動觸發 `checkKpiMilestone()`

### 採購

```
請購單 → 詢價（RFQ）→ 採購單 → 收貨 → 品檢（QC）→ 入庫
```

### 庫存

```
入庫（InboundRecord）→ WMS 整理（WmsInbound）→ 庫存管理
    → 出庫（OutboundRecord）→ 配送（Shipment）
```

### 財務

```
銷售/採購事件 → 自動日記帳（auto-journal.ts）→ VAT 計算
    → 帳務結帳 → 三表（損益表、資產負債表、現金流量表）
```

### SalesOrder vs SalesInvoice

- `SalesOrder`：商務合約（確認客戶、金額、條件）
- `SalesInvoice`：出庫憑證（實際出倉記錄，可多次分批出貨）
- 訂單 CONFIRMED → 自動建立 SalesInvoice

---

## 統計

| 類別 | 數量 |
|---|---|
| Schema 檔案 | 44 |
| Database Models | 170+ |
| API 端點 | 390+ |
| Dashboard 頁面 | 166 |
| 核心 Library | 21 個檔案 |
| 支援語言 | zh-TW / en / th |
| 系統角色 | 11 個 |
