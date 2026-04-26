# M02 供應商報價管理 — 規劃文件

> 2026-04-25 | branch: donghong-m02-quotations

---

## 1. 既有 Quotation 模組摘要

### Schema 重點欄位（`06-sales.prisma`）

| 欄位 | 說明 |
|------|------|
| `quotationNo` | 系統流水號（`generateSequenceNo('QUOTATION')`） |
| `customerId` | 買方：客戶 |
| `status` | DRAFT→PENDING_APPROVAL→APPROVED→SENT→ACCEPTED/REJECTED/EXPIRED/CONVERTED |
| `version` / `previousVersionId` | 版本鏈（Int + 前版 ID） |
| `validUntil` | 報價有效期 |
| `totalAmount` / `currency` | 金額（預設 TWD） |
| `paymentTerm` / `deliveryTerm` | 付款/交貨條件 |
| `requiresApproval` / `approvalStatus` | 審核旗標 |
| `QuotationItem.grossMargin/Rate` | 毛利/毛利率（銷售側核心） |
| `QuotationItem.productNameSnap/skuSnap` | 商品快照防資料漂移 |

### 主要 API endpoints

```
GET  /api/quotations                   — 列表（scope 過濾：SALES 只看自己）
POST /api/quotations                   — 新建
GET  /api/quotations/[id]              — 詳情
PUT  /api/quotations/[id]              — 編輯
DEL  /api/quotations/[id]              — 刪除
POST /api/quotations/[id]/submit       — 提交審核
POST /api/quotations/[id]/approvals    — 審核動作（approve/reject）
GET  /api/quotations/[id]/export       — PDF/Excel 匯出
POST /api/quotations/[id]/send         — 發送給客戶
POST /api/quotations/[id]/convert      — 轉換成 SalesOrder
```

### 頁面路徑與檔案

```
src/app/(dashboard)/quotations/
  page.tsx          — 列表（Table + search + status 篩選 + DropdownMenu 動作）
  [id]/page.tsx     — 詳情（Card 分區：基本資料 / 品項 Table / 審核紀錄）
```
（無獨立 new/page.tsx，以 Dialog Form 方式在列表頁新建）

### UI 慣例

- **列表**：shadcn `Table` + `Badge`（status 色碼）+ `DropdownMenu`（行動作）+ `Input`（搜尋）
- **新建/編輯**：shadcn `Dialog` 包 `Form`（`QuotationForm` 獨立 component）
- **詳情**：`Card` + 巢狀 `Table` + `Dialog`（審核/送件確認）
- **狀態管理**：`useState` + `useCallback` + `fetch` + 300ms debounce（**無** react-query/SWR）
- **分頁回傳**：`{ data: T[], pagination: { page, pageSize, total, totalPages } }`
- **錯誤處理**：`handleApiError(error, 'module.action')`
- **認證**：`const session = await auth()` → 401 guard

---

## 2. M02 SupplierQuotation 對稱設計

### M01 已建好的 Schema（`48-donghong.prisma`）

- `SupplierQuotation`：id, quotationNumber, supplierId, quotedAt, validFrom/Until, currency(CNY), incoterms, paymentTerms, minOrderQty, leadTimeDays, status, notes, attachmentUrl, supersededById（版本鏈）, businessUnit(DONGHONG), createdById
- `SupplierQuotationItem`：quotationId, variantId（→ProductVariant）, unitPrice(Decimal 12,4), unit, packingSpec, specNotes(Json)；@@unique([quotationId, variantId])

### API endpoints（共 9 支）

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/donghong/supplier-quotations` | 列表（supplierId/variantId/status/businessUnit 篩選，分頁） |
| POST | `/api/donghong/supplier-quotations` | 新建（帶 items[]，自動產 quotationNumber） |
| GET | `/api/donghong/supplier-quotations/[id]` | 詳情（含 items、supplier、variant 展開） |
| PATCH | `/api/donghong/supplier-quotations/[id]` | 更新（僅 DRAFT 狀態可改） |
| DELETE | `/api/donghong/supplier-quotations/[id]` | 刪除（僅 DRAFT） |
| POST | `/api/donghong/supplier-quotations/[id]/submit` | DRAFT→SUBMITTED |
| POST | `/api/donghong/supplier-quotations/[id]/accept` | SUBMITTED→ACCEPTED，寫 VariantCostSnapshot |
| POST | `/api/donghong/supplier-quotations/[id]/reject` | SUBMITTED→REJECTED（附原因） |
| POST | `/api/donghong/supplier-quotations/[id]/supersede` | 建新版本，舊版 supersededById 指向新版 |
| GET | `/api/donghong/supplier-quotations/compare` | 比價：同 variantId 多家供應商報價並排 |

### 頁面路徑（共 4 個）

```
src/app/(dashboard)/donghong/supplier-quotations/
  page.tsx              — 列表（Table + 供應商/狀態/幣別 篩選）
  new/page.tsx          — 新建表單（供應商選擇 + 動態 variant 行）
  [id]/page.tsx         — 詳情（Tabs：基本資料 / 品項明細 / 版本歷程）
  compare/page.tsx      — 比價矩陣（選 variantId → 各供應商橫排比較）
```

### 可與既有 Quotation 共用

| 項目 | 說明 |
|------|------|
| shadcn UI 組件 | Table, Badge, Dialog, Card, DropdownMenu, Input, Textarea 完全同套 |
| Status Badge 色碼慣例 | DRAFT=outline, SUBMITTED=amber, ACCEPTED=green, REJECTED=red |
| `handleApiError` | 直接沿用 |
| `auth()` + 401 guard | 直接沿用 |
| `generateSequenceNo` | 沿用，改傳 `'SUPPLIER_QUOTATION'` |
| `{ data, pagination }` 分頁格式 | 直接沿用 |
| `fetch + useState + useCallback + 300ms debounce` | 直接沿用 |
| `logAudit` | submit/accept/reject 動作補 audit log |

### 與既有 Quotation 的差異

| 維度 | 銷售 Quotation（既有） | 供應商 SupplierQuotation（M02） |
|------|----------------------|-------------------------------|
| 方向 | 我方 → 客戶（sell-side） | 供應商 → 我方（buy-side） |
| 對象欄位 | `customerId` | `supplierId` |
| 品項關聯 | `productId`（Product） | `variantId`（ProductVariant，含產地） |
| 幣別預設 | TWD | CNY（或 USD/EUR，依供應商） |
| 毛利欄位 | `grossMargin/Rate`（核心） | **無**（採購側不計毛利） |
| 版本機制 | `version Int + previousVersionId` | `supersededById`（自參照鏈） |
| 快照欄位 | `productNameSnap/skuSnap/specSnap` | `packingSpec + specNotes(Json)` |
| 審核流程 | `requiresApproval + QuotationApproval table` | 簡化：submit→accept/reject（無多層審核） |
| Scope 過濾 | `quotationScope()`（SALES 只看自己） | `businessUnit = DONGHONG`（全採購看得到） |
| 附加動作 | convert→SalesOrder / send email | accept→寫 VariantCostSnapshot / supersede |
| 比價功能 | **無** | **有**：compare 頁面並排多家報價 |

---

## 3. M02 工時估算

| 層 | 項目 | 小時 |
|----|------|------|
| **API** | 9 支 route（含 compare 最複雜） | 10h |
| **前端** | 列表頁 + 詳情頁（Tabs）+ 新建頁 | 9h |
| **前端** | 比價矩陣頁（橫向 sticky table） | 4h |
| **Sidebar** | 新增兩個 nav item + i18n key | 0.5h |
| **測試** | seed 資料 + UAT checklist | 2h |
| **總計** | | **25.5h（≈3.5 工作天）** |

---

## 4. 風險與注意事項

### 4.1 命名衝突

- `QuotationStatus` enum 已在 `01-enums.prisma` 定義（DRAFT/SUBMITTED/ACCEPTED/REJECTED/EXPIRED），`SupplierQuotation.status` 直接沿用——**無衝突**。
- API 路徑 `/api/donghong/supplier-quotations` vs 既有 `/api/quotations` 命名空間完全隔離——**無衝突**。
- 前端頁面 `/donghong/supplier-quotations` vs `/quotations`——**無衝突**。

### 4.2 BusinessUnit 隔離

- 列表 API 預設 `where: { businessUnit: 'DONGHONG' }`。
- SUPER_ADMIN/GM 加 `?businessUnit=ALL` 可看全部。
- 新建時前端不傳 businessUnit，後端固定寫 `'DONGHONG'`。

### 4.3 比價頁面 UI

- 入口：列表頁勾選多筆 → 點「比價」按鈕，或從 variant 詳情頁進。
- 資料結構：以 `variantId` 為列、`supplierId` 為欄，unitPrice/leadTimeDays/minOrderQty 為格子。
- 實作：shadcn Table，variant 欄位 sticky-left，其餘供應商欄 scroll-x。
- 最低價格欄位加 `ring-2 ring-green-400` 高亮。
- 無需額外 schema，純前端從 compare API 組合。

### 4.4 accept 動作的副作用

- `POST /[id]/accept` 除了改 status，需同時 upsert `VariantCostSnapshot`（M01 已建模型），記錄成本快照供後續 PO 定價使用。
- 這是 M02 最重要的業務邏輯，需在 `prisma.$transaction` 中完成。

### 4.5 supersede 版本鏈

- 舊版 status 改 `SUPERSEDED`（需確認 `QuotationStatus` enum 有此值，否則改 `EXPIRED`）。
- 新版 `supersededById` 指向舊版 ID。
- 詳情頁「版本歷程」tab 用遞迴查詢展示。

---

## 5. M02 執行順序建議

```
Step 1: API 層（1-2 天）
  - GET/POST /api/donghong/supplier-quotations
  - GET/PATCH/DELETE /api/donghong/supplier-quotations/[id]
  - POST [id]/submit + accept + reject + supersede
  - GET /api/donghong/supplier-quotations/compare

Step 2: 前端基礎（1 天）
  - 列表頁 + Sidebar nav
  - 新建頁表單

Step 3: 前端進階（1 天）
  - 詳情頁（Tabs）
  - 比價矩陣頁

Step 4: 收尾（0.5 天）
  - seed 補充報價資料
  - TypeScript 零錯誤驗證
  - PR + squash merge
```
