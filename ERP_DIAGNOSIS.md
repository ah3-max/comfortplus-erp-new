# ComfortPlus ERP — 系統診斷報告

> 診斷日期：2026-04-23
> 掃描範圍：44 schema（7,081 行）/ 417 API routes（47,214 行）/ 179 pages / 170,547 行 TypeScript

---

## 目錄

1. [模組清單](#1-模組清單)
2. [核心流程檢查](#2-核心流程檢查)
3. [角色權限矩陣](#3-角色權限矩陣)
4. [複雜度評估與簡化建議](#4-複雜度評估與簡化建議)
5. [上線前必做 vs 可以之後做](#5-上線前必做-vs-可以之後做)
6. [業務極簡操作路徑](#6-業務極簡操作路徑)
7. [已知 Bug / 風險](#7-已知-bug--風險)

---

## 1. 模組清單

### 1.1 核心營運模組（Day 1 必需）

| # | 模組 | 功能說明 | 頁面數 | API 數 | 完成度 | 備註 |
|---|------|----------|--------|--------|--------|------|
| 1 | **客戶管理** | B2B 機構客戶 CRUD、信用額度、聯絡人、健康度、標籤、使用概況 | 3 | 29 | ⬛⬛⬛⬛⬛ 95% | 匯出匯入都有，最完整的模組之一 |
| 2 | **報價管理** | 報價建立、多階審批、發送、轉訂單 | 2 | 7 | ⬛⬛⬛⬛⬜ 85% | 缺列表匯出 |
| 3 | **訂單管理** | 銷售訂單 CRUD、批次確認/出貨、庫存鎖定、KPI 觸發 | 2 | 8 | ⬛⬛⬛⬛⬛ 95% | 含 idempotency key、SELECT FOR UPDATE |
| 4 | **銷貨單** | 出庫憑證、自動建立理貨單、自動開電子發票 | 2 | 3 | ⬛⬛⬛⬛⬜ 90% | 訂單確認自動建立 |
| 5 | **庫存管理** | 庫存 CRUD、批號、安全庫存、調整、盤點、報廢、轉移 | 7 tab | 19 | ⬛⬛⬛⬛⬛ 95% | FIFO/FEFO 策略、批號追溯 |
| 6 | **出貨物流** | 出貨單、理貨、派貨、配送趟次、POD 簽收 | 6 | 16 | ⬛⬛⬛⬛⬛ 95% | 行動端簽收、GPS、異常處理 |
| 7 | **商品管理** | 商品 CRUD、BOM、供應商關聯、成本結構、匯入 | 2 | 6 | ⬛⬛⬛⬛⬜ 85% | 7 級價格欄位 |
| 8 | **使用者/權限** | 使用者 CRUD、角色權限矩陣、token 撤銷 | 2 | 6 | ⬛⬛⬛⬛⬛ 95% | 模組級可視性控制 |

### 1.2 財務模組

| # | 模組 | 功能說明 | 頁面數 | API 數 | 完成度 | 備註 |
|---|------|----------|--------|--------|--------|------|
| 9 | **應收帳款** | AR 管理、帳齡分析、催收日誌、沖帳 | 3 | 6 | ⬛⬛⬛⬛⬛ 95% | 含 SettlementBatch 批次沖帳 |
| 10 | **應付帳款** | AP 管理、帳齡分析、沖帳 | 3 | 6 | ⬛⬛⬛⬛⬜ 90% | 同上架構 |
| 11 | **收款/付款** | 統一收付款記錄、自動沖銷 AR/AP | 2 | 3 | ⬛⬛⬛⬛⬜ 90% | 有兩條平行路徑（見風險 #6） |
| 12 | **日記帳** | 手動/自動分錄、過帳、迴轉 | 1 | 4 | ⬛⬛⬛⬛⬛ 95% | Period guard 防改已結帳期 |
| 13 | **自動日記帳** | 銷售確認/COGS/收款/付款/費用自動分錄 | 1 | 1 | ⬛⬛⬛⬛⬜ 85% | 8 種 journal type 已實作 |
| 14 | **財務三表** | 損益表、資產負債表、現金流量表 | 3 | 3 | ⬛⬛⬛⬛⬜ 85% | 現金流為間接法 |
| 15 | **總帳/明細帳** | 科目餘額、T 帳、現金簿、VAT 帳 | 5+ | 5+ | ⬛⬛⬛⬛⬜ 85% | 帳戶層級鑽透 |
| 16 | **電子發票** | MIG V4.1 XML、Turnkey 對接、字軌管理 | 2 | 4 | ⬛⬛⬛⬛⬜ 85% | 開立/作廢/折讓/註銷 |
| 17 | **VAT 申報** | 401 媒體匯出 TXT、進銷項分類帳 | 3 | 4 | ⬛⬛⬛⬛⬜ 85% | 台灣稅務合規 |
| 18 | **費用報銷** | 報銷單 CRUD、多階簽核、AI 收據掃描 | 2 | 7 | ⬛⬛⬛⬛⬜ 85% | 含 GL 科目對應 |
| 19 | **零用金** | 基金管理、支出記錄 | 1 | 3 | ⬛⬛⬛⬜⬜ 75% | 基本功能完整 |
| 20 | **銀行帳戶** | 帳戶 CRUD、對帳、支票管理 | 3 | 3 | ⬛⬛⬛⬛⬜ 80% | 有對帳但未驗證自動匹配 |
| 21 | **結帳/期間** | 會計期間管理、年度結帳 | 1 | 2 | ⬛⬛⬛⬛⬜ 80% | OPEN→CLOSING→CLOSED→LOCKED |
| 22 | **財務報表** | 40+ 子報表（月營收、成本、現金、廠商帳等） | 25+ | 20+ | ⬛⬛⬛⬜⬜ 70% | 部分為薄殼報表 |

### 1.3 採購/生產模組

| # | 模組 | 功能說明 | 頁面數 | API 數 | 完成度 | 備註 |
|---|------|----------|--------|--------|--------|------|
| 23 | **採購單** | PO CRUD、12 階狀態機、OEM 排程 | 2 | 5 | ⬛⬛⬛⬛⬜ 85% | 收貨自動建 AP + 入庫 |
| 24 | **供應商** | 供應商 CRUD、價格歷史、績效 | 2 | 5 | ⬛⬛⬛⬛⬜ 85% | 匯入功能 |
| 25 | **請購/詢價** | 請購單→RFQ→比價→轉 PO | 2 | 4 | ⬛⬛⬛⬜⬜ 75% | 基本流程完整 |
| 26 | **海運追蹤** | 15 階段海運物流、費用分攤、報關 | 1 | 6 | ⬛⬛⬛⬛⬜ 85% | 含 ImportProject 進口費用專案 |
| 27 | **生產管理** | OEM 製令、9 階段工單、領料、入庫 | 3 | 6 | ⬛⬛⬛⬛⬜ 80% | 入庫無自動日記帳（缺口） |
| 28 | **品質管理** | 7 種檢驗類型、尿布專用 checklist、不良品處理 | 2 | 5 | ⬛⬛⬛⬛⬜ 80% | 兩套 QC 系統（技術債） |

### 1.4 CRM / 業務支援模組

| # | 模組 | 功能說明 | 頁面數 | API 數 | 完成度 | 備註 |
|---|------|----------|--------|--------|--------|------|
| 29 | **CRM 中心** | 8 類提醒、漏斗分析、活動追蹤 | 1 | 4 | ⬛⬛⬛⬛⬜ 85% | 智慧提醒引擎 |
| 30 | **KPI 管理** | 業績目標設定/追蹤、里程碑通知 | 1 | 2 | ⬛⬛⬛⬛⬜ 85% | 50/80/100% 自動通知 |
| 31 | **業務日報** | 日報 CRUD、主管審核 | 1 | 4 | ⬛⬛⬛⬛⬜ 80% | Dashboard 整合 |
| 32 | **機構巡迴** | 定期拜訪排程、GPS 追蹤、自動排程 | 1 | 2 | ⬛⬛⬛⬜⬜ 75% | 含 cron 自動排程 |
| 33 | **定價管理** | 客戶×商品定價、特殊價、價目表 | 3 | 4 | ⬛⬛⬛⬛⬜ 85% | 最近重構為一對一定價 |
| 34 | **銷售分析** | 月/客戶/商品/通路/業績分析 | 5 | 3 | ⬛⬛⬛⬛⬜ 80% | Recharts 圖表 |

### 1.5 WMS / 進階倉儲

| # | 模組 | 功能說明 | 頁面數 | API 數 | 完成度 | 備註 |
|---|------|----------|--------|--------|--------|------|
| 35 | **WMS** | 儲位、區域、庫位庫存、入出庫 | 4 tab | 11 | ⬛⬛⬛⬛⬜ 80% | 含 ABC 分析、FIFO 建議 |
| 36 | **進貨作業** | 入庫記錄、QC、上架 | 1 | 3 | ⬛⬛⬛⬜⬜ 75% | 三套入庫系統之一（技術債） |

### 1.6 系統/管理模組

| # | 模組 | 功能說明 | 頁面數 | API 數 | 完成度 | 備註 |
|---|------|----------|--------|--------|--------|------|
| 37 | **稽核日誌** | 操作追蹤、diff 對照 | 1 | 1 | ⬛⬛⬛⬛⬛ 95% | 靜默不阻斷業務 |
| 38 | **通知系統** | 系統/LINE/Email 多通路 | — | 3 | ⬛⬛⬛⬛⬜ 80% | SSE 即時推送 |
| 39 | **AI 助手** | 聊天、技能、分析、收據掃描 | 浮動窗 | 5 | ⬛⬛⬛⬜⬜ 70% | 雙 provider（Ollama/Claude） |
| 40 | **Cron 排程** | 報價到期、低庫存、AR 逾期、車輛合規 | — | 4 | ⬛⬛⬛⬛⬜ 85% | 全部冪等 |

### 1.7 Phase 2 / 低優先模組

| # | 模組 | 功能說明 | 頁面數 | API 數 | 完成度 | 備註 |
|---|------|----------|--------|--------|--------|------|
| 41 | **通路管理** | 蝦皮/momo 訂單同步、SKU 對應 | 2 | 5 | ⬛⬛⬛⬜⬜ 60% | 無自動建訂單 |
| 42 | **照護管理** | 照護排程、服務請求、事件管理 | 2 | 4 | ⬛⬛⬜⬜⬜ 50% | 含 AI 音檔轉錄 |
| 43 | **零售管理** | 連鎖門市、陳列、活動 | 1 | 5 | ⬛⬛⬜⬜⬜ 50% | Phase 2 |
| 44 | **HR 人事** | 員工檔案、出勤、薪資 | 1 (4tab) | 4 | ⬛⬛⬛⬜⬜ 60% | 基本功能 |
| 45 | **合約管理** | 客戶/供應商合約、付款排程 | 1 | 2 | ⬛⬛⬛⬜⬜ 65% | 自動續約提醒 |
| 46 | **固定資產** | 資產登記、折舊計算 | 1 | 2 | ⬛⬛⬛⬜⬜ 60% | 直線/餘額遞減法 |
| 47 | **預算管理** | 年月預算、現金流預測 | 1 | 2 | ⬛⬛⬜⬜⬜ 50% | 基本 CRUD |
| 48 | **售後服務** | 保固/維修/退換工單 | 1 | 2 | ⬛⬛⬛⬜⬜ 65% | 含零件消耗追蹤 |
| 49 | **知識庫** | AI 知識庫、向量搜尋 | 1 | 2 | ⬛⬛⬜⬜⬜ 45% | 有 embedding 欄位但搜尋未確認 |
| 50 | **簽核系統** | 多階電子簽核、範本管理 | 1 | 4 | ⬛⬛⬛⬜⬜ 70% | 費用/請購/報價已串接 |

### 統計總覽

| 指標 | 數量 |
|------|------|
| Schema 檔案 | 44 |
| Database Models | 170+ |
| API Route 檔案 | 417 |
| Dashboard 頁面 | 175 |
| TypeScript 總行數 | 170,547 |
| 用 handleApiError 的 route | 364 / 417（87%） |
| 有 audit log 的 route | 90 |
| 有匯出功能的 route | 12（Excel）+ 1（PDF） |
| 分頁格式一致的 route | 54 |

---

## 2. 核心流程檢查

### 2.1 報價→訂單→出貨→對帳 主線流程

```
報價 (Quotation)
  │ DRAFT → PENDING_APPROVAL → APPROVED → SENT → ACCEPTED
  │                                                  │
  ▼                                                  ▼
  審批 (QuotationApproval)                    轉訂單 (convert)
  └─ SALES_MANAGER → GM 兩級               ├─ 檢查客戶啟用
                                            ├─ 檢查信用額度（AR 餘額 vs creditLimit）
                                            ├─ 檢查庫存 availableQty
                                            └─ 建立 SalesOrder (PENDING)
                                                  │
                                                  ▼
訂單 (SalesOrder) ─── DRAFT → PENDING → CONFIRMED ──┬──────────────────────────────
  │                                                  │ 自動觸發                     │
  │                                           ┌──────┴──────┐                      │
  │                                           │             │                      │
  │                                    SELECT FOR UPDATE  Auto-create:             │
  │                                    庫存行級鎖          ├─ SalesInvoice (銷貨單)  │
  │                                    reservedQty++       ├─ AccountsReceivable    │
  │                                    availableQty--      ├─ AutoJournal           │
  │                                                        │  (SALES_CONFIRM+COGS)  │
  │                                                        ├─ 通知倉管              │
  │                                                        └─ KPI 里程碑檢查        │
  │                                                              │
  ▼                                                              ▼
銷貨單 (SalesInvoice)                                     KPI Milestone
  │ DRAFT → CONFIRMED ───────┐                            50% / 80% / 100%
  │                          │ 自動觸發                    通知業務 + 主管
  │                   ┌──────┴──────┐
  │                   │             │
  │             PickingOrder    EInvoice (電子發票)
  │             (理貨單)        B2B/B2C 自動判斷
  │                │
  │                ▼
  │         PickingOrder PICKED
  │                │ 自動建立
  │                ▼
  │         DispatchOrder (派貨單)
  │                │ 指派車輛/司機
  │                ▼
  │         DispatchOrder DISPATCHED
  │                │
  ▼                ▼
Shipment (出貨單)
  │ PREPARING → PACKED → SHIPPED → DELIVERED
  │     │
  │     ├─ SELECT FOR UPDATE 庫存扣減
  │     ├─ InventoryTransaction (OUT)
  │     └─ 更新訂單出貨狀態
  │                                  │
  │                                  ▼
  │                         ProofOfDelivery (簽收)
  │                         signStatus: SIGNED
  │                                  │
  ▼                                  ▼
AccountsReceivable              訂單 → SIGNED → COMPLETED
  │ NOT_DUE → DUE → PARTIAL_PAID → PAID
  │     │
  │     ├─ ReceiptRecord (收款沖帳)
  │     ├─ SettlementBatch (批次沖帳)
  │     └─ AutoJournal (PAYMENT_IN)
  │              Dr 銀行 / Cr 應收帳款
  │
  ▼
ReturnOrder (退貨，如需要)
  │ PENDING → APPROVED → COMPLETED
  ├─ InboundRecord (庫存回沖)
  └─ AutoJournal (SALES_RETURN)
```

### 2.2 流程串接檢查結果

| 環節 | 串接方式 | 狀態 | 問題 |
|------|----------|------|------|
| 報價→訂單 | `quotations/[id]/convert` | ✅ 完整 | 含信用額度 + 庫存檢查 |
| 訂單確認→銷貨單 | `orders/[id]` PUT CONFIRMED | ✅ 冪等 | `findFirst` 防重複 |
| 訂單確認→AR | 同上 | ✅ 冪等 | due = +30 天 |
| 訂單確認→日記帳 | `createAutoJournal(SALES_CONFIRM+COGS)` | ✅ 冪等 | referenceId 防重複 |
| 訂單確認→庫存鎖定 | `SELECT FOR UPDATE` | ✅ 並發安全 | 行級鎖 |
| 訂單建立→KPI | `checkKpiMilestone()` | ✅ 非同步 | catch 不阻斷主流程 |
| 銷貨單確認→理貨單 | `sales-invoices/[id]` PUT | ✅ 冪等 | — |
| 銷貨單確認→電子發票 | 同上 | ✅ 自動 | B2B/B2C 自動判斷 |
| 理貨完成→派貨單 | `picking-orders/[id]` PUT PICKED | ✅ 冪等 | — |
| 出貨→庫存扣減 | `shipments` POST | ✅ FOR UPDATE | + InventoryTransaction |
| 簽收→訂單完成 | `shipments/[id]/deliver` | ✅ | 全部 shipment 簽收→SIGNED |
| 收款→AR 沖銷 | `finance/receipts` POST | ✅ | 超付防護 |
| 收款→日記帳 | `createAutoJournal(PAYMENT_IN)` | ✅ | — |
| 退貨→庫存回沖 | `sales-returns/[id]` | ⚠️ 部分 | 有 journal 但庫存回沖需確認 |

### 2.3 採購流程串接

```
請購單 → RFQ 詢價 → 採購單 (ORDERED)
  → 工廠確認 (自動建 SeaFreight)
  → 收貨 (PurchaseReceipt)
      ├─ 庫存 upsert + InventoryTransaction(IN)
      ├─ AccountsPayable 自動建立
      └─ AutoJournal (PURCHASE_RECEIVE)
  → 品檢 (QualityCheck)
      ├─ PASS → InventoryLot
      └─ FAIL → DefectiveGoods
  → 付款 (DisbursementRecord)
      └─ AutoJournal (PAYMENT_OUT)
```

| 環節 | 狀態 | 問題 |
|------|------|------|
| PO 收貨→庫存 | ✅ | — |
| PO 收貨→AP | ✅ 冪等 | — |
| PO 收貨→日記帳 | ✅ | PURCHASE_RECEIVE |
| QC PASS→庫存批號 | ✅ | — |
| QC FAIL→不良品 | ✅ | 自動建 DefectiveGoods |
| 採購退貨→庫存 | ❌ 缺口 | 有日記帳但無庫存 OUT 交易 |
| 生產入庫→日記帳 | ❌ 缺口 | 有庫存入帳但無會計分錄 |

---

## 3. 角色權限矩陣

### 3.1 資料可見範圍（scope.ts）

| 角色 | 訂單 | 客戶 | 報價 | 出貨 | 銷貨單 | 領料 | 入庫 |
|------|------|------|------|------|--------|------|------|
| SUPER_ADMIN | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 |
| GM | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 |
| FINANCE | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 |
| SALES_MANAGER | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 |
| WAREHOUSE_MGR | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 |
| WAREHOUSE | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 |
| PROCUREMENT | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 |
| ECOMMERCE | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 |
| **SALES** | **自己的** | **自己的** | **自己的** | **自己的** | **自己的** | **自己的** | **自己的** |
| **CS** | **自己的** | **自己的** | **自己的** | **自己的** | **自己的** | **自己的** | **自己的** |
| **CARE_SUPERVISOR** | **自己的** | **自己的** | **自己的** | **自己的** | **自己的** | **自己的** | **自己的** |

> ⚠️ **風險**：WAREHOUSE / PROCUREMENT / ECOMMERCE 的 scope 邏輯給予全部資料讀取權限（含客戶、財務相關），因為 scope.ts 只限制 SALES/CS/CARE_SUPERVISOR。Sidebar 可見性有做控制（見 3.2），但 API 層沒有額外擋。

### 3.2 Sidebar 模組可見性（role-permissions 預設值）

| 模組群組 | ADMIN/GM | SALES_MGR | SALES | CARE | ECOMM | CS | WH_MGR | WH | PROC | FIN |
|----------|----------|-----------|-------|------|-------|----|--------|----|------|-----|
| 每日工作 | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| 客戶管理 | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| 業務流程 | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — | — | — |
| 報價/訂單 | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | — | — | ✅ |
| 庫存 | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | ✅ | — |
| 物流出貨 | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — | — |
| 採購 | ✅ | — | — | — | — | — | ✅ | — | ✅ | — |
| 生產/品管 | ✅ | — | — | — | — | — | — | — | ✅ | — |
| 財務核心 | ✅ | — | — | — | — | — | — | — | — | ✅ |
| AR/AP | ✅ | ✅ | — | — | ✅ | — | — | — | ✅ | ✅ |
| 帳務/報表 | ✅ | — | — | — | — | — | — | — | — | ✅ |
| 分析 | ✅ | ✅ | ✅ | — | ✅ | — | — | — | ✅ | ✅ |
| 服務/照護 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| HR/行政 | ✅ | — | — | — | — | — | — | — | — | — |
| 系統設定 | ✅ | — | — | — | — | — | — | — | — | — |

### 3.3 API 層角色限制（重要操作）

| 操作 | 允許角色 |
|------|----------|
| 使用者 CRUD | SUPER_ADMIN |
| 權限矩陣修改 | SUPER_ADMIN, GM |
| 信用額度修改 | FINANCE, GM, SUPER_ADMIN |
| 財務寫入（日記帳/收款/付款/沖帳） | SUPER_ADMIN, GM, FINANCE |
| 採購單修改 | SUPER_ADMIN, GM, PROCUREMENT, WAREHOUSE_MGR |
| 出貨單更新 | SUPER_ADMIN, GM, WAREHOUSE_MGR, WAREHOUSE |
| 批次確認訂單 | SUPER_ADMIN, GM, SALES_MGR, SALES, CS |
| 客戶刪除 | SUPER_ADMIN, GM, SALES_MGR |
| 進口費用 | SUPER_ADMIN, GM, PROCUREMENT, FINANCE |
| 庫存安全量 | SUPER_ADMIN, GM, WAREHOUSE_MGR, WAREHOUSE, PROCUREMENT |
| 通路同步 | SUPER_ADMIN, GM, SALES_MGR, ECOMMERCE |
| 費用審核 | FINANCE, GM, SUPER_ADMIN |

### 3.4 Dashboard 角色對應

| 角色 | Dashboard 元件 | 內容重點 |
|------|---------------|----------|
| SUPER_ADMIN / GM | GmDashboard | 全局營收、KPI、AR/AP、庫存警報 |
| SALES_MANAGER | SalesManagerDashboard | 團隊 KPI、日報審核、審批待辦 |
| SALES / CS / CARE | SalesDashboard | 個人業績、拜訪行程、AI 預測 |
| WAREHOUSE_MGR / WH | WarehouseDashboard | 入庫管線、待出貨、QC、配送 |
| PROCUREMENT | ProcurementDashboard | 採購金額、在途批次、品質指標 |
| FINANCE | FinanceDashboard | AR/AP 概覽、逾期、銀行對帳 |

---

## 4. 複雜度評估與簡化建議

### 4.1 可以先砍/延後的模組

| 優先級 | 模組 | 理由 | 建議 |
|--------|------|------|------|
| 🔴 砍 | 零售管理 (retail) | Phase 2，目前 B2B 優先 | 隱藏 sidebar，保留 schema |
| 🔴 砍 | 知識庫 (knowledge) | 45% 完成度，向量搜尋未串接 | 延後到 AI 功能成熟 |
| 🔴 砍 | 預算管理 (budget) | 50% 完成度，初期不需要 | 先用 Excel |
| 🟡 延後 | 照護管理 (care) | 50% 完成度，B2B 次要 | Phase 2 |
| 🟡 延後 | HR 人事 (hr) | 60% 完成度，可用外部系統 | Phase 2 |
| 🟡 延後 | 固定資產 (fixed-assets) | 60% 完成度 | Phase 2 |
| 🟡 延後 | 售後服務 (after-sales) | 65%，可先用客訴模組替代 | Phase 2 |
| 🟡 延後 | 通路同步 (channels) | 60%，ChannelOrder 無法自動建 SO | 手動處理 |
| 🟡 延後 | 合約管理 (contracts) | 65% | Phase 2 |
| 🟢 簡化 | WMS | 80% 但和 Inventory 重疊 | 小型倉庫只用 Inventory，WMS 給大倉 |
| 🟢 簡化 | 進貨作業 (inbound) | 三套入庫系統技術債 | 先統一用 InboundRecord |
| 🟢 簡化 | 財務報表 (25+ 頁) | 部分為薄殼，財務可先看核心三表 | 先開 10 個核心報表 |

### 4.2 複雜度排名（高→低）

| 排名 | 模組 | 複雜度指標 | 原因 |
|------|------|-----------|------|
| 1 | 財務 | 87 API + 43 頁 | 最大模組，含三表/VAT/銀行/沖帳 |
| 2 | 客戶 | 29 API + 3 頁 | 子路由多（15 個子功能） |
| 3 | 庫存 | 19 API + 7 tab | 三套入庫 + WMS + 批號 |
| 4 | 訂單 | 8 API + 2 頁 | 核心但邏輯密集（並發鎖/自動觸發） |
| 5 | 物流 | 16 API + 6 頁 | 理貨→派貨→出貨→簽收四層 |

---

## 5. 上線前必做 vs 可以之後做

### 5.1 🔴 上線前必做（Blocker）

| # | 項目 | 說明 | 影響 | 工時估計 |
|---|------|------|------|----------|
| 1 | **電子發票 B2C 類型碼 Bug** | `einvoice-mig.ts:511` — `isB2B ? '07' : '07'` 死碼，B2C 發票類型永遠送 07 | 發票上傳會被財政部退件 | 0.5h |
| 2 | **Seed 測試資料** | 上線前必須 seed 會計科目表、Sequence 種子、初始倉庫 | 系統無法運作 | 2h |
| 3 | **生產入庫缺日記帳** | ProductionReceipt CONFIRMED 有入庫但無 AutoJournal | 存貨科目不平 | 2h |
| 4 | **採購退貨缺庫存扣減** | PurchaseReturn 完成有 journal 但無 Inventory OUT | 庫存帳實不符 | 2h |
| 5 | **Period Guard 覆蓋不全** | 訂單確認建 AR 時不檢查期間是否已關 | 已結帳月份仍可新增 AR | 1h |
| 6 | **AR invoiceNo 錯誤引用** | 訂單確認建 AR 時 `invoiceNo=orderNo`，應為 `SalesInvoice.invoiceNumber` | AR 對帳欄位不正確 | 1h |
| 7 | **CRON_SECRET 長度校驗** | `.env.example` 要求 ≥32 字元，但 code 未驗證 | 弱密鑰可被暴力猜測 | 0.5h |
| 8 | **資料庫備份驗證** | `docker-compose` backup service 存在但需驗證 restore 流程 | 災難復原 | 4h |

### 5.2 🟡 上線後一週內（Important）

| # | 項目 | 說明 |
|---|------|------|
| 1 | **WAREHOUSE 角色 scope 修正** | WAREHOUSE 可以看到所有客戶/報價/財務資料（scope.ts 未限制） |
| 2 | **sales-returns 權限漏洞** | 任何登入者可對任何訂單建退貨，POST 沒有 scope 檢查 |
| 3 | **Rate limiter 改 Redis** | 目前是 in-memory，多 instance 部署會失效 |
| 4 | **Dashboard 財務數據來源統一** | `/api/dashboard/finance` 從 SalesOrder 算 AR，非 AccountsReceivable model |
| 5 | **AI Skill 定價邏輯過期** | `ai-skills.ts` 的 `skillGenerateQuote` 仍用舊版等級制定價 |
| 6 | **兩套收款入口合併** | `/api/payments` 和 `/api/finance/receipts` 都能建 ReceiptRecord |
| 7 | **兩套對帳單合併** | `/api/reconciliation-statements` 和 `/api/statements` 功能重疊 |
| 8 | **LINE Webhook 綁定未完成** | `handleFollow` 有 TODO，無法從 LINE follow 事件綁定系統帳號 |

### 5.3 🟢 可以之後做（Nice-to-have）

| # | 項目 | 說明 |
|---|------|------|
| 1 | 三套入庫系統統一 | 合併為 InboundRecord + sourceType |
| 2 | 兩套 QC 系統統一 | 合併為 QualityCheck + sourceType |
| 3 | 報價列表匯出 | 目前只能匯出單張（PDF） |
| 4 | 通路訂單自動建 SO | ChannelOrder → SalesOrder 自動串接 |
| 5 | 全模組 audit log 覆蓋 | 目前 90/417 route 有 audit（22%） |
| 6 | 批號到期自動通知 | cron 有 refresh-expiry 但缺主動 alert |
| 7 | Email 通知 retry | 目前 LINE/Email 失敗不重試 |
| 8 | OpenTelemetry 觀測性 | 結構化日誌已有，缺 tracing |
| 9 | E2E 測試 | 目前零測試 |
| 10 | 財務子報表精修 | 25+ 個薄殼報表可擇要精修 |

---

## 6. 業務極簡操作路徑

> 給業務人員（SALES 角色）的 Day 1 操作指南，只走最短路徑。

### 6.1 日常流程（每天）

```
登入 → Dashboard（看今日待辦）
  │
  ├─ 📋 看「未回訪客戶」提醒 → 安排拜訪
  ├─ 📋 看「待跟進報價」→ 聯繫客戶
  └─ 📝 填寫「業務日報」→ 等主管審核
```

### 6.2 新客戶開發（一次性）

```
客戶管理 → [+ 新增客戶]
  填：名稱、類型（護理之家/日照…）、區域、聯絡人、電話
  存檔 → 系統自動給客戶編號 C####
```

### 6.3 報價→成交→出貨（核心流程）

```
Step 1：建報價
  報價管理 → [+ 新增]
  選客戶 → 加品項（數量、單價）→ 存檔
  ↓
  系統自動判斷是否需要審批（低於底價時）
  ↓
  審批通過 → [發送報價] 給客戶（LINE/Email）

Step 2：客戶接受 → 轉訂單
  報價列表 → 找到該報價 → [轉為訂單]
  ↓
  系統自動：
  ✓ 檢查庫存
  ✓ 檢查信用額度
  ✓ 建立訂單

Step 3：確認訂單
  訂單管理 → 找到訂單 → 狀態改為 [確認]
  ↓
  系統自動：
  ✓ 鎖定庫存（防超賣）
  ✓ 建立銷貨單
  ✓ 建立應收帳款
  ✓ 記帳（日記帳）
  ✓ 通知倉管備貨
  ✓ 更新你的 KPI

Step 4：出貨（倉管執行）
  倉管收到通知 → 理貨 → 派貨 → 出貨 → 客戶簽收

Step 5：收款（財務執行）
  財務收到款項 → 登錄收款 → AR 自動沖銷
```

### 6.4 快捷鍵

| 操作 | 快捷鍵 |
|------|--------|
| 全域搜尋 | `⌘K` 或 `/` |
| 回 Dashboard | 點 sidebar logo |

### 6.5 業務只需要看的 5 個頁面

| 頁面 | 用途 |
|------|------|
| Dashboard | 看今日待辦、KPI 進度 |
| 客戶管理 | 查客戶、建新客戶 |
| 報價管理 | 建報價、發報價、轉訂單 |
| 訂單管理 | 確認訂單、追蹤出貨 |
| CRM | 看提醒、安排拜訪 |

---

## 7. 已知 Bug / 風險

### 7.1 程式碼 Bug

| # | 檔案 | 行 | 問題 | 嚴重度 |
|---|------|-----|------|--------|
| 1 | `src/lib/einvoice-mig.ts` | 511 | `isB2B ? '07' : '07'` — B2C 發票類型碼永遠是 07 | 🔴 HIGH |
| 2 | `src/lib/auto-journal.ts` | — | 帳戶科目不存在時靜默回傳 null，不報錯 | 🟡 MED |
| 3 | `src/lib/ai-skills.ts` | — | `skillGenerateQuote` 仍用舊版等級定價，與新的一對一定價矛盾 | 🟡 MED |

### 7.2 安全風險

| # | 問題 | 影響 | 建議 |
|---|------|------|------|
| 1 | WAREHOUSE scope 過寬 | 倉管可讀所有客戶/報價/財務 API 資料 | 在 scope.ts 加 WAREHOUSE 限制 |
| 2 | sales-returns POST 無 scope | 任何登入者可對任何訂單建退貨 | 加 `canAccessOrder` 檢查 |
| 3 | rate-limit in-memory | 多 instance 部署無效 | 改用 Redis |
| 4 | 53 個 route 缺 handleApiError | 可能洩漏 stack trace | 補上錯誤處理 |
| 5 | ENCRYPTION_KEY 可不設 | PII 以明文存 DB | 生產環境強制要求 |

### 7.3 資料一致性風險

| # | 問題 | 影響 |
|---|------|------|
| 1 | 生產入庫無日記帳 | 存貨科目借方少記 |
| 2 | 採購退貨無庫存扣減 | 庫存帳面高於實際 |
| 3 | AR invoiceNo = orderNo | 對帳時發票號碼不對 |
| 4 | Dashboard vs Ledger 計算來源不同 | 財務 Dashboard 金額可能和帳本不一致 |
| 5 | 兩套收款入口 | 同一筆 AR 可能被重複沖銷 |

---

## 附錄：Auto-Journal 觸發點一覽

| 觸發來源 | Journal Type | 借方 | 貸方 |
|----------|-------------|------|------|
| 訂單確認 | SALES_CONFIRM | 應收帳款（含稅） | 銷貨收入 + 銷項稅 |
| 訂單確認 | SALES_COGS | 銷貨成本 | 存貨 |
| 訂單出貨 | SALES_COGS | 銷貨成本 | 存貨 |
| 退貨完成 | SALES_RETURN | 銷貨退回 + 進項稅 | 應收帳款 |
| PO 收貨 | PURCHASE_RECEIVE | 存貨 + 進項稅 | 應付帳款 |
| 採購退貨 | PURCHASE_RETURN | 應付帳款 | 存貨 + 進項稅 |
| 收款入帳 | PAYMENT_IN | 銀行 | 應收帳款 |
| 付款出帳 | PAYMENT_OUT | 應付帳款 | 銀行 |
| 費用支付 | EXPENSE_PAY | 費用科目 | 銀行 |
| 零用金支出 | EXPENSE_PAY | 費用科目 | 銀行 |
| 批次沖帳 | PAYMENT_IN/OUT | 依方向 | 依方向 |

> VAT 稅率硬編碼 5%。B2B 銷貨收入帳 4110，B2C 帳 4120（fallback 4100）。銀行帳 1102（fallback 1100）。

---

*報告產生方式：4 個平行分析 agent 掃描全部 44 schema + 417 API route + 179 page + 18 core lib，由 Claude Opus 4.6 彙整。*
