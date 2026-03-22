-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES', 'CARE_SUPERVISOR', 'ECOMMERCE', 'CS', 'WAREHOUSE_MANAGER', 'WAREHOUSE', 'PROCUREMENT', 'FINANCE');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('NURSING_HOME', 'CARE_HOME', 'ELDERLY_HOME', 'SOCIAL_WELFARE', 'DAY_CARE', 'HOME_CARE', 'HOSPITAL', 'DISTRIBUTOR', 'MEDICAL_CHANNEL', 'PHARMACY_CHANNEL', 'B2C_OFFICIAL', 'B2C_SHOPEE', 'B2C_MOMO', 'B2C_OTHER', 'OTHER');

-- CreateEnum
CREATE TYPE "OrgLevel" AS ENUM ('HEADQUARTERS', 'BRANCH', 'STANDALONE');

-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('PURCHASING', 'DIRECTOR', 'HEAD_NURSE', 'ACCOUNTING', 'ADMIN', 'OWNER', 'WAREHOUSE', 'RECEIVING', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactTimeSlot" AS ENUM ('MORNING_9_11', 'NOON_11_13', 'AFTERNOON_13_15', 'AFTERNOON_15_17', 'BEFORE_NIGHT', 'AFTER_NIGHT', 'FLEXIBLE', 'NEED_LINE', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomerGrade" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "CustomerDevStatus" AS ENUM ('POTENTIAL', 'CONTACTED', 'VISITED', 'NEGOTIATING', 'TRIAL', 'CLOSED', 'STABLE_REPURCHASE', 'DORMANT', 'CHURNED', 'REJECTED', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomerSource" AS ENUM ('COLD_CALL', 'REFERRAL', 'EXHIBITION', 'ADVERTISING', 'WEBSITE');

-- CreateEnum
CREATE TYPE "SalesRegion" AS ENUM ('NORTH_METRO', 'KEELUNG_YILAN', 'HSINCHU_MIAOLI', 'TAICHUNG_AREA', 'YUNLIN_CHIAYI', 'TAINAN_KAOHSIUNG', 'HUALIEN_TAITUNG', 'OFFSHORE');

-- CreateEnum
CREATE TYPE "ForeignCaregiverCountry" AS ENUM ('INDONESIA', 'VIETNAM', 'PHILIPPINES', 'THAILAND', 'OTHER', 'NONE');

-- CreateEnum
CREATE TYPE "OrderFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'IRREGULAR', 'URGENT_ONLY');

-- CreateEnum
CREATE TYPE "ForecastConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "DemandProductCategory" AS ENUM ('DIAPER_LARGE', 'DIAPER_SMALL', 'UNDERPAD', 'WIPES', 'OTHER');

-- CreateEnum
CREATE TYPE "ManagementQualityLevel" AS ENUM ('GOOD', 'AVERAGE', 'NEEDS_IMPROVEMENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BrandSwitchFrequency" AS ENUM ('ALMOST_NEVER', 'OCCASIONAL_TEST', 'QUARTERLY_EVAL', 'FREQUENT', 'PRICE_DRIVEN');

-- CreateEnum
CREATE TYPE "ProcurementDecisionStyle" AS ENUM ('PRICE_ORIENTED', 'QUALITY_ORIENTED', 'STABLE_SUPPLY_ORIENTED', 'MANAGEMENT_DECIDES', 'FRONTLINE_DECIDES', 'MIXED');

-- CreateEnum
CREATE TYPE "SamplePurpose" AS ENUM ('TRIAL', 'COMPARISON', 'EDUCATION', 'NEGOTIATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ComplaintAction" AS ENUM ('PHONE_CALL', 'ONSITE_VISIT', 'LINE_MSG', 'EMAIL', 'INTERNAL', 'PRODUCT_EXCHANGE', 'REFUND', 'CLOSURE');

-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('COMPLAINT', 'AFTER_SALES', 'RETURN', 'PRODUCT_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FollowUpLogType" AS ENUM ('CALL', 'LINE', 'EMAIL', 'MEETING', 'FIRST_VISIT', 'SECOND_VISIT', 'THIRD_VISIT', 'DELIVERY', 'SPRING_PARTY', 'EXPO', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('PROSPECTING', 'CONTACTED', 'VISITED', 'NEEDS_ANALYSIS', 'SAMPLING', 'QUOTED', 'NEGOTIATING', 'REGULAR_ORDER', 'LOST', 'INACTIVE');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'CUSTOMER_REVIEWING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('B2B', 'B2C', 'RECURRING', 'TRIAL', 'REPLENISH', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('SALES_INPUT', 'PHONE', 'LINE', 'SHOPEE', 'MOMO', 'WEBSITE', 'DISTRIBUTOR_IMPORT', 'AUTO_RECURRING');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'ALLOCATING', 'READY_TO_SHIP', 'PARTIAL_SHIPPED', 'SHIPPED', 'SIGNED', 'COMPLETED', 'CANCELLED', 'RETURNING', 'RETURNED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('IN', 'OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'SCRAP', 'RETURN');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('FINISHED_GOODS', 'OEM_PENDING', 'IN_TRANSIT', 'PACKAGING', 'RAW_MATERIAL', 'DEFECTIVE', 'GIFT_PROMO');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'LOCKED', 'PENDING_QC', 'DEFECTIVE', 'SCRAPPED', 'IN_TRANSIT', 'PENDING_TRANSFER');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'COUNTING', 'REVIEWING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryTripStatus" AS ENUM ('PLANNED', 'DEPARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('OWN_FLEET', 'OUTSOURCED', 'EXPRESS', 'FREIGHT', 'COLD_CHAIN', 'SELF_PICKUP');

-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('RETURN', 'EXCHANGE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'RECEIVING', 'RECEIVED', 'INSPECTING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignStatus" AS ENUM ('PENDING', 'SIGNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('NORMAL', 'DELAY', 'LOST', 'DAMAGE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PREPARING', 'PACKED', 'SHIPPED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'SOURCING', 'ORDERED', 'FACTORY_CONFIRMED', 'IN_PRODUCTION', 'PARTIAL', 'RECEIVED', 'INSPECTED', 'WAREHOUSED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('FINISHED_GOODS', 'OEM', 'PACKAGING', 'RAW_MATERIAL', 'AUXILIARY', 'SPARE_PARTS', 'SAMPLE', 'GIFT_PROMO', 'LOGISTICS_SUPPLIES');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('VISIT', 'CALL', 'FOLLOW_UP', 'PROPOSAL', 'DEMO', 'ADMIN', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('FIRST_VISIT', 'SECOND_VISIT', 'THIRD_VISIT', 'PAYMENT_COLLECT', 'DELIVERY', 'EXPO', 'SPRING_PARTY', 'RECONCILE', 'OTHER');

-- CreateEnum
CREATE TYPE "SalesEventType" AS ENUM ('ORDER', 'DELIVERY', 'PAYMENT', 'RECONCILE', 'INVOICE_RECEIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "CareVisitType" AS ENUM ('ROUTINE_VISIT', 'TRAINING', 'ONBOARDING', 'COMPLAINT_FOLLOW', 'PRODUCT_DEMO', 'OTHER');

-- CreateEnum
CREATE TYPE "CareScheduleStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('SKIN_ISSUE', 'PRODUCT_CHANGE', 'TRAINING', 'COMPLAINT', 'SUPPLY_ISSUE', 'NEW_ONBOARD', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "QcInspectionType" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'IN_PRODUCTION', 'FINISHED_PRODUCT', 'PRE_SHIPMENT', 'INCOMING', 'COMPLAINT_TRACE');

-- CreateEnum
CREATE TYPE "QcStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "QcResult" AS ENUM ('ACCEPTED', 'CONDITIONAL_ACCEPT', 'REWORK', 'RETURN_TO_SUPPLIER', 'SUPPLEMENT', 'DEDUCTION', 'ANOMALY_CLOSED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'AUDIO', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('PENDING', 'SAMPLE_SUBMITTED', 'SAMPLE_APPROVED', 'IN_PRODUCTION', 'QC_INSPECTION', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FreightStatus" AS ENUM ('PENDING', 'BOOKED', 'FACTORY_EXIT', 'CONSOLIDATED', 'LOADED', 'CUSTOMS_DECLARE', 'CUSTOMS_CLEARED', 'IN_TRANSIT', 'ARRIVED', 'CUSTOMS_DEST', 'DEVANNING', 'DELIVERING', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomsStatus" AS ENUM ('NOT_STARTED', 'SUBMITTED', 'INSPECTING', 'CLEARED', 'HELD');

-- CreateEnum
CREATE TYPE "ChannelPlatform" AS ENUM ('SHOPEE', 'MOMO', 'PCHOME', 'YAHOO', 'RAKUTEN', 'LINE_SHOP', 'OFFICIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ChannelOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'PROGRESS', 'FINAL', 'FULL', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ArStatus" AS ENUM ('NOT_DUE', 'DUE', 'PARTIAL_PAID', 'PAID', 'BAD_DEBT');

-- CreateEnum
CREATE TYPE "ApStatus" AS ENUM ('NOT_DUE', 'DUE', 'PARTIAL_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('COMPLAINT', 'SKIN_ISSUE', 'PRODUCT_DEFECT', 'CARE_PROCESS', 'STAFF_FEEDBACK', 'FAMILY_COMPLAINT', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSource" AS ENUM ('PHONE_CALL', 'LINE_MESSAGE', 'ON_SITE_VISIT', 'EMAIL', 'SALES_REP', 'SUPERVISOR', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_VISIT', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SymptomCategory" AS ENUM ('SKIN_REDNESS', 'SKIN_ULCER', 'ALLERGIC_REACTION', 'PRODUCT_LEAKAGE', 'FIT_ISSUE', 'ODOR_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('SITE_PHOTO', 'SKIN_PHOTO', 'CHAT_SCREENSHOT', 'AUDIO_RECORDING', 'TRANSCRIPT', 'TRAINING_PHOTO', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScrapCategory" AS ENUM ('DAMAGED', 'EXPIRED', 'QC_REJECT', 'CUSTOMER_RETURN', 'WATER_DAMAGE', 'PEST_DAMAGE', 'TRANSIT_DAMAGE', 'COUNT_LOSS', 'OTHER');

-- CreateEnum
CREATE TYPE "StockCountType" AS ENUM ('FULL', 'CYCLE', 'SPOT', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ShipmentAnomalyType" AS ENUM ('SHORT_DELIVERY', 'OVER_DELIVERY', 'WRONG_PRODUCT', 'WRONG_ADDRESS', 'DELAY', 'DAMAGE_IN_TRANSIT', 'CUSTOMER_REJECT', 'MISSING_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PhotoSource" AS ENUM ('CUSTOMER_PROVIDED', 'ONSITE_PHOTO', 'LINE_SCREENSHOT', 'FOLLOWUP_PHOTO', 'SALESPERSON_TAKEN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "employeeNo" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engName" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SALES',
    "departmentId" TEXT,
    "title" TEXT,
    "mobile" TEXT,
    "lineId" TEXT,
    "hireDate" TIMESTAMP(3),
    "resignDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "canViewCost" BOOLEAN NOT NULL DEFAULT false,
    "canViewMargin" BOOLEAN NOT NULL DEFAULT false,
    "canViewFinance" BOOLEAN NOT NULL DEFAULT false,
    "canCrossWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "canCrossCompany" BOOLEAN NOT NULL DEFAULT false,
    "canViewSensitivePhoto" BOOLEAN NOT NULL DEFAULT false,
    "canViewFloorPrice" BOOLEAN NOT NULL DEFAULT false,
    "dataScope" TEXT NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalFlow" (
    "id" TEXT NOT NULL,
    "flowName" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "triggerCondition" TEXT,
    "level1Role" TEXT,
    "level2Role" TEXT,
    "level3Role" TEXT,
    "minAmount" DECIMAL(12,2),
    "maxAmount" DECIMAL(12,2),
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "series" TEXT,
    "size" TEXT,
    "packagingType" TEXT,
    "piecesPerPack" INTEGER,
    "packsPerBox" INTEGER,
    "specification" TEXT,
    "unit" TEXT NOT NULL DEFAULT '包',
    "boxQuantity" INTEGER,
    "barcode" TEXT,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "floorPrice" DECIMAL(10,2),
    "sellingPrice" DECIMAL(10,2) NOT NULL,
    "channelPrice" DECIMAL(10,2),
    "wholesalePrice" DECIMAL(10,2),
    "minSellPrice" DECIMAL(10,2),
    "oemBasePrice" DECIMAL(10,2),
    "factorySku" TEXT,
    "moq" INTEGER,
    "leadTimeDays" INTEGER,
    "weight" DECIMAL(8,3),
    "volume" TEXT,
    "storageNotes" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBOM" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(10,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "alternativeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,

    CONSTRAINT "ProductBOM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitConversion" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "fromUnit" TEXT NOT NULL,
    "toUnit" TEXT NOT NULL,
    "conversionRate" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCostStructure" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "standardCost" DECIMAL(10,2),
    "factoryCost" DECIMAL(10,2),
    "packagingCost" DECIMAL(10,2),
    "intlLogisticsCost" DECIMAL(10,2),
    "customsCost" DECIMAL(10,2),
    "storageCost" DECIMAL(10,2),
    "domesticLogisticsCost" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCostStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "type" "CustomerType" NOT NULL,
    "subType" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "lineId" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "deliveryAddress" TEXT,
    "city" TEXT,
    "region" "SalesRegion",
    "country" TEXT DEFAULT 'TW',
    "taxId" TEXT,
    "invoiceTitle" TEXT,
    "invoiceAddress" TEXT,
    "paymentTerms" TEXT,
    "creditLimit" DECIMAL(12,2),
    "billingCycle" TEXT,
    "collectionMethod" TEXT,
    "isMonthly" BOOLEAN NOT NULL DEFAULT false,
    "monthlySettleDay" INTEGER,
    "bankInfo" TEXT,
    "needsPO" BOOLEAN NOT NULL DEFAULT false,
    "needsStampedQuote" BOOLEAN NOT NULL DEFAULT false,
    "needsInvoiceRequest" BOOLEAN NOT NULL DEFAULT false,
    "hasContractPrice" BOOLEAN NOT NULL DEFAULT false,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "renewalRemindDate" TIMESTAMP(3),
    "grade" "CustomerGrade",
    "customerValueGrade" TEXT,
    "profitGrade" TEXT,
    "riskLevel" TEXT,
    "paymentStability" TEXT,
    "cooperationStability" TEXT,
    "devStatus" "CustomerDevStatus" NOT NULL DEFAULT 'POTENTIAL',
    "source" "CustomerSource",
    "salesRepId" TEXT,
    "winRate" INTEGER,
    "estimatedMonthlyVolume" DECIMAL(12,2),
    "estimatedAnnualVolume" DECIMAL(12,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCorporateFoundation" BOOLEAN NOT NULL DEFAULT false,
    "corporateFoundationName" TEXT,
    "branchName" TEXT,
    "orgLevel" "OrgLevel",
    "bedCount" INTEGER,
    "lastContactDate" TIMESTAMP(3),
    "nextFollowUpDate" TIMESTAMP(3),
    "isFollowUp" BOOLEAN NOT NULL DEFAULT true,
    "healthScore" INTEGER DEFAULT 100,
    "healthLevel" TEXT,
    "healthUpdatedAt" TIMESTAMP(3),
    "lastOrderDate" TIMESTAMP(3),
    "avgOrderInterval" INTEGER,
    "lifetimeValue" DECIMAL(14,2),
    "churnReason" TEXT,
    "churnDate" TIMESTAMP(3),
    "churnNote" TEXT,
    "creditUsed" DECIMAL(12,2) DEFAULT 0,
    "creditAvailable" DECIMAL(12,2),
    "creditUpdatedAt" TIMESTAMP(3),
    "isCreditHold" BOOLEAN NOT NULL DEFAULT false,
    "saturdayDelivery" BOOLEAN NOT NULL DEFAULT false,
    "callBeforeDelivery" BOOLEAN NOT NULL DEFAULT false,
    "floorCarry" BOOLEAN NOT NULL DEFAULT false,
    "floorCarryNote" TEXT,
    "monthlyRestDays" TEXT,
    "deliveryTimeWindow" TEXT,
    "deliveryNote" TEXT,
    "isBlacklist" BOOLEAN NOT NULL DEFAULT false,
    "isWhitelist" BOOLEAN NOT NULL DEFAULT false,
    "isHighRisk" BOOLEAN NOT NULL DEFAULT false,
    "riskNote" TEXT,
    "isSupplyStopped" BOOLEAN NOT NULL DEFAULT false,
    "supplyStopReason" TEXT,
    "supplyStopDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "ContactRole",
    "title" TEXT,
    "department" TEXT,
    "mobile" TEXT,
    "phone" TEXT,
    "phoneExt" TEXT,
    "email" TEXT,
    "lineId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "preferredContactTime" "ContactTimeSlot",
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "changeReason" TEXT,
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerUsageProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "profileDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalBeds" INTEGER,
    "occupiedBeds" INTEGER,
    "vacantBeds" INTEGER,
    "residentCareNote" TEXT,
    "foreignCaregiverRatio" DOUBLE PRECISION,
    "foreignCaregiverCountry" "ForeignCaregiverCountry",
    "managementQuality" "ManagementQualityLevel",
    "currentBrands" TEXT,
    "competitorBrands" TEXT,
    "brandSwitchFreq" "BrandSwitchFrequency",
    "easySwitchBrand" BOOLEAN,
    "procurementStyle" "ProcurementDecisionStyle",
    "dailyDiaperLargeQty" INTEGER,
    "dailyDiaperSmallQty" INTEGER,
    "dailyUnderpadsQty" INTEGER,
    "dailyWipesQty" INTEGER,
    "usesWipes" BOOLEAN NOT NULL DEFAULT false,
    "monthlyDiaperLargeQty" INTEGER,
    "monthlyDiaperSmallQty" INTEGER,
    "monthlyUnderpadsQty" INTEGER,
    "monthlyWipesQty" INTEGER,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerUsageProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDemandForecast" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "forecastMonth" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dailyDiaperLargeQty" INTEGER,
    "dailyDiaperSmallQty" INTEGER,
    "dailyUnderpadsQty" INTEGER,
    "dailyWipesQty" INTEGER,
    "monthlyDiaperLargeQty" INTEGER,
    "monthlyDiaperSmallQty" INTEGER,
    "monthlyUnderpadsQty" INTEGER,
    "monthlyWipesQty" INTEGER,
    "orderFrequency" "OrderFrequency",
    "avgOrderQty" INTEGER,
    "nextExpectedOrderDate" TIMESTAMP(3),
    "forecastConfidence" "ForecastConfidence",
    "notes" TEXT,
    "avgDaysBetweenOrders" INTEGER,
    "avgCasesPerOrder" DECIMAL(10,2),
    "last3OrdersTrend" TEXT,
    "predictedNextOrderDate" TIMESTAMP(3),
    "analyticsUpdatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDemandForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDeliveryProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deliveryAddress" TEXT,
    "unloadingLocation" TEXT,
    "unloadingFloor" INTEGER,
    "hasElevator" BOOLEAN,
    "needsCart" BOOLEAN,
    "hasReception" BOOLEAN,
    "receivingHours" TEXT,
    "suggestedDeliveryTime" TEXT,
    "parkingNotes" TEXT,
    "routeNotes" TEXT,
    "receiverName" TEXT,
    "receiverPhone" TEXT,
    "deliveryNotes" TEXT,
    "photoUrls" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDeliveryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRequirement" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bedCount" INTEGER,
    "residentCount" INTEGER,
    "currentBrand" TEXT,
    "currentSpec" TEXT,
    "monthlyUsage" INTEGER,
    "currentUnitPrice" DECIMAL(10,2),
    "procurementMode" TEXT,
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "trialSentDate" TIMESTAMP(3),
    "trialFeedback" TEXT,
    "decisionMaker" TEXT,
    "purchaseContact" TEXT,
    "financeContact" TEXT,
    "receivingContact" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerChangeLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "fieldName" TEXT,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDuplicateCheck" (
    "id" TEXT NOT NULL,
    "customerAId" TEXT NOT NULL,
    "customerBId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "mergeTargetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDuplicateCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMergeLog" (
    "id" TEXT NOT NULL,
    "survivorId" TEXT NOT NULL,
    "mergedId" TEXT NOT NULL,
    "mergedCode" TEXT NOT NULL,
    "mergedName" TEXT NOT NULL,
    "movedOrders" INTEGER NOT NULL DEFAULT 0,
    "movedContacts" INTEGER NOT NULL DEFAULT 0,
    "movedComplaints" INTEGER NOT NULL DEFAULT 0,
    "movedPayments" INTEGER NOT NULL DEFAULT 0,
    "mergedById" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "CustomerMergeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "visitedById" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "visitMethod" TEXT,
    "purpose" TEXT,
    "participants" TEXT,
    "content" TEXT,
    "customerNeeds" TEXT,
    "competitorInfo" TEXT,
    "result" TEXT,
    "nextAction" TEXT,
    "nextVisitDate" TIMESTAMP(3),
    "followUpStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "calledById" TEXT NOT NULL,
    "callDate" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "purpose" TEXT,
    "content" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "sentDate" TIMESTAMP(3) NOT NULL,
    "items" TEXT NOT NULL,
    "quantity" INTEGER,
    "purpose" "SamplePurpose",
    "trackingNo" TEXT,
    "recipient" TEXT,
    "hasFeedback" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "followUpResult" TEXT,
    "outcome" TEXT,
    "sampleCost" DECIMAL(10,2),
    "shippingCost" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2),
    "isTrialOrder" BOOLEAN NOT NULL DEFAULT false,
    "trialRisk" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "complaintDate" TIMESTAMP(3) NOT NULL,
    "type" "ComplaintType" NOT NULL DEFAULT 'COMPLAINT',
    "content" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "ComplaintSeverity" NOT NULL DEFAULT 'MEDIUM',
    "assignedSupervisorId" TEXT,
    "supervisorAppointDate" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "firstResponseMethod" TEXT,
    "nextFollowUpDate" TIMESTAMP(3),
    "nextFollowUpMethod" TEXT,
    "handler" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "photoUrls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplaintRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintLog" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "ComplaintAction" NOT NULL,
    "description" TEXT NOT NULL,
    "nextFollowUpDate" TIMESTAMP(3),
    "nextFollowUpMethod" TEXT,
    "photoUrls" JSONB,
    "loggedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logType" "FollowUpLogType" NOT NULL DEFAULT 'CALL',
    "method" TEXT,
    "contactPersonId" TEXT,
    "content" TEXT NOT NULL,
    "result" TEXT,
    "customerReaction" TEXT,
    "nextFollowUpDate" TIMESTAMP(3),
    "nextAction" TEXT,
    "hasSample" BOOLEAN NOT NULL DEFAULT false,
    "sampleItems" TEXT,
    "hasQuote" BOOLEAN NOT NULL DEFAULT false,
    "hasOrder" BOOLEAN NOT NULL DEFAULT false,
    "opportunityId" TEXT,
    "taskCreated" BOOLEAN NOT NULL DEFAULT false,
    "taskId" TEXT,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT true,
    "attachments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOpportunity" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'PROSPECTING',
    "probability" INTEGER NOT NULL DEFAULT 10,
    "expectedAmount" DECIMAL(12,2),
    "expectedCloseDate" TIMESTAMP(3),
    "productInterest" TEXT,
    "competitorInfo" TEXT,
    "lostReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTagMap" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerTagMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRepChange" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "previousRepId" TEXT,
    "newRepId" TEXT NOT NULL,
    "changeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeReason" TEXT,
    "handoverNote" TEXT,
    "handoverStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRepChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetMonth" DATE NOT NULL,
    "revenueTarget" DECIMAL(14,2) NOT NULL,
    "orderTarget" INTEGER,
    "visitTarget" INTEGER,
    "newCustTarget" INTEGER,
    "revenueActual" DECIMAL(14,2),
    "achieveRate" DECIMAL(5,2),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerType" "CustomerType",
    "customerId" TEXT,
    "channel" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "region" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "standardPrice" DECIMAL(10,2) NOT NULL,
    "specialPrice" DECIMAL(10,2),
    "discountRate" DECIMAL(5,2),
    "floorPrice" DECIMAL(10,2),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quotationNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerContactId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "validUntil" TIMESTAMP(3),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "taxType" TEXT,
    "paymentTerm" TEXT,
    "deliveryTerm" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" TEXT,
    "approvedById" TEXT,
    "attachment" TEXT,
    "previousVersionId" TEXT,
    "versionNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnap" TEXT,
    "skuSnap" TEXT,
    "specSnap" TEXT,
    "unit" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "costSnap" DECIMAL(10,2),
    "grossMargin" DECIMAL(12,2),
    "grossMarginRate" DECIMAL(5,2),
    "notes" TEXT,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationApproval" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "triggerReason" TEXT,
    "approverId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerContactId" TEXT,
    "quotationId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderType" "OrderType" NOT NULL DEFAULT 'B2B',
    "orderSource" "OrderSource" NOT NULL DEFAULT 'SALES_INPUT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedDeliveryDate" TIMESTAMP(3),
    "promisedDeliveryDate" TIMESTAMP(3),
    "warehouseId" TEXT,
    "shippingMethod" TEXT,
    "paymentTerm" TEXT,
    "billingTerm" TEXT,
    "invoiceType" TEXT,
    "taxType" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shippingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costOfGoods" DECIMAL(12,2),
    "grossProfit" DECIMAL(12,2),
    "grossMarginPct" DECIMAL(5,2),
    "deliveryCost" DECIMAL(10,2),
    "netProfit" DECIMAL(12,2),
    "isSplitOrder" BOOLEAN NOT NULL DEFAULT false,
    "splitFromOrderId" TEXT,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "urgentReason" TEXT,
    "isSupportShipment" BOOLEAN NOT NULL DEFAULT false,
    "invoiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnap" TEXT,
    "skuSnap" TEXT,
    "specSnap" TEXT,
    "boxQty" INTEGER,
    "packQty" INTEGER,
    "pieceQty" INTEGER,
    "quantity" INTEGER NOT NULL,
    "shippedQty" INTEGER NOT NULL DEFAULT 0,
    "giftQty" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "frequency" TEXT NOT NULL,
    "intervalDays" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "pauseFrom" TIMESTAMP(3),
    "pauseTo" TIMESTAMP(3),
    "nextDeliveryDate" TIMESTAMP(3),
    "autoCreateOrder" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringOrderItem" (
    "id" TEXT NOT NULL,
    "recurringOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "RecurringOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "category" "InventoryCategory" NOT NULL DEFAULT 'FINISHED_GOODS',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "availableQty" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "lockedQty" INTEGER NOT NULL DEFAULT 0,
    "damagedQty" INTEGER NOT NULL DEFAULT 0,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "lastCountDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "lotId" TEXT,
    "category" "InventoryCategory",
    "type" "TransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "beforeQty" INTEGER,
    "afterQty" INTEGER,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouseType" TEXT,
    "address" TEXT,
    "managerId" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalCapacityBoxes" INTEGER,
    "totalCapacityPallets" INTEGER,
    "currentOccupancy" INTEGER DEFAULT 0,
    "monthlyRent" DECIMAL(12,2),
    "rentDueDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "rack" TEXT,
    "position" TEXT,
    "locationType" TEXT,
    "maxCapacity" INTEGER,
    "capacityUnit" TEXT DEFAULT 'BOX',
    "currentOccupancy" INTEGER DEFAULT 0,
    "occupancyRate" DECIMAL(5,2),
    "isTemperatureControlled" BOOLEAN NOT NULL DEFAULT false,
    "isQuarantineZone" BOOLEAN NOT NULL DEFAULT false,
    "allowedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundRecord" (
    "id" TEXT NOT NULL,
    "inboundNo" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "seaFreightId" TEXT,
    "returnOrderId" TEXT,
    "arrivalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedById" TEXT,
    "qcResult" TEXT,
    "putawayStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "receivingPhotos" JSONB,
    "temperatureC" DECIMAL(4,1),
    "humidityPct" DECIMAL(4,1),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundItem" (
    "id" TEXT NOT NULL,
    "inboundId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT,
    "quantity" INTEGER NOT NULL,
    "expectedQty" INTEGER,
    "damageQty" INTEGER NOT NULL DEFAULT 0,
    "shortQty" INTEGER NOT NULL DEFAULT 0,
    "cartonCondition" TEXT,
    "receivingNote" TEXT,
    "locationCode" TEXT,
    "notes" TEXT,

    CONSTRAINT "InboundItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundRecord" (
    "id" TEXT NOT NULL,
    "outboundNo" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "orderId" TEXT,
    "shipDate" TIMESTAMP(3),
    "pickingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "packingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "shippedStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundItem" (
    "id" TEXT NOT NULL,
    "outboundId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT,
    "quantity" INTEGER NOT NULL,
    "pickedQty" INTEGER NOT NULL DEFAULT 0,
    "locationCode" TEXT,
    "notes" TEXT,

    CONSTRAINT "OutboundItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "lotNo" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "location" TEXT,
    "category" "InventoryCategory" NOT NULL DEFAULT 'FINISHED_GOODS',
    "status" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lockedQty" INTEGER NOT NULL DEFAULT 0,
    "manufactureDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "inboundDate" TIMESTAMP(3),
    "daysToExpiry" INTEGER,
    "isNearExpiry" BOOLEAN NOT NULL DEFAULT false,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "quarantineReason" TEXT,
    "quarantineDate" TIMESTAMP(3),
    "releaseDate" TIMESTAMP(3),
    "releasedById" TEXT,
    "sourceFactory" TEXT,
    "purchaseOrderId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "transferNo" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "countNo" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "countDate" TIMESTAMP(3),
    "countType" TEXT NOT NULL DEFAULT 'FULL',
    "plannedDate" TIMESTAMP(3),
    "assignedToId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "totalItems" INTEGER,
    "totalVariance" INTEGER,
    "varianceRate" DECIMAL(5,2),
    "varianceAmount" DECIMAL(12,2),
    "photos" JSONB,
    "attachments" JSONB,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountItem" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "systemQty" INTEGER NOT NULL,
    "countedQty" INTEGER NOT NULL DEFAULT 0,
    "variance" INTEGER NOT NULL DEFAULT 0,
    "varianceReason" TEXT,
    "varianceAmount" DECIMAL(12,2),
    "adjustmentAction" TEXT,
    "adjustedById" TEXT,
    "adjustedAt" TIMESTAMP(3),
    "locationCode" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,

    CONSTRAINT "StockCountItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockScrap" (
    "id" TEXT NOT NULL,
    "scrapNo" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "scrapCategory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "unitCost" DECIMAL(10,2),
    "totalLoss" DECIMAL(12,2),
    "photos" JSONB,
    "batchNo" TEXT,
    "qcId" TEXT,
    "returnOrderId" TEXT,
    "factoryIncidentId" TEXT,
    "responsibility" TEXT,
    "approvedById" TEXT,
    "scrapDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockScrap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehousePickingStrategy" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'FEFO',
    "expiryAlertDays" INTEGER NOT NULL DEFAULT 90,
    "autoQuarantine" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehousePickingStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountSchedule" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "scheduledDay" INTEGER,
    "nextScheduleDate" TIMESTAMP(3) NOT NULL,
    "assignedToId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCountSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRecall" (
    "id" TEXT NOT NULL,
    "recallNo" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNos" TEXT[],
    "factoryId" TEXT,
    "recallReason" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "discoveredDate" TIMESTAMP(3) NOT NULL,
    "affectedCustomerCount" INTEGER,
    "affectedQuantity" INTEGER,
    "affectedShipmentIds" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "notificationDate" TIMESTAMP(3),
    "collectionDeadline" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "handleMethod" TEXT,
    "estimatedLoss" DECIMAL(12,2),
    "actualLoss" DECIMAL(12,2),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRecall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecallNotification" (
    "id" TEXT NOT NULL,
    "recallId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "affectedQty" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "notifyMethod" TEXT,
    "notifiedById" TEXT,
    "collectionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "collectedQty" INTEGER,
    "collectedDate" TIMESTAMP(3),
    "replacementSent" BOOLEAN NOT NULL DEFAULT false,
    "creditAmount" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecallNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsProvider" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regions" TEXT,
    "deliveryDays" INTEGER,
    "paymentTerms" TEXT,
    "rateCard" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "claimRules" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTrip" (
    "id" TEXT NOT NULL,
    "tripNo" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "routeId" TEXT,
    "vehicleNo" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "region" TEXT,
    "tripDate" TIMESTAMP(3) NOT NULL,
    "status" "DeliveryTripStatus" NOT NULL DEFAULT 'PLANNED',
    "totalFuelCost" DECIMAL(10,2),
    "tollFee" DECIMAL(10,2),
    "driverAllowance" DECIMAL(10,2),
    "otherCost" DECIMAL(10,2),
    "totalTripCost" DECIMAL(10,2),
    "actualStops" INTEGER,
    "totalKm" DECIMAL(8,1),
    "totalHours" DECIMAL(4,1),
    "departureTime" TIMESTAMP(3),
    "returnTime" TIMESTAMP(3),
    "deliveredCount" INTEGER,
    "failedCount" INTEGER,
    "isEmptyReturn" BOOLEAN NOT NULL DEFAULT false,
    "emptyReturnReason" TEXT,
    "actualWeight" DECIMAL(8,2),
    "loadRate" DECIMAL(5,2),
    "routeStops" JSONB,
    "routeMapUrl" TEXT,
    "driverAcceptedAt" TIMESTAMP(3),
    "driverStartedAt" TIMESTAMP(3),
    "driverCompletedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNo" TEXT NOT NULL,
    "vehicleType" TEXT,
    "maxWeight" DECIMAL(8,2),
    "maxVolume" DECIMAL(8,2),
    "owner" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "vehicleId" TEXT,
    "serviceArea" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRoute" (
    "id" TEXT NOT NULL,
    "routeName" TEXT NOT NULL,
    "region" TEXT,
    "estimatedStops" INTEGER,
    "estimatedKm" DECIMAL(8,1),
    "estimatedHours" DECIMAL(4,1),
    "scheduledDate" TIMESTAMP(3),
    "scheduledById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofOfDelivery" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "signerName" TEXT,
    "signedAt" TIMESTAMP(3),
    "photoUrl" TEXT,
    "anomalyNote" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "gpsLat" DECIMAL(10,7),
    "gpsLng" DECIMAL(10,7),
    "customerNotified" BOOLEAN NOT NULL DEFAULT false,
    "salesNotified" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofOfDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnOrder" (
    "id" TEXT NOT NULL,
    "returnNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "returnType" "ReturnType" NOT NULL DEFAULT 'RETURN',
    "reason" TEXT,
    "returnCategory" TEXT,
    "disposalMethod" TEXT,
    "responsibility" TEXT,
    "factoryClaimId" TEXT,
    "creditNoteId" TEXT,
    "affectsSalesKpi" BOOLEAN NOT NULL DEFAULT true,
    "kpiExemptReason" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "warehouseId" TEXT,
    "refundAmount" DECIMAL(12,2),
    "refundStatus" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnOrderItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "batchNo" TEXT,
    "disposalResult" TEXT,
    "qcResult" TEXT,
    "reason" TEXT,
    "condition" TEXT,
    "notes" TEXT,

    CONSTRAINT "ReturnOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "shipmentNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PREPARING',
    "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'EXPRESS',
    "logisticsProviderId" TEXT,
    "tripId" TEXT,
    "trackingNo" TEXT,
    "carrier" TEXT,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "address" TEXT,
    "palletCount" INTEGER,
    "boxCount" INTEGER,
    "weight" DECIMAL(10,3),
    "volume" TEXT,
    "shipDate" TIMESTAMP(3),
    "expectedDeliveryDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "signStatus" "SignStatus" NOT NULL DEFAULT 'PENDING',
    "anomalyStatus" "AnomalyStatus" NOT NULL DEFAULT 'NORMAL',
    "anomalyNote" TEXT,
    "freightCost" DECIMAL(10,2),
    "codFee" DECIMAL(10,2),
    "insuranceFee" DECIMAL(10,2),
    "surcharge" DECIMAL(10,2),
    "totalDeliveryCost" DECIMAL(10,2),
    "logisticsInvoiceNo" TEXT,
    "logisticsBillingRef" TEXT,
    "fuelCost" DECIMAL(10,2),
    "driverAllowanceCost" DECIMAL(10,2),
    "tollFeeCost" DECIMAL(10,2),
    "vehicleCost" DECIMAL(10,2),
    "anomalyType" TEXT,
    "anomalyResolution" TEXT,
    "anomalyResolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "batchNo" TEXT,
    "lotId" TEXT,
    "boxCount" INTEGER,
    "notes" TEXT,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "paymentTerms" TEXT,
    "country" TEXT,
    "capacity" TEXT,
    "moq" INTEGER,
    "avgDefectRate" DECIMAL(5,2),
    "leadTimeDays" INTEGER,
    "supplyCategories" TEXT,
    "supplyItems" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPriceHistory" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT,
    "itemName" TEXT NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "applicantId" TEXT,
    "purchaserId" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "orderType" "PurchaseType" NOT NULL DEFAULT 'FINISHED_GOODS',
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "deliveryTerm" TEXT,
    "paymentTerm" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "exchangeRate" DECIMAL(8,4),
    "warehouse" TEXT,
    "projectNo" TEXT,
    "specVersion" TEXT,
    "inspectionCriteria" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2),
    "taxAmount" DECIMAL(12,2),
    "freightCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalSettlement" DECIMAL(12,2),
    "notes" TEXT,
    "oemProjectNo" TEXT,
    "factory" TEXT,
    "sampleVersion" TEXT,
    "packagingVersion" TEXT,
    "productionBatch" TEXT,
    "inspectionRequirements" TEXT,
    "shippingLabelRequirements" TEXT,
    "customNotes" TEXT,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "packagingReadyDate" TIMESTAMP(3),
    "rawMaterialReadyDate" TIMESTAMP(3),
    "productionConfirmedDate" TIMESTAMP(3),
    "factoryShipDate" TIMESTAMP(3),
    "inspectionDate" TIMESTAMP(3),
    "supplementDate" TIMESTAMP(3),
    "defectRate" DECIMAL(5,2),
    "defectResponsibility" TEXT,
    "lossRate" DECIMAL(5,2),
    "delayReason" TEXT,
    "finalUnitCost" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'PRODUCT',
    "productId" TEXT,
    "materialId" TEXT,
    "skuSnap" TEXT,
    "nameSnap" TEXT,
    "specSnap" TEXT,
    "unit" TEXT,
    "quantity" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "currency" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxType" TEXT,
    "notes" TEXT,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagingMaterial" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "supplierId" TEXT,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "inTransitQty" INTEGER NOT NULL DEFAULT 0,
    "sentToFactoryQty" INTEGER NOT NULL DEFAULT 0,
    "wastageRate" DECIMAL(5,2),
    "unit" TEXT NOT NULL DEFAULT '個',
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagingMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialSupplier" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "moq" INTEGER,
    "leadTimeDays" INTEGER,
    "paymentTerms" TEXT,
    "originCountry" TEXT,
    "originCity" TEXT,
    "avgDefectRate" DECIMAL(5,2),
    "lastQcResult" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryMaterialTerm" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "usagePerUnit" DECIMAL(10,4),
    "usageUnit" TEXT,
    "wastageRate" DECIMAL(5,2),
    "supplyMode" TEXT NOT NULL DEFAULT 'BUYER',
    "factoryPrice" DECIMAL(10,4),
    "factoryCurrency" TEXT,
    "specRequirement" TEXT,
    "minGrade" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoryMaterialTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialShipment" (
    "id" TEXT NOT NULL,
    "shipmentNo" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "supplierId" TEXT,
    "factoryId" TEXT NOT NULL,
    "shippingMethod" TEXT,
    "carrier" TEXT,
    "trackingNo" TEXT,
    "originCountry" TEXT,
    "originPort" TEXT,
    "destCountry" TEXT,
    "destPort" TEXT,
    "shipDate" TIMESTAMP(3),
    "etaFactory" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "freightCost" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "purchaseOrderId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialShipmentItem" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "batchNo" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT,
    "receivedQty" INTEGER,
    "damageQty" INTEGER,
    "qcResult" TEXT,
    "notes" TEXT,

    CONSTRAINT "MaterialShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryIncident" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "factoryId" TEXT,
    "incidentType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "occurredDate" TIMESTAMP(3) NOT NULL,
    "affectedQty" INTEGER,
    "affectedBatchNo" TEXT,
    "delayDays" INTEGER,
    "responsibility" TEXT,
    "resolution" TEXT,
    "compensationAmount" DECIMAL(12,2),
    "creditNoteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "photos" JSONB,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoryIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "salesOrderId" TEXT,
    "purchaseOrderId" TEXT,
    "customerId" TEXT,
    "supplierId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT,
    "bankAccount" TEXT,
    "referenceNo" TEXT,
    "invoiceNo" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsReceivable" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "invoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "agingDays" INTEGER,
    "status" "ArStatus" NOT NULL DEFAULT 'NOT_DUE',
    "billingRequestId" TEXT,
    "invoiceId" TEXT,
    "collectionStatus" TEXT DEFAULT 'NORMAL',
    "lastCollectionDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptRecord" (
    "id" TEXT NOT NULL,
    "arId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "receiptMethod" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "bankLast5" TEXT,
    "reconcileStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "proofPhotoUrl" TEXT,
    "proofDescription" TEXT,
    "orderId" TEXT,
    "shipmentId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsPayable" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "invoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "ApStatus" NOT NULL DEFAULT 'NOT_DUE',
    "apCategory" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "exchangeRate" DECIMAL(8,4),
    "amountForeign" DECIMAL(12,2),
    "batchNo" TEXT,
    "productId" TEXT,
    "seaFreightId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsPayable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisbursementRecord" (
    "id" TEXT NOT NULL,
    "apId" TEXT NOT NULL,
    "payee" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "exchangeRate" DECIMAL(8,4),
    "amount" DECIMAL(12,2) NOT NULL,
    "bankInfo" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisbursementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL DEFAULT 'TWD',
    "rate" DECIMAL(12,6) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "salesOrderId" TEXT,
    "billingRequestId" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2),
    "taxAmount" DECIMAL(12,2),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "buyerName" TEXT,
    "buyerTaxId" TEXT,
    "sellerName" TEXT,
    "sellerTaxId" TEXT,
    "pdfUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "voidReason" TEXT,
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "originalInvoiceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRequest" (
    "id" TEXT NOT NULL,
    "billingNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "shipmentId" TEXT,
    "billingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "amount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationStatement" (
    "id" TEXT NOT NULL,
    "statementNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(12,2) NOT NULL,
    "totalBilled" DECIMAL(12,2) NOT NULL,
    "totalReceived" DECIMAL(12,2) NOT NULL,
    "totalAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(12,2) NOT NULL,
    "lineItems" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "customerConfirmedAt" TIMESTAMP(3),
    "disputeNote" TEXT,
    "pdfUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditDebitNote" (
    "id" TEXT NOT NULL,
    "noteNo" TEXT NOT NULL,
    "noteType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "originalInvoiceNo" TEXT,
    "salesOrderId" TEXT,
    "purchaseOrderId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "attachmentUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditDebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceCategory" TEXT NOT NULL,
    "supplierInvoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "amount" DECIMAL(12,2) NOT NULL,
    "exchangeRate" DECIMAL(8,4),
    "amountTWD" DECIMAL(12,2) NOT NULL,
    "purchaseOrderId" TEXT,
    "seaFreightId" TEXT,
    "shipmentId" TEXT,
    "batchNo" TEXT,
    "productId" TEXT,
    "invoicePdfUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "apId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchCostAllocation" (
    "id" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" INTEGER NOT NULL,
    "factoryCost" DECIMAL(12,2),
    "packagingCost" DECIMAL(12,2),
    "oceanFreight" DECIMAL(12,2),
    "customsDuty" DECIMAL(12,2),
    "customsFee" DECIMAL(12,2),
    "truckingFee" DECIMAL(12,2),
    "insuranceFee" DECIMAL(12,2),
    "warehouseCost" DECIMAL(12,2),
    "otherCost" DECIMAL(12,2),
    "totalCost" DECIMAL(12,2),
    "unitCost" DECIMAL(10,4),
    "currency" TEXT,
    "exchangeRate" DECIMAL(8,4),
    "purchaseOrderId" TEXT,
    "seaFreightId" TEXT,
    "supplierInvoiceIds" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchCostAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAttachment" (
    "id" TEXT NOT NULL,
    "attachableType" TEXT NOT NULL,
    "attachableId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSizeBytes" INTEGER,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionLog" (
    "id" TEXT NOT NULL,
    "arId" TEXT NOT NULL,
    "customerId" TEXT,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "contactPerson" TEXT,
    "result" TEXT,
    "promisedDate" TIMESTAMP(3),
    "promisedAmount" DECIMAL(12,2),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityCheck" (
    "id" TEXT NOT NULL,
    "qcNo" TEXT NOT NULL,
    "inspectionType" "QcInspectionType" NOT NULL,
    "qcStatus" "QcStatus" NOT NULL DEFAULT 'PENDING',
    "result" "QcResult",
    "productionOrderId" TEXT,
    "purchaseOrderId" TEXT,
    "supplierId" TEXT,
    "productId" TEXT,
    "batchNo" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "inspectedById" TEXT,
    "sampleSize" INTEGER,
    "passedQty" INTEGER,
    "failedQty" INTEGER,
    "passRate" DECIMAL(5,2),
    "defectRate" DECIMAL(5,2),
    "resultSummary" TEXT,
    "lotSize" INTEGER,
    "aqlLevel" TEXT,
    "acceptQty" INTEGER,
    "rejectQty" INTEGER,
    "acceptanceStatus" TEXT,
    "rejectQtyTotal" INTEGER,
    "lossAmount" DECIMAL(12,2),
    "reworkCost" DECIMAL(12,2),
    "disposalMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcCheckItem" (
    "id" TEXT NOT NULL,
    "qcId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "standardValue" TEXT,
    "actualValue" TEXT,
    "isQualified" BOOLEAN,
    "defectType" TEXT,
    "defectQty" INTEGER,
    "judgment" TEXT,
    "notes" TEXT,

    CONSTRAINT "QcCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcDiaperChecklist" (
    "id" TEXT NOT NULL,
    "qcId" TEXT NOT NULL,
    "cartonDamageQty" INTEGER,
    "cartonDirty" BOOLEAN,
    "cartonDeformation" BOOLEAN,
    "cartonLabelCorrect" BOOLEAN,
    "cartonBarcodeScanable" BOOLEAN,
    "cartonSealingOk" BOOLEAN,
    "cartonMixedItems" BOOLEAN,
    "cartonCountCorrect" BOOLEAN,
    "cartonWeightActual" DECIMAL(8,3),
    "cartonWeightStandard" DECIMAL(8,3),
    "packWeightActual" DECIMAL(8,3),
    "packWeightStandard" DECIMAL(8,3),
    "pieceWeightActual" DECIMAL(8,3),
    "pieceWeightStandard" DECIMAL(8,3),
    "lengthMm" DECIMAL(6,1),
    "widthMm" DECIMAL(6,1),
    "thicknessFront" DECIMAL(5,2),
    "thicknessMiddle" DECIMAL(5,2),
    "thicknessBack" DECIMAL(5,2),
    "thicknessUniform" BOOLEAN,
    "maxAbsorptionMl" DECIMAL(8,1),
    "absorptionTimeSec" INTEGER,
    "rewetValue" DECIMAL(6,1),
    "leakageTest" BOOLEAN,
    "gelIntegrity" BOOLEAN,
    "absorptionUniform" BOOLEAN,
    "adhesionStrength" TEXT,
    "repeatableUse" BOOLEAN,
    "peelTestResult" TEXT,
    "detachmentIssue" BOOLEAN,
    "tensileForceN" DECIMAL(8,2),
    "stretchLimit" TEXT,
    "breakPoint" TEXT,
    "elasticity" TEXT,
    "surfaceWear" TEXT,
    "fabricIntegrity" BOOLEAN,
    "rubbingTestResult" TEXT,
    "odorLevel" TEXT,
    "chemicalSmell" BOOLEAN,
    "skinIrritationRisk" BOOLEAN,
    "fitTest" TEXT,
    "sideLeakRisk" BOOLEAN,
    "comfortLevel" TEXT,
    "easeOfUse" TEXT,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "productionLine" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QcDiaperChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcAttachment" (
    "id" TEXT NOT NULL,
    "qcId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QcAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcDefect" (
    "id" TEXT NOT NULL,
    "qcId" TEXT NOT NULL,
    "defectType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,

    CONSTRAINT "QcDefect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareSchedule" (
    "id" TEXT NOT NULL,
    "scheduleNo" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "scheduleDate" TIMESTAMP(3) NOT NULL,
    "visitType" "CareVisitType" NOT NULL DEFAULT 'ROUTINE_VISIT',
    "status" "CareScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "purpose" TEXT,
    "content" TEXT,
    "result" TEXT,
    "nextVisitDate" TIMESTAMP(3),
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "requestType" "ServiceRequestType" NOT NULL DEFAULT 'OTHER',
    "urgency" "ServiceUrgency" NOT NULL DEFAULT 'MEDIUM',
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "assignedToId" TEXT,
    "careScheduleId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitMedia" (
    "id" TEXT NOT NULL,
    "visitRecordId" TEXT,
    "careScheduleId" TEXT,
    "mediaType" "MediaType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareIncident" (
    "id" TEXT NOT NULL,
    "incidentNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "productId" TEXT,
    "batchNo" TEXT,
    "incidentType" "IncidentType" NOT NULL,
    "incidentSource" "IncidentSource" NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "reportedById" TEXT NOT NULL,
    "contactPerson" TEXT,
    "assignedOwnerId" TEXT,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "symptomCategory" "SymptomCategory",
    "issueSummary" TEXT NOT NULL,
    "detailedDescription" TEXT,
    "suspectedCause" TEXT,
    "immediateActionTaken" TEXT,
    "requiresOnSiteVisit" BOOLEAN NOT NULL DEFAULT false,
    "scheduledVisitDate" TIMESTAMP(3),
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "isKnowledgeBase" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentAttachment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "visitLogId" TEXT,
    "trainingLogId" TEXT,
    "attachmentType" "AttachmentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,
    "description" TEXT,
    "capturedAt" TIMESTAMP(3),
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "relatedStage" TEXT,
    "photoSource" TEXT,
    "consentObtained" BOOLEAN,
    "consentInternalUse" BOOLEAN,
    "consentTrainingCase" BOOLEAN,
    "needsMasking" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentVisitLog" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "visitType" TEXT NOT NULL,
    "participants" TEXT,
    "onSiteObservation" TEXT,
    "skinConditionNote" TEXT,
    "careProcessNote" TEXT,
    "productUsageNote" TEXT,
    "staffFeedback" TEXT,
    "immediateSuggestion" TEXT,
    "nextFollowupDate" TIMESTAMP(3),
    "visitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentVisitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentAudioRecord" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "audioFileUrl" TEXT NOT NULL,
    "audioDurationSec" INTEGER,
    "transcriptText" TEXT,
    "transcriptStatus" "TranscriptStatus" NOT NULL DEFAULT 'PENDING',
    "aiSummary" TEXT,
    "aiMeetingMinutes" TEXT,
    "aiConclusion" TEXT,
    "aiActionItems" JSONB,
    "processedAt" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentAudioRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentTrainingLog" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "trainingDate" TIMESTAMP(3) NOT NULL,
    "trainingTopic" TEXT NOT NULL,
    "trainerUserId" TEXT NOT NULL,
    "attendees" JSONB,
    "trainingContent" TEXT,
    "trainingResult" TEXT,
    "trainingPhotoUrls" JSONB,
    "followupRequired" BOOLEAN NOT NULL DEFAULT false,
    "nextFollowupDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentTrainingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentActionItem" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "actionTitle" TEXT NOT NULL,
    "actionDescription" TEXT,
    "ownerUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "completionNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "productionNo" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'PENDING',
    "orderQty" INTEGER NOT NULL,
    "producedQty" INTEGER,
    "passedQty" INTEGER,
    "defectQty" INTEGER,
    "defectRate" DECIMAL(5,2),
    "sampleSubmitDate" TIMESTAMP(3),
    "sampleApproveDate" TIMESTAMP(3),
    "productionStartDate" TIMESTAMP(3),
    "productionEndDate" TIMESTAMP(3),
    "inspectionDate" TIMESTAMP(3),
    "shipmentDate" TIMESTAMP(3),
    "packagingStatus" TEXT,
    "rawMaterialStatus" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeaFreight" (
    "id" TEXT NOT NULL,
    "freightNo" TEXT NOT NULL,
    "status" "FreightStatus" NOT NULL DEFAULT 'PENDING',
    "customsStatus" "CustomsStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "productionOrderId" TEXT,
    "purchaseOrderId" TEXT,
    "shippingMode" TEXT,
    "incoterm" TEXT,
    "forwarder" TEXT,
    "customsBroker" TEXT,
    "containerType" TEXT,
    "containerNo" TEXT,
    "sealNo" TEXT,
    "bookingNo" TEXT,
    "blNo" TEXT,
    "vesselName" TEXT,
    "voyageNo" TEXT,
    "shippingLine" TEXT,
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "transshipPort" TEXT,
    "trackingUrl" TEXT,
    "delayReason" TEXT,
    "etd" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "factoryExitDate" TIMESTAMP(3),
    "consolidationDate" TIMESTAMP(3),
    "loadingDate" TIMESTAMP(3),
    "customsDeclareDate" TIMESTAMP(3),
    "customsReleasedDate" TIMESTAMP(3),
    "customsCompletedDate" TIMESTAMP(3),
    "devanningDate" TIMESTAMP(3),
    "warehouseInDate" TIMESTAMP(3),
    "customsDeclarationNo" TEXT,
    "invoiceNo" TEXT,
    "packingListNo" TEXT,
    "certificateOfOrigin" TEXT,
    "insuranceInfo" TEXT,
    "blAttachment" TEXT,
    "customsDocAttachment" TEXT,
    "palletCount" INTEGER,
    "boxCount" INTEGER,
    "weight" DECIMAL(10,3),
    "volume" TEXT,
    "oceanFreight" DECIMAL(12,2),
    "customsFee" DECIMAL(12,2),
    "documentFee" DECIMAL(12,2),
    "portCharge" DECIMAL(12,2),
    "truckingFee" DECIMAL(12,2),
    "insuranceFee" DECIMAL(12,2),
    "storageFee" DECIMAL(12,2),
    "otherFee" DECIMAL(12,2),
    "totalCostTWD" DECIMAL(12,2),
    "berthingTime" TIMESTAMP(3),
    "dischargeTime" TIMESTAMP(3),
    "containerPickupDate" TIMESTAMP(3),
    "importerName" TEXT,
    "importerTaxId" TEXT,
    "hsCode" TEXT,
    "declaredValue" DECIMAL(12,2),
    "dutyAmount" DECIMAL(12,2),
    "vatAmount" DECIMAL(12,2),
    "inspectionType" TEXT,
    "inspectionResult" TEXT,
    "documentsStatus" TEXT,
    "demurrageFee" DECIMAL(12,2),
    "detentionFee" DECIMAL(12,2),
    "packingListAttachment" TEXT,
    "coaAttachment" TEXT,
    "originCertAttachment" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeaFreight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesChannel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "ChannelPlatform" NOT NULL,
    "shopUrl" TEXT,
    "commissionRate" DECIMAL(5,2),
    "integrationMethod" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelOrder" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelOrderNo" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "buyerName" TEXT,
    "buyerPhone" TEXT,
    "buyerAddress" TEXT,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "recipientAddress" TEXT,
    "orderAmount" DECIMAL(12,2) NOT NULL,
    "platformFee" DECIMAL(12,2),
    "shippingFee" DECIMAL(12,2),
    "netAmount" DECIMAL(12,2),
    "status" "ChannelOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT,
    "deliveryStatus" TEXT,
    "remittanceStatus" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelOrderItem" (
    "id" TEXT NOT NULL,
    "channelOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ChannelOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailOutlet" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,
    "outletCode" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "phone" TEXT,
    "contactPerson" TEXT,
    "commissionRate" DECIMAL(5,2),
    "paymentTerms" TEXT,
    "settlementDay" INTEGER,
    "shelfRent" DECIMAL(10,2),
    "displayFee" DECIMAL(10,2),
    "shelfLocation" TEXT,
    "displayType" TEXT,
    "facingCount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailOutlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailSalesPlan" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "planMonth" DATE NOT NULL,
    "targetQty" INTEGER NOT NULL,
    "actualQty" INTEGER NOT NULL DEFAULT 0,
    "targetAmount" DECIMAL(12,2),
    "actualAmount" DECIMAL(12,2),
    "promoType" TEXT,
    "promoDetail" TEXT,
    "promoStartDate" TIMESTAMP(3),
    "promoEndDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailSalesPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailDisplayRecord" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "visitedById" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "displayOk" BOOLEAN NOT NULL,
    "stockLevel" TEXT,
    "facingCount" INTEGER,
    "priceTagOk" BOOLEAN,
    "competitorNote" TEXT,
    "photos" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailDisplayRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailShipmentRecord" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "shipDate" TIMESTAMP(3) NOT NULL,
    "items" JSONB NOT NULL,
    "totalAmount" DECIMAL(12,2),
    "invoiceNo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailShipmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailEvent" (
    "id" TEXT NOT NULL,
    "outletId" TEXT,
    "channelId" TEXT,
    "customerId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "budget" DECIMAL(12,2),
    "actualCost" DECIMAL(12,2),
    "staffIds" TEXT[],
    "attendeeCount" INTEGER,
    "sampleQty" INTEGER,
    "ordersTaken" INTEGER,
    "leadsCollected" INTEGER,
    "resultNote" TEXT,
    "photos" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "currentNo" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" "TaskType" NOT NULL DEFAULT 'OTHER',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "customerId" TEXT,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesSchedule" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "scheduleDate" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "location" TEXT,
    "scheduleType" "ScheduleType" NOT NULL DEFAULT 'OTHER',
    "preReminder" TEXT,
    "postResult" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesEvent" (
    "id" TEXT NOT NULL,
    "eventType" "SalesEventType" NOT NULL DEFAULT 'OTHER',
    "eventDate" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "items" TEXT,
    "quantity" INTEGER,
    "amount" DECIMAL(12,2),
    "assignedToId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceInfo" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT,
    "changes" JSONB,
    "reason" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "metricValue" DECIMAL(12,2),
    "thresholdValue" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditionField" TEXT NOT NULL,
    "conditionOp" TEXT NOT NULL,
    "thresholdValue" DECIMAL(12,2) NOT NULL,
    "notifyRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notifyUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoCreateTask" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "channels" TEXT[] DEFAULT ARRAY['WEB']::TEXT[],
    "sentAt" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodingRule" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "separator" TEXT NOT NULL DEFAULT '-',
    "currentSeq" INTEGER NOT NULL DEFAULT 0,
    "example" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegionMapping" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "region" TEXT NOT NULL,
    "deliveryZone" TEXT,
    "defaultRouteId" TEXT,

    CONSTRAINT "RegionMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "totalSizeBytes" INTEGER,
    "deviceInfo" TEXT,
    "gpsLat" DECIMAL(10,7),
    "gpsLng" DECIMAL(10,7),
    "gpsAddress" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadFile" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileCategory" TEXT,
    "description" TEXT,
    "capturedAt" TIMESTAMP(3),
    "capturedLat" DECIMAL(10,7),
    "capturedLng" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportLog" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "filters" JSONB,
    "containsSensitive" BOOLEAN NOT NULL DEFAULT false,
    "exportedById" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportExportTemplate" (
    "id" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "columnMapping" JSONB NOT NULL,
    "fileFormat" TEXT NOT NULL DEFAULT 'XLSX',
    "templateUrl" TEXT,
    "validationRules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportExportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "module" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseEntry" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT,
    "entryType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tags" TEXT[],
    "relatedSkus" TEXT[],
    "relatedBatchNos" TEXT[],
    "customerTypes" TEXT[],
    "symptomCodes" TEXT[],
    "embedding" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseConfig" (
    "id" TEXT NOT NULL,
    "configType" TEXT NOT NULL,
    "configData" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIQueryLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "correctedAnswer" TEXT,
    "correctedById" TEXT,
    "correctedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "documentName" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionNote" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "previousVersionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkHandover" (
    "id" TEXT NOT NULL,
    "handoverNo" TEXT NOT NULL,
    "handoverType" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "checklist" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLARule" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "severity" TEXT,
    "responseTimeHrs" INTEGER NOT NULL,
    "resolutionTimeHrs" INTEGER NOT NULL,
    "onSiteTimeHrs" INTEGER,
    "escalateAfterHrs" INTEGER,
    "escalateToRole" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SLARule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldValidationRule" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "triggerField" TEXT NOT NULL,
    "triggerValue" TEXT NOT NULL,
    "requiredFields" TEXT[],
    "ruleName" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FieldValidationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttachmentPolicy" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "autoNaming" BOOLEAN NOT NULL DEFAULT true,
    "namePattern" TEXT,
    "allowedMimeTypes" TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png', 'application/pdf']::TEXT[],
    "maxFileSizeMb" INTEGER NOT NULL DEFAULT 10,
    "maxFilesPerEntity" INTEGER NOT NULL DEFAULT 50,
    "retentionDays" INTEGER,
    "canDownloadRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canDeleteRoles" TEXT[] DEFAULT ARRAY['SUPER_ADMIN']::TEXT[],
    "isSensitiveDefault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttachmentPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderSchedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "reminderDays" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT,
    "notifyUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notifyRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amount" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIDefinition" (
    "id" TEXT NOT NULL,
    "kpiCode" TEXT NOT NULL,
    "kpiName" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "calcLogic" TEXT,
    "attributionRule" TEXT,
    "unit" TEXT,
    "targetDefault" DECIMAL(12,2),
    "warningThreshold" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPIDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeNo_key" ON "User"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleName_module_key" ON "RolePermission"("roleName", "module");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBOM_productId_materialId_key" ON "ProductBOM"("productId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitConversion_productId_fromUnit_toUnit_key" ON "UnitConversion"("productId", "fromUnit", "toUnit");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCostStructure_productId_key" ON "ProductCostStructure"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerUsageProfile_customerId_key" ON "CustomerUsageProfile"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDemandForecast_customerId_key" ON "CustomerDemandForecast"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDeliveryProfile_customerId_key" ON "CustomerDeliveryProfile"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRequirement_customerId_key" ON "CustomerRequirement"("customerId");

-- CreateIndex
CREATE INDEX "CustomerChangeLog_customerId_changeType_changedAt_idx" ON "CustomerChangeLog"("customerId", "changeType", "changedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDuplicateCheck_customerAId_customerBId_key" ON "CustomerDuplicateCheck"("customerAId", "customerBId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTag_name_key" ON "CustomerTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTagMap_customerId_tagId_key" ON "CustomerTagMap"("customerId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTarget_userId_targetMonth_key" ON "SalesTarget"("userId", "targetMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quotationNo_key" ON "Quotation"("quotationNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNo_key" ON "SalesOrder"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringOrder_salesOrderId_key" ON "RecurringOrder"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_warehouse_category_key" ON "Inventory"("productId", "warehouse", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_warehouseId_zone_rack_position_key" ON "WarehouseLocation"("warehouseId", "zone", "rack", "position");

-- CreateIndex
CREATE UNIQUE INDEX "InboundRecord_inboundNo_key" ON "InboundRecord"("inboundNo");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundRecord_outboundNo_key" ON "OutboundRecord"("outboundNo");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_lotNo_key" ON "InventoryLot"("lotNo");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_transferNo_key" ON "StockTransfer"("transferNo");

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_countNo_key" ON "StockCount"("countNo");

-- CreateIndex
CREATE UNIQUE INDEX "StockScrap_scrapNo_key" ON "StockScrap"("scrapNo");

-- CreateIndex
CREATE UNIQUE INDEX "WarehousePickingStrategy_warehouseId_key" ON "WarehousePickingStrategy"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecall_recallNo_key" ON "ProductRecall"("recallNo");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsProvider_code_key" ON "LogisticsProvider"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTrip_tripNo_key" ON "DeliveryTrip"("tripNo");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNo_key" ON "Vehicle"("plateNo");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnOrder_returnNo_key" ON "ReturnOrder"("returnNo");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNo_key" ON "Shipment"("shipmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNo_key" ON "PurchaseOrder"("poNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_receiptNo_key" ON "PurchaseReceipt"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "PackagingMaterial_code_key" ON "PackagingMaterial"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialSupplier_materialId_supplierId_key" ON "MaterialSupplier"("materialId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryMaterialTerm_factoryId_materialId_key" ON "FactoryMaterialTerm"("factoryId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialShipment_shipmentNo_key" ON "MaterialShipment"("shipmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_paymentNo_key" ON "PaymentRecord"("paymentNo");

-- CreateIndex
CREATE INDEX "ExchangeRate_fromCurrency_toCurrency_effectiveDate_idx" ON "ExchangeRate"("fromCurrency", "toCurrency", "effectiveDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_fromCurrency_toCurrency_effectiveDate_key" ON "ExchangeRate"("fromCurrency", "toCurrency", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRequest_billingNo_key" ON "BillingRequest"("billingNo");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationStatement_statementNo_key" ON "ReconciliationStatement"("statementNo");

-- CreateIndex
CREATE UNIQUE INDEX "CreditDebitNote_noteNo_key" ON "CreditDebitNote"("noteNo");

-- CreateIndex
CREATE UNIQUE INDEX "BatchCostAllocation_batchNo_productId_key" ON "BatchCostAllocation"("batchNo", "productId");

-- CreateIndex
CREATE INDEX "FinanceAttachment_attachableType_attachableId_idx" ON "FinanceAttachment"("attachableType", "attachableId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityCheck_qcNo_key" ON "QualityCheck"("qcNo");

-- CreateIndex
CREATE UNIQUE INDEX "QcDiaperChecklist_qcId_key" ON "QcDiaperChecklist"("qcId");

-- CreateIndex
CREATE UNIQUE INDEX "CareSchedule_scheduleNo_key" ON "CareSchedule"("scheduleNo");

-- CreateIndex
CREATE UNIQUE INDEX "CareIncident_incidentNo_key" ON "CareIncident"("incidentNo");

-- CreateIndex
CREATE INDEX "CareIncident_customerId_idx" ON "CareIncident"("customerId");

-- CreateIndex
CREATE INDEX "CareIncident_status_idx" ON "CareIncident"("status");

-- CreateIndex
CREATE INDEX "CareIncident_incidentDate_idx" ON "CareIncident"("incidentDate");

-- CreateIndex
CREATE INDEX "IncidentAttachment_incidentId_idx" ON "IncidentAttachment"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentVisitLog_incidentId_idx" ON "IncidentVisitLog"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentAudioRecord_incidentId_idx" ON "IncidentAudioRecord"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentTrainingLog_incidentId_idx" ON "IncidentTrainingLog"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentActionItem_incidentId_idx" ON "IncidentActionItem"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentActionItem_status_idx" ON "IncidentActionItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_productionNo_key" ON "ProductionOrder"("productionNo");

-- CreateIndex
CREATE UNIQUE INDEX "SeaFreight_freightNo_key" ON "SeaFreight"("freightNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannel_code_key" ON "SalesChannel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RetailOutlet_outletCode_key" ON "RetailOutlet"("outletCode");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_type_key" ON "Sequence"("type");

-- CreateIndex
CREATE INDEX "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_module_action_timestamp_idx" ON "AuditLog"("module", "action", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SystemAlert_alertType_status_idx" ON "SystemAlert"("alertType", "status");

-- CreateIndex
CREATE INDEX "SystemAlert_relatedType_relatedId_idx" ON "SystemAlert"("relatedType", "relatedId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_alertType_key" ON "AlertRule"("alertType");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_category_createdAt_idx" ON "Notification"("category", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CodingRule_entityType_key" ON "CodingRule"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "RegionMapping_city_district_key" ON "RegionMapping"("city", "district");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBaseConfig_configType_key" ON "KnowledgeBaseConfig"("configType");

-- CreateIndex
CREATE INDEX "AIQueryLog_userId_createdAt_idx" ON "AIQueryLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentVersion_documentType_relatedType_relatedId_idx" ON "DocumentVersion"("documentType", "relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentType_status_idx" ON "DocumentVersion"("documentType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkHandover_handoverNo_key" ON "WorkHandover"("handoverNo");

-- CreateIndex
CREATE UNIQUE INDEX "SLARule_module_severity_key" ON "SLARule"("module", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "FieldValidationRule_module_triggerField_triggerValue_key" ON "FieldValidationRule"("module", "triggerField", "triggerValue");

-- CreateIndex
CREATE UNIQUE INDEX "AttachmentPolicy_module_key" ON "AttachmentPolicy"("module");

-- CreateIndex
CREATE UNIQUE INDEX "KPIDefinition_kpiCode_key" ON "KPIDefinition"("kpiCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBOM" ADD CONSTRAINT "ProductBOM_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBOM" ADD CONSTRAINT "ProductBOM_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "PackagingMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCostStructure" ADD CONSTRAINT "ProductCostStructure_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerUsageProfile" ADD CONSTRAINT "CustomerUsageProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDemandForecast" ADD CONSTRAINT "CustomerDemandForecast_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDeliveryProfile" ADD CONSTRAINT "CustomerDeliveryProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRequirement" ADD CONSTRAINT "CustomerRequirement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerChangeLog" ADD CONSTRAINT "CustomerChangeLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerChangeLog" ADD CONSTRAINT "CustomerChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDuplicateCheck" ADD CONSTRAINT "CustomerDuplicateCheck_customerAId_fkey" FOREIGN KEY ("customerAId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDuplicateCheck" ADD CONSTRAINT "CustomerDuplicateCheck_customerBId_fkey" FOREIGN KEY ("customerBId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_visitedById_fkey" FOREIGN KEY ("visitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRecord" ADD CONSTRAINT "SampleRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRecord" ADD CONSTRAINT "SampleRecord_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintRecord" ADD CONSTRAINT "ComplaintRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintRecord" ADD CONSTRAINT "ComplaintRecord_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintRecord" ADD CONSTRAINT "ComplaintRecord_assignedSupervisorId_fkey" FOREIGN KEY ("assignedSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintLog" ADD CONSTRAINT "ComplaintLog_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "ComplaintRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintLog" ADD CONSTRAINT "ComplaintLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpLog" ADD CONSTRAINT "FollowUpLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpLog" ADD CONSTRAINT "FollowUpLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpLog" ADD CONSTRAINT "FollowUpLog_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "SalesOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOpportunity" ADD CONSTRAINT "SalesOpportunity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOpportunity" ADD CONSTRAINT "SalesOpportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTagMap" ADD CONSTRAINT "CustomerTagMap_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTagMap" ADD CONSTRAINT "CustomerTagMap_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CustomerTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRepChange" ADD CONSTRAINT "SalesRepChange_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRepChange" ADD CONSTRAINT "SalesRepChange_previousRepId_fkey" FOREIGN KEY ("previousRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRepChange" ADD CONSTRAINT "SalesRepChange_newRepId_fkey" FOREIGN KEY ("newRepId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationApproval" ADD CONSTRAINT "QuotationApproval_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOrder" ADD CONSTRAINT "RecurringOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOrder" ADD CONSTRAINT "RecurringOrder_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOrderItem" ADD CONSTRAINT "RecurringOrderItem_recurringOrderId_fkey" FOREIGN KEY ("recurringOrderId") REFERENCES "RecurringOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOrderItem" ADD CONSTRAINT "RecurringOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundRecord" ADD CONSTRAINT "InboundRecord_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundRecord" ADD CONSTRAINT "InboundRecord_seaFreightId_fkey" FOREIGN KEY ("seaFreightId") REFERENCES "SeaFreight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundRecord" ADD CONSTRAINT "InboundRecord_returnOrderId_fkey" FOREIGN KEY ("returnOrderId") REFERENCES "ReturnOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundItem" ADD CONSTRAINT "InboundItem_inboundId_fkey" FOREIGN KEY ("inboundId") REFERENCES "InboundRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundItem" ADD CONSTRAINT "InboundItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundRecord" ADD CONSTRAINT "OutboundRecord_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundRecord" ADD CONSTRAINT "OutboundRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundItem" ADD CONSTRAINT "OutboundItem_outboundId_fkey" FOREIGN KEY ("outboundId") REFERENCES "OutboundRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundItem" ADD CONSTRAINT "OutboundItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockScrap" ADD CONSTRAINT "StockScrap_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockScrap" ADD CONSTRAINT "StockScrap_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockScrap" ADD CONSTRAINT "StockScrap_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockScrap" ADD CONSTRAINT "StockScrap_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockScrap" ADD CONSTRAINT "StockScrap_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehousePickingStrategy" ADD CONSTRAINT "WarehousePickingStrategy_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountSchedule" ADD CONSTRAINT "StockCountSchedule_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecall" ADD CONSTRAINT "ProductRecall_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallNotification" ADD CONSTRAINT "RecallNotification_recallId_fkey" FOREIGN KEY ("recallId") REFERENCES "ProductRecall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallNotification" ADD CONSTRAINT "RecallNotification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallNotification" ADD CONSTRAINT "RecallNotification_notifiedById_fkey" FOREIGN KEY ("notifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTrip" ADD CONSTRAINT "DeliveryTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTrip" ADD CONSTRAINT "DeliveryTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTrip" ADD CONSTRAINT "DeliveryTrip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DeliveryRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrderItem" ADD CONSTRAINT "ReturnOrderItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrderItem" ADD CONSTRAINT "ReturnOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_logisticsProviderId_fkey" FOREIGN KEY ("logisticsProviderId") REFERENCES "LogisticsProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "DeliveryTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPriceHistory" ADD CONSTRAINT "SupplierPriceHistory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPriceHistory" ADD CONSTRAINT "SupplierPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "PackagingMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingMaterial" ADD CONSTRAINT "PackagingMaterial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSupplier" ADD CONSTRAINT "MaterialSupplier_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "PackagingMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSupplier" ADD CONSTRAINT "MaterialSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryMaterialTerm" ADD CONSTRAINT "FactoryMaterialTerm_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryMaterialTerm" ADD CONSTRAINT "FactoryMaterialTerm_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "PackagingMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialShipment" ADD CONSTRAINT "MaterialShipment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialShipment" ADD CONSTRAINT "MaterialShipment_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialShipment" ADD CONSTRAINT "MaterialShipment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialShipmentItem" ADD CONSTRAINT "MaterialShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "MaterialShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialShipmentItem" ADD CONSTRAINT "MaterialShipmentItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "PackagingMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryIncident" ADD CONSTRAINT "FactoryIncident_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryIncident" ADD CONSTRAINT "FactoryIncident_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsReceivable" ADD CONSTRAINT "AccountsReceivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsReceivable" ADD CONSTRAINT "AccountsReceivable_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptRecord" ADD CONSTRAINT "ReceiptRecord_arId_fkey" FOREIGN KEY ("arId") REFERENCES "AccountsReceivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisbursementRecord" ADD CONSTRAINT "DisbursementRecord_apId_fkey" FOREIGN KEY ("apId") REFERENCES "AccountsPayable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationStatement" ADD CONSTRAINT "ReconciliationStatement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDebitNote" ADD CONSTRAINT "CreditDebitNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_seaFreightId_fkey" FOREIGN KEY ("seaFreightId") REFERENCES "SeaFreight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_apId_fkey" FOREIGN KEY ("apId") REFERENCES "AccountsPayable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchCostAllocation" ADD CONSTRAINT "BatchCostAllocation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchCostAllocation" ADD CONSTRAINT "BatchCostAllocation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionLog" ADD CONSTRAINT "CollectionLog_arId_fkey" FOREIGN KEY ("arId") REFERENCES "AccountsReceivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionLog" ADD CONSTRAINT "CollectionLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionLog" ADD CONSTRAINT "CollectionLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcCheckItem" ADD CONSTRAINT "QcCheckItem_qcId_fkey" FOREIGN KEY ("qcId") REFERENCES "QualityCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcDiaperChecklist" ADD CONSTRAINT "QcDiaperChecklist_qcId_fkey" FOREIGN KEY ("qcId") REFERENCES "QualityCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcAttachment" ADD CONSTRAINT "QcAttachment_qcId_fkey" FOREIGN KEY ("qcId") REFERENCES "QualityCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcDefect" ADD CONSTRAINT "QcDefect_qcId_fkey" FOREIGN KEY ("qcId") REFERENCES "QualityCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareSchedule" ADD CONSTRAINT "CareSchedule_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareSchedule" ADD CONSTRAINT "CareSchedule_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_careScheduleId_fkey" FOREIGN KEY ("careScheduleId") REFERENCES "CareSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitMedia" ADD CONSTRAINT "VisitMedia_visitRecordId_fkey" FOREIGN KEY ("visitRecordId") REFERENCES "VisitRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitMedia" ADD CONSTRAINT "VisitMedia_careScheduleId_fkey" FOREIGN KEY ("careScheduleId") REFERENCES "CareSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitMedia" ADD CONSTRAINT "VisitMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareIncident" ADD CONSTRAINT "CareIncident_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareIncident" ADD CONSTRAINT "CareIncident_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareIncident" ADD CONSTRAINT "CareIncident_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareIncident" ADD CONSTRAINT "CareIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareIncident" ADD CONSTRAINT "CareIncident_assignedOwnerId_fkey" FOREIGN KEY ("assignedOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CareIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_visitLogId_fkey" FOREIGN KEY ("visitLogId") REFERENCES "IncidentVisitLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_trainingLogId_fkey" FOREIGN KEY ("trainingLogId") REFERENCES "IncidentTrainingLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentVisitLog" ADD CONSTRAINT "IncidentVisitLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CareIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentVisitLog" ADD CONSTRAINT "IncidentVisitLog_visitedById_fkey" FOREIGN KEY ("visitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAudioRecord" ADD CONSTRAINT "IncidentAudioRecord_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CareIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAudioRecord" ADD CONSTRAINT "IncidentAudioRecord_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentTrainingLog" ADD CONSTRAINT "IncidentTrainingLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CareIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentTrainingLog" ADD CONSTRAINT "IncidentTrainingLog_trainerUserId_fkey" FOREIGN KEY ("trainerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentActionItem" ADD CONSTRAINT "IncidentActionItem_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CareIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentActionItem" ADD CONSTRAINT "IncidentActionItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeaFreight" ADD CONSTRAINT "SeaFreight_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeaFreight" ADD CONSTRAINT "SeaFreight_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelOrder" ADD CONSTRAINT "ChannelOrder_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SalesChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelOrder" ADD CONSTRAINT "ChannelOrder_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelOrderItem" ADD CONSTRAINT "ChannelOrderItem_channelOrderId_fkey" FOREIGN KEY ("channelOrderId") REFERENCES "ChannelOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelOrderItem" ADD CONSTRAINT "ChannelOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailOutlet" ADD CONSTRAINT "RetailOutlet_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SalesChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailSalesPlan" ADD CONSTRAINT "RetailSalesPlan_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "RetailOutlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailSalesPlan" ADD CONSTRAINT "RetailSalesPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailDisplayRecord" ADD CONSTRAINT "RetailDisplayRecord_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "RetailOutlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailShipmentRecord" ADD CONSTRAINT "RetailShipmentRecord_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "RetailOutlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailEvent" ADD CONSTRAINT "RetailEvent_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "RetailOutlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailEvent" ADD CONSTRAINT "RetailEvent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SalesChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailEvent" ADD CONSTRAINT "RetailEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesSchedule" ADD CONSTRAINT "SalesSchedule_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesSchedule" ADD CONSTRAINT "SalesSchedule_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesSchedule" ADD CONSTRAINT "SalesSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesEvent" ADD CONSTRAINT "SalesEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesEvent" ADD CONSTRAINT "SalesEvent_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesEvent" ADD CONSTRAINT "SalesEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemAlert" ADD CONSTRAINT "SystemAlert_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadFile" ADD CONSTRAINT "UploadFile_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "UploadBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportLog" ADD CONSTRAINT "ExportLog_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseEntry" ADD CONSTRAINT "KnowledgeBaseEntry_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CareIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkHandover" ADD CONSTRAINT "WorkHandover_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkHandover" ADD CONSTRAINT "WorkHandover_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
