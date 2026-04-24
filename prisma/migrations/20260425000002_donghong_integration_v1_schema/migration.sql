-- 東泓供應鏈中控平台整合 v1
-- feat(donghong): 新增 9 張 model + 擴充 Product/PurchaseOrder/PurchaseOrderItem/Supplier
-- Schema: prisma/schema/48-donghong.prisma

-- CreateEnum
CREATE TYPE "BusinessUnit" AS ENUM ('DONGHONG', 'COMFORTPLUS', 'SHARED');

-- CreateEnum
CREATE TYPE "CountryOrigin" AS ENUM ('TW', 'CN', 'VN', 'TH', 'JP', 'OTHER');

-- CreateEnum
CREATE TYPE "OriginCode" AS ENUM ('TW_FB', 'CN_KD', 'VN_XX', 'TH_OEM', 'OTHER');

-- CreateEnum
CREATE TYPE "DonghongPOStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'SIGNED', 'IN_PRODUCTION', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "POMilestoneType" AS ENUM ('DEPOSIT', 'BALANCE', 'CLOSING', 'OTHER_ADVANCE', 'OTHER_FINAL');

-- CreateEnum
CREATE TYPE "POMilestoneStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "PODocumentType" AS ENUM ('PO_PDF', 'SIGNED_PDF', 'INVOICE', 'BILL_OF_LADING', 'PACKING_LIST', 'QC_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalTier" AS ENUM ('SELF', 'MANAGER', 'CFO', 'CEO');

-- AlterEnum: 補 QuotationStatus 缺少的值
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable: Product 擴充東泓欄位
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "businessUnit"     "BusinessUnit" NOT NULL DEFAULT 'SHARED',
  ADD COLUMN IF NOT EXISTS "defaultVariantId" TEXT,
  ADD COLUMN IF NOT EXISTS "isMasterSku"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "masterSku"        TEXT;

-- AlterTable: PurchaseOrder 擴充東泓欄位
ALTER TABLE "PurchaseOrder"
  ADD COLUMN IF NOT EXISTS "approvalTier"         "ApprovalTier",
  ADD COLUMN IF NOT EXISTS "approvedAt"            TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedById"          TEXT,
  ADD COLUMN IF NOT EXISTS "auditHash"             TEXT,
  ADD COLUMN IF NOT EXISTS "depositRatio"          DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS "donghongBusinessUnit"  "BusinessUnit",
  ADD COLUMN IF NOT EXISTS "donghongStatus"        "DonghongPOStatus",
  ADD COLUMN IF NOT EXISTS "incoterms"             TEXT,
  ADD COLUMN IF NOT EXISTS "pdfHash"               TEXT,
  ADD COLUMN IF NOT EXISTS "pdfUrl"                TEXT,
  ADD COLUMN IF NOT EXISTS "qrCodeUrl"             TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt"            TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedReason"        TEXT,
  ADD COLUMN IF NOT EXISTS "sentAt"                TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "signedAt"              TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "signedByName"          TEXT,
  ADD COLUMN IF NOT EXISTS "signedIp"              TEXT,
  ADD COLUMN IF NOT EXISTS "signedUserAgent"       TEXT,
  ADD COLUMN IF NOT EXISTS "supplierQuotationId"   TEXT,
  ADD COLUMN IF NOT EXISTS "totalAmountTwd"        DECIMAL(14,2);

-- AlterTable: PurchaseOrderItem 擴充東泓欄位
ALTER TABLE "PurchaseOrderItem"
  ADD COLUMN IF NOT EXISTS "specLockId" TEXT,
  ADD COLUMN IF NOT EXISTS "variantId"  TEXT;

-- AlterTable: Supplier 擴充東泓欄位
ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "ccContacts"           TEXT[],
  ADD COLUMN IF NOT EXISTS "defaultCurrency"      TEXT DEFAULT 'TWD',
  ADD COLUMN IF NOT EXISTS "donghongBusinessUnit" "BusinessUnit" NOT NULL DEFAULT 'DONGHONG',
  ADD COLUMN IF NOT EXISTS "portalToken"          TEXT,
  ADD COLUMN IF NOT EXISTS "primaryContactEmail"  TEXT,
  ADD COLUMN IF NOT EXISTS "tokenExpiresAt"       TIMESTAMP(3);

-- CreateTable: ProductVariant
CREATE TABLE "ProductVariant" (
    "id"              TEXT NOT NULL,
    "masterSku"       TEXT NOT NULL,
    "originCode"      "OriginCode" NOT NULL,
    "variantSku"      TEXT NOT NULL,
    "countryOrigin"   "CountryOrigin" NOT NULL,
    "hsCode"          TEXT,
    "productImage"    TEXT,
    "packageImage"    TEXT,
    "defaultSpecLock" JSONB,
    "masterProductId" TEXT,
    "supplierId"      TEXT,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "businessUnit"    "BusinessUnit" NOT NULL DEFAULT 'DONGHONG',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VariantBarcode
CREATE TABLE "VariantBarcode" (
    "id"              TEXT NOT NULL,
    "variantId"       TEXT NOT NULL,
    "barcodeEan13"    TEXT NOT NULL,
    "barcodeType"     TEXT NOT NULL,
    "quantityPerUnit" INTEGER NOT NULL DEFAULT 1,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariantBarcode_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VariantCostSnapshot
CREATE TABLE "VariantCostSnapshot" (
    "id"            TEXT NOT NULL,
    "variantId"     TEXT NOT NULL,
    "unitCost"      DECIMAL(12,4) NOT NULL,
    "currency"      TEXT NOT NULL DEFAULT 'CNY',
    "unitCostTwd"   DECIMAL(12,4) NOT NULL,
    "exchangeRate"  DECIMAL(10,6) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "sourcePoId"    TEXT,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariantCostSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SupplierQuotation
CREATE TABLE "SupplierQuotation" (
    "id"              TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "supplierId"      TEXT NOT NULL,
    "quotedAt"        TIMESTAMP(3) NOT NULL,
    "validFrom"       TIMESTAMP(3) NOT NULL,
    "validUntil"      TIMESTAMP(3) NOT NULL,
    "currency"        TEXT NOT NULL DEFAULT 'CNY',
    "incoterms"       TEXT,
    "paymentTerms"    TEXT,
    "minOrderQty"     INTEGER,
    "leadTimeDays"    INTEGER,
    "status"          "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes"           TEXT,
    "attachmentUrl"   TEXT,
    "supersededById"  TEXT,
    "businessUnit"    "BusinessUnit" NOT NULL DEFAULT 'DONGHONG',
    "createdById"     TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SupplierQuotationItem
CREATE TABLE "SupplierQuotationItem" (
    "id"          TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "variantId"   TEXT NOT NULL,
    "unitPrice"   DECIMAL(12,4) NOT NULL,
    "unit"        TEXT NOT NULL DEFAULT 'pc',
    "packingSpec" TEXT,
    "specNotes"   JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierQuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: POSpecLock
CREATE TABLE "POSpecLock" (
    "id"           TEXT NOT NULL,
    "poId"         TEXT NOT NULL,
    "variantId"    TEXT,
    "specLockJson" JSONB NOT NULL,
    "lockedReason" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "POSpecLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable: POMilestone
CREATE TABLE "POMilestone" (
    "id"               TEXT NOT NULL,
    "poId"             TEXT NOT NULL,
    "milestoneType"    "POMilestoneType" NOT NULL,
    "sequenceNo"       INTEGER NOT NULL DEFAULT 1,
    "amountRatio"      DECIMAL(5,4),
    "amountCurrency"   DECIMAL(14,2) NOT NULL,
    "currency"         TEXT NOT NULL DEFAULT 'TWD',
    "amountTwd"        DECIMAL(14,2) NOT NULL,
    "triggerCondition" TEXT NOT NULL,
    "scheduledDate"    TIMESTAMP(3),
    "paidDate"         TIMESTAMP(3),
    "status"           "POMilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod"    TEXT,
    "transactionRef"   TEXT,
    "notes"            TEXT,
    "notifiedAt"       TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "POMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PODocument
CREATE TABLE "PODocument" (
    "id"           TEXT NOT NULL,
    "poId"         TEXT NOT NULL,
    "documentType" "PODocumentType" NOT NULL,
    "fileName"     TEXT NOT NULL,
    "fileUrl"      TEXT NOT NULL,
    "fileSize"     INTEGER,
    "fileHash"     TEXT,
    "mimeType"     TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"        TEXT,
    CONSTRAINT "PODocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable: POStatusLog
CREATE TABLE "POStatusLog" (
    "id"            TEXT NOT NULL,
    "poId"          TEXT NOT NULL,
    "fromStatus"    "DonghongPOStatus",
    "toStatus"      "DonghongPOStatus" NOT NULL,
    "changedById"   TEXT,
    "changedByRole" TEXT,
    "changeReason"  TEXT,
    "metadata"      JSONB,
    "ipAddress"     TEXT,
    "userAgent"     TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "POStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ProductVariant
CREATE UNIQUE INDEX "ProductVariant_variantSku_key"            ON "ProductVariant"("variantSku");
CREATE INDEX        "ProductVariant_masterSku_idx"             ON "ProductVariant"("masterSku");
CREATE INDEX        "ProductVariant_supplierId_idx"            ON "ProductVariant"("supplierId");
CREATE INDEX        "ProductVariant_isActive_businessUnit_idx" ON "ProductVariant"("isActive", "businessUnit");

-- CreateIndex: VariantBarcode
CREATE UNIQUE INDEX "VariantBarcode_barcodeEan13_key" ON "VariantBarcode"("barcodeEan13");
CREATE INDEX        "VariantBarcode_variantId_idx"    ON "VariantBarcode"("variantId");

-- CreateIndex: VariantCostSnapshot
CREATE INDEX "VariantCostSnapshot_variantId_effectiveDate_idx" ON "VariantCostSnapshot"("variantId", "effectiveDate");

-- CreateIndex: SupplierQuotation
CREATE UNIQUE INDEX "SupplierQuotation_quotationNumber_key"    ON "SupplierQuotation"("quotationNumber");
CREATE INDEX        "SupplierQuotation_supplierId_status_idx"  ON "SupplierQuotation"("supplierId", "status");
CREATE INDEX        "SupplierQuotation_validUntil_idx"         ON "SupplierQuotation"("validUntil");

-- CreateIndex: SupplierQuotationItem
CREATE INDEX        "SupplierQuotationItem_variantId_idx"          ON "SupplierQuotationItem"("variantId");
CREATE UNIQUE INDEX "SupplierQuotationItem_quotationId_variantId_key" ON "SupplierQuotationItem"("quotationId", "variantId");

-- CreateIndex: POSpecLock
CREATE INDEX "POSpecLock_poId_idx"     ON "POSpecLock"("poId");
CREATE INDEX "POSpecLock_variantId_idx" ON "POSpecLock"("variantId");

-- CreateIndex: POMilestone
CREATE INDEX        "POMilestone_status_scheduledDate_idx" ON "POMilestone"("status", "scheduledDate");
CREATE UNIQUE INDEX "POMilestone_poId_sequenceNo_key"      ON "POMilestone"("poId", "sequenceNo");

-- CreateIndex: PODocument
CREATE INDEX "PODocument_poId_documentType_idx" ON "PODocument"("poId", "documentType");

-- CreateIndex: POStatusLog
CREATE INDEX "POStatusLog_poId_createdAt_idx" ON "POStatusLog"("poId", "createdAt");

-- CreateIndex: Product
CREATE UNIQUE INDEX "Product_masterSku_key"    ON "Product"("masterSku");
CREATE INDEX        "Product_isMasterSku_idx"  ON "Product"("isMasterSku");
CREATE INDEX        "Product_businessUnit_idx" ON "Product"("businessUnit");

-- CreateIndex: PurchaseOrder
CREATE INDEX "PurchaseOrder_supplierId_status_idx"      ON "PurchaseOrder"("supplierId", "status");
CREATE INDEX "PurchaseOrder_status_createdAt_idx"       ON "PurchaseOrder"("status", "createdAt" DESC);
CREATE INDEX "PurchaseOrder_expectedDate_idx"           ON "PurchaseOrder"("expectedDate");
CREATE INDEX "PurchaseOrder_donghongStatus_idx"         ON "PurchaseOrder"("donghongStatus");
CREATE INDEX "PurchaseOrder_donghongBusinessUnit_idx"   ON "PurchaseOrder"("donghongBusinessUnit");

-- CreateIndex: PurchaseOrderItem
CREATE INDEX "PurchaseOrderItem_variantId_idx" ON "PurchaseOrderItem"("variantId");

-- CreateIndex: Supplier
CREATE UNIQUE INDEX "Supplier_portalToken_key" ON "Supplier"("portalToken");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultVariantId_fkey"
  FOREIGN KEY ("defaultVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierQuotationId_fkey"
  FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_specLockId_fkey"
  FOREIGN KEY ("specLockId") REFERENCES "POSpecLock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_masterProductId_fkey"
  FOREIGN KEY ("masterProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VariantBarcode" ADD CONSTRAINT "VariantBarcode_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariantCostSnapshot" ADD CONSTRAINT "VariantCostSnapshot_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "SupplierQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotationItem" ADD CONSTRAINT "SupplierQuotationItem_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotationItem" ADD CONSTRAINT "SupplierQuotationItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "POSpecLock" ADD CONSTRAINT "POSpecLock_poId_fkey"
  FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "POMilestone" ADD CONSTRAINT "POMilestone_poId_fkey"
  FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PODocument" ADD CONSTRAINT "PODocument_poId_fkey"
  FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "POStatusLog" ADD CONSTRAINT "POStatusLog_poId_fkey"
  FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
