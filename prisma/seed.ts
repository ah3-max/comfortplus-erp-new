import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 開始 Seed...')

  // ========== 單號序列 ==========
  const sequences = [
    { type: 'QUOTATION',   prefix: 'Q'    },
    { type: 'SALES_ORDER', prefix: 'SO'   },
    { type: 'SHIPMENT',    prefix: 'SH'   },
    { type: 'PURCHASE',    prefix: 'PO'   },
    { type: 'TRIP',        prefix: 'TRIP' },
    { type: 'CARE',        prefix: 'CARE' },
    { type: 'PRODUCTION',  prefix: 'PRD'  },
    { type: 'FREIGHT',     prefix: 'FRT'  },
    { type: 'CHANNEL',     prefix: 'CH'   },
    { type: 'PAYMENT',     prefix: 'PAY'  },
    { type: 'PICKUP',      prefix: 'PK'   },
  ]
  for (const seq of sequences) {
    await prisma.sequence.upsert({
      where: { type: seq.type },
      update: {},
      create: { type: seq.type, prefix: seq.prefix, currentNo: 0 },
    })
  }
  console.log('✅ 單號序列建立完成')

  // ========== 使用者 ==========
  const adminPassword = await bcrypt.hash('admin1234', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@comfortplus.com' },
    update: {},
    create: {
      email: 'admin@comfortplus.com',
      name: '系統管理員',
      password: adminPassword,
      role: 'SUPER_ADMIN',
    },
  })

  const salesPassword = await bcrypt.hash('sales1234', 12)
  const sales = await prisma.user.upsert({
    where: { email: 'sales@comfortplus.com' },
    update: {},
    create: {
      email: 'sales@comfortplus.com',
      name: '業務專員',
      password: salesPassword,
      role: 'SALES',
    },
  })
  console.log('✅ 使用者建立完成')

  // ========== 商品 ==========
  const products = [
    {
      sku: 'ADL-001',
      name: '成人紙尿布 M號',
      category: '紙尿布',
      specification: 'M / 60-90cm',
      unit: '包',
      boxQuantity: 6,
      costPrice: 280,
      sellingPrice: 380,
    },
    {
      sku: 'ADL-002',
      name: '成人紙尿布 L號',
      category: '紙尿布',
      specification: 'L / 80-120cm',
      unit: '包',
      boxQuantity: 6,
      costPrice: 290,
      sellingPrice: 390,
    },
    {
      sku: 'ADL-003',
      name: '成人紙尿布 XL號',
      category: '紙尿布',
      specification: 'XL / 110-160cm',
      unit: '包',
      boxQuantity: 4,
      costPrice: 310,
      sellingPrice: 420,
    },
    {
      sku: 'PAD-001',
      name: '防漏護墊 日用型',
      category: '護墊',
      specification: '30x60cm / 30片入',
      unit: '包',
      boxQuantity: 12,
      costPrice: 120,
      sellingPrice: 180,
    },
    {
      sku: 'PAD-002',
      name: '防漏護墊 夜用型',
      category: '護墊',
      specification: '40x70cm / 20片入',
      unit: '包',
      boxQuantity: 12,
      costPrice: 150,
      sellingPrice: 220,
    },
    {
      sku: 'WET-001',
      name: '成人濕紙巾',
      category: '清潔用品',
      specification: '80片入 / 加厚型',
      unit: '包',
      boxQuantity: 24,
      costPrice: 45,
      sellingPrice: 75,
    },
    {
      sku: 'GLV-001',
      name: '拋棄式手套 M',
      category: '護理用品',
      specification: 'M / 100入 / 無粉',
      unit: '盒',
      boxQuantity: 10,
      costPrice: 85,
      sellingPrice: 130,
    },
    {
      sku: 'MSK-001',
      name: '醫療口罩',
      category: '防護用品',
      specification: '50入 / 三層',
      unit: '盒',
      boxQuantity: 20,
      costPrice: 90,
      sellingPrice: 150,
    },
  ]

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        ...p,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
      },
    })

    await prisma.inventory.upsert({
      where: { productId_warehouse_category: { productId: product.id, warehouse: 'MAIN', category: 'FINISHED_GOODS' } },
      update: {},
      create: {
        productId: product.id,
        warehouse: 'MAIN',
        category: 'FINISHED_GOODS',
        quantity: Math.floor(Math.random() * 200) + 50,
        safetyStock: 30,
      },
    })
  }
  console.log('✅ 商品與庫存建立完成')

  // ========== 客戶 ==========
  const customers = [
    {
      code: 'C001',
      name: '台北市松山護理之家',
      type: 'NURSING_HOME' as const,
      contactPerson: '王主任',
      phone: '02-2345-6789',
      email: 'wangzr@songshancare.com.tw',
      address: '台北市松山區民生東路三段100號',
      paymentTerms: 'NET30',
      creditLimit: 500000,
    },
    {
      code: 'C002',
      name: '新北市板橋長青安養中心',
      type: 'ELDERLY_HOME' as const,
      contactPerson: '李主任',
      phone: '02-2968-1234',
      email: 'li@banqiao-elder.com.tw',
      address: '新北市板橋區文化路二段50號',
      paymentTerms: 'NET30',
      creditLimit: 300000,
    },
    {
      code: 'C003',
      name: '台中博愛醫院',
      type: 'HOSPITAL' as const,
      contactPerson: '陳採購',
      phone: '04-2233-4567',
      email: 'purchase@boai-hospital.com.tw',
      address: '台中市西區博愛街100號',
      paymentTerms: 'NET60',
      creditLimit: 1000000,
    },
    {
      code: 'C004',
      name: '全台醫材經銷有限公司',
      type: 'DISTRIBUTOR' as const,
      contactPerson: '張業務',
      phone: '02-8765-4321',
      email: 'zhang@allmed.com.tw',
      address: '台北市中山區南京東路二段200號',
      paymentTerms: 'NET45',
      creditLimit: 800000,
    },
    {
      code: 'C005',
      name: '高雄市鳳山幸福老人之家',
      type: 'ELDERLY_HOME' as const,
      contactPerson: '林所長',
      phone: '07-7654-3210',
      email: 'lin@fongshan-happy.org.tw',
      address: '高雄市鳳山區光復路一段300號',
      paymentTerms: 'NET30',
      creditLimit: 200000,
    },
  ]

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { code: c.code },
      update: {},
      create: {
        ...c,
        creditLimit: c.creditLimit,
      },
    })
  }
  console.log('✅ 客戶建立完成')

  // ========== 系統設定 ==========
  const configs = [
    { key: 'company_name', value: '舒適加股份有限公司', description: '公司名稱' },
    { key: 'company_phone', value: '02-1234-5678', description: '公司電話' },
    { key: 'company_address', value: '台北市信義區信義路五段100號', description: '公司地址' },
    { key: 'company_tax_id', value: '12345678', description: '統一編號' },
    { key: 'default_payment_terms', value: 'NET30', description: '預設付款條件' },
    { key: 'quotation_valid_days', value: '30', description: '報價單有效天數' },
  ]

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    })
  }
  console.log('✅ 系統設定建立完成')

  // ========== 編碼規則 CodingRule ==========
  try {
    await prisma.codingRule.createMany({
      data: [
        { entityType: 'SKU', prefix: 'CP', pattern: '{品類2碼}{系列2碼}{尺寸1碼}{流水4碼}', separator: '-', example: 'CP-AD-M-0001' },
        { entityType: 'CUSTOMER', prefix: 'CUST', pattern: '{區域2碼}{流水4碼}', separator: '-', example: 'CUST-TP-0001' },
        { entityType: 'SUPPLIER', prefix: 'SUP', pattern: '{國家2碼}{流水4碼}', separator: '-', example: 'SUP-VN-0001' },
        { entityType: 'BATCH', prefix: 'B', pattern: '{工廠2碼}{YYMMDD}{流水3碼}', separator: '-', example: 'B-VN-260315-001' },
        { entityType: 'WAREHOUSE', prefix: 'WH', pattern: '{流水3碼}', separator: '-', example: 'WH-001' },
      ],
      skipDuplicates: true,
    })
    console.log('✅ 編碼規則 CodingRule 建立完成')
  } catch (e) {
    console.error('❌ CodingRule seed 失敗:', e)
  }

  // ========== SLA 規則 SLARule ==========
  try {
    await prisma.sLARule.createMany({
      data: [
        { module: 'COMPLAINT', severity: 'CRITICAL', responseTimeHrs: 1, resolutionTimeHrs: 24, onSiteTimeHrs: 4, escalateAfterHrs: 2, escalateToRole: 'GM' },
        { module: 'COMPLAINT', severity: 'HIGH', responseTimeHrs: 4, resolutionTimeHrs: 48, onSiteTimeHrs: 24, escalateAfterHrs: 8, escalateToRole: 'SALES_MANAGER' },
        { module: 'COMPLAINT', severity: 'MEDIUM', responseTimeHrs: 8, resolutionTimeHrs: 72, escalateAfterHrs: 24, escalateToRole: 'SALES_MANAGER' },
        { module: 'COMPLAINT', severity: 'LOW', responseTimeHrs: 24, resolutionTimeHrs: 168 },
        { module: 'QC_INSPECTION', severity: null, responseTimeHrs: 4, resolutionTimeHrs: 48, onSiteTimeHrs: 24 },
        { module: 'DELIVERY', severity: null, responseTimeHrs: 4, resolutionTimeHrs: 48 },
        { module: 'ORDER_CONFIRM', severity: null, responseTimeHrs: 4, resolutionTimeHrs: 24 },
      ],
      skipDuplicates: true,
    })
    console.log('✅ SLA 規則 SLARule 建立完成')
  } catch (e) {
    console.error('❌ SLARule seed 失敗:', e)
  }

  // ========== 警示規則 AlertRule ==========
  try {
    await prisma.alertRule.createMany({
      data: [
        { alertType: 'CHURN_RISK', conditionField: 'daysSinceLastOrder', conditionOp: 'GT', thresholdValue: 30, notifyRoles: ['SALES_MANAGER', 'SALES'], autoCreateTask: true },
        { alertType: 'STOCK_LOW', conditionField: 'quantity', conditionOp: 'LT', thresholdValue: 0, notifyRoles: ['WAREHOUSE_MANAGER'], autoCreateTask: false },
        { alertType: 'STOCK_EXPIRING', conditionField: 'daysToExpiry', conditionOp: 'LT', thresholdValue: 90, notifyRoles: ['WAREHOUSE_MANAGER'] },
        { alertType: 'AR_OVERDUE', conditionField: 'agingDays', conditionOp: 'GT', thresholdValue: 30, notifyRoles: ['FINANCE', 'SALES_MANAGER'] },
        { alertType: 'QC_DEFECT_HIGH', conditionField: 'defectRate', conditionOp: 'GT', thresholdValue: 5, notifyRoles: ['PROCUREMENT', 'WAREHOUSE_MANAGER'] },
        { alertType: 'COMPLAINT_SPIKE', conditionField: 'monthCount', conditionOp: 'GT', thresholdValue: 3, notifyRoles: ['SALES_MANAGER', 'GM'] },
        { alertType: 'PRICE_LOW_MARGIN', conditionField: 'marginRate', conditionOp: 'LT', thresholdValue: 10, notifyRoles: ['SALES_MANAGER', 'GM'] },
        { alertType: 'DELIVERY_ANOMALY', conditionField: 'anomalyCount', conditionOp: 'GT', thresholdValue: 0, notifyRoles: ['WAREHOUSE_MANAGER'] },
        { alertType: 'PURCHASE_DELAY', conditionField: 'delayDays', conditionOp: 'GT', thresholdValue: 7, notifyRoles: ['PROCUREMENT'] },
        { alertType: 'PRODUCTION_DELAY', conditionField: 'delayDays', conditionOp: 'GT', thresholdValue: 7, notifyRoles: ['PROCUREMENT', 'GM'] },
      ],
      skipDuplicates: true,
    })
    console.log('✅ 警示規則 AlertRule 建立完成')
  } catch (e) {
    console.error('❌ AlertRule seed 失敗:', e)
  }

  // ========== 附件政策 AttachmentPolicy ==========
  try {
    await prisma.attachmentPolicy.createMany({
      data: [
        { module: 'incidents', autoNaming: true, namePattern: '{incidentNo}_{type}_{date}_{seq}', maxFileSizeMb: 10, maxFilesPerEntity: 50, retentionDays: 2555, canDeleteRoles: ['SUPER_ADMIN'], isSensitiveDefault: false },
        { module: 'qc', autoNaming: true, namePattern: '{qcNo}_{category}_{date}_{seq}', maxFileSizeMb: 15, maxFilesPerEntity: 100, retentionDays: 1825, canDeleteRoles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
        { module: 'finance', autoNaming: true, namePattern: '{docNo}_{type}_{date}', maxFileSizeMb: 5, maxFilesPerEntity: 30, retentionDays: 3650, canDeleteRoles: ['SUPER_ADMIN'] },
        { module: 'shipments', autoNaming: true, namePattern: '{shipmentNo}_{type}_{date}', maxFileSizeMb: 10, maxFilesPerEntity: 20, retentionDays: 1825, canDeleteRoles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
      ],
      skipDuplicates: true,
    })
    console.log('✅ 附件政策 AttachmentPolicy 建立完成')
  } catch (e) {
    console.error('❌ AttachmentPolicy seed 失敗:', e)
  }

  // ========== KPI 定義 KPIDefinition ==========
  try {
    await prisma.kPIDefinition.createMany({
      data: [
        { kpiCode: 'CLOSE_RATE', kpiName: '成交率', module: 'sales', formula: '成交客戶數 ÷ 報價客戶數 × 100%', attributionRule: '以報價建立人為準', unit: '%' },
        { kpiCode: 'REPURCHASE_RATE', kpiName: '回購率', module: 'sales', formula: '月有訂單且歷史有訂單客戶 ÷ 月有訂單客戶 × 100%', attributionRule: '以訂單建立人為準', unit: '%' },
        { kpiCode: 'COMPLAINT_RATE', kpiName: '客訴率', module: 'complaint', formula: '月客訴件數 ÷ 月出貨單數 × 100%', attributionRule: '以負責業務為準', unit: '%', warningThreshold: 3 },
        { kpiCode: 'DEFECT_RATE', kpiName: 'QC不良率', module: 'quality', formula: 'failedQty ÷ sampleSize × 100%', attributionRule: '以工廠為準', unit: '%', warningThreshold: 5 },
        { kpiCode: 'STOCKOUT_RATE', kpiName: '缺貨率', module: 'inventory', formula: '缺貨SKU數 ÷ 總在售SKU數 × 100%', unit: '%', warningThreshold: 10 },
        { kpiCode: 'GROSS_MARGIN', kpiName: '毛利率', module: 'finance', formula: '(營收-銷貨成本) ÷ 營收 × 100%', attributionRule: '含所有歸入成本', unit: '%' },
        { kpiCode: 'AR_TURNOVER_DAYS', kpiName: '應收帳款週轉天數', module: 'finance', formula: '應收帳款餘額 ÷ 日均營收', unit: '天', warningThreshold: 60 },
        { kpiCode: 'REVENUE', kpiName: '業績', module: 'sales', formula: '訂單totalAmount（扣退貨金額）', attributionRule: '建立人為準，退貨扣原業務', unit: 'TWD' },
        { kpiCode: 'VISIT_COUNT', kpiName: '拜訪數', module: 'sales', formula: 'COUNT(FollowUpLog where logType in VISIT types)', attributionRule: '以建立人為準', unit: '次' },
        { kpiCode: 'AVG_RESOLUTION_HRS', kpiName: '平均客訴解決時間', module: 'complaint', formula: 'AVG(resolvedAt - createdAt) in hours', unit: '小時', warningThreshold: 72 },
      ],
      skipDuplicates: true,
    })
    console.log('✅ KPI 定義 KPIDefinition 建立完成')
  } catch (e) {
    console.error('❌ KPIDefinition seed 失敗:', e)
  }

  // ========== 區域對應 RegionMapping ==========
  try {
    await prisma.regionMapping.createMany({
      data: [
        { city: '台北市', region: '北區', deliveryZone: 'A' },
        { city: '新北市', region: '北區', deliveryZone: 'A' },
        { city: '桃園市', region: '北區', deliveryZone: 'A' },
        { city: '基隆市', region: '北區', deliveryZone: 'B' },
        { city: '宜蘭縣', region: '北區', deliveryZone: 'B' },
        { city: '新竹市', region: '中區', deliveryZone: 'B' },
        { city: '新竹縣', region: '中區', deliveryZone: 'B' },
        { city: '苗栗縣', region: '中區', deliveryZone: 'B' },
        { city: '台中市', region: '中區', deliveryZone: 'A' },
        { city: '彰化縣', region: '中區', deliveryZone: 'B' },
        { city: '南投縣', region: '中區', deliveryZone: 'C' },
        { city: '雲林縣', region: '南區', deliveryZone: 'B' },
        { city: '嘉義市', region: '南區', deliveryZone: 'B' },
        { city: '嘉義縣', region: '南區', deliveryZone: 'B' },
        { city: '台南市', region: '南區', deliveryZone: 'A' },
        { city: '高雄市', region: '南區', deliveryZone: 'A' },
        { city: '屏東縣', region: '南區', deliveryZone: 'B' },
        { city: '花蓮縣', region: '東區', deliveryZone: 'C' },
        { city: '台東縣', region: '東區', deliveryZone: 'C' },
        { city: '澎湖縣', region: '離島', deliveryZone: 'C' },
        { city: '金門縣', region: '離島', deliveryZone: 'C' },
        { city: '連江縣', region: '離島', deliveryZone: 'C' },
      ],
      skipDuplicates: true,
    })
    console.log('✅ 區域對應 RegionMapping 建立完成')
  } catch (e) {
    console.error('❌ RegionMapping seed 失敗:', e)
  }

  console.log('\n🎉 Seed 完成！')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('管理員帳號：admin@comfortplus.com')
  console.log('管理員密碼：admin1234')
  console.log('業務帳號：  sales@comfortplus.com')
  console.log('業務密碼：  sales1234')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // ========== 額外角色帳號（測試用）==========
  const extraUsers = [
    { email: 'manager@comfortplus.com', name: '業務主管', role: 'SALES_MANAGER', password: 'manager1234' },
    { email: 'warehouse@comfortplus.com', name: '倉管人員', role: 'WAREHOUSE', password: 'warehouse1234' },
    { email: 'finance@comfortplus.com', name: '財務人員', role: 'FINANCE', password: 'finance1234' },
    { email: 'gm@comfortplus.com', name: '總經理', role: 'GM', password: 'gm12345678' },
    { email: 'procurement@comfortplus.com', name: '採購人員', role: 'PROCUREMENT', password: 'procurement1234' },
  ]
  for (const u of extraUsers) {
    const pwd = await bcrypt.hash(u.password, 12)
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, password: pwd, role: u.role as never },
    })
  }
  console.log('✅ 額外角色帳號建立完成')

  console.log('')
  console.log('所有測試帳號：')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('admin@comfortplus.com       / admin1234       (超級管理員)')
  console.log('gm@comfortplus.com          / gm12345678      (總經理)')
  console.log('manager@comfortplus.com     / manager1234     (業務主管)')
  console.log('sales@comfortplus.com       / sales1234       (業務專員)')
  console.log('warehouse@comfortplus.com   / warehouse1234   (倉管人員)')
  console.log('finance@comfortplus.com     / finance1234     (財務人員)')
  console.log('procurement@comfortplus.com / procurement1234 (採購人員)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
