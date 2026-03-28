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
    { type: 'SALES_INVOICE', prefix: 'SI' },
    { type: 'MATERIAL_REQUISITION', prefix: 'MR' },
    { type: 'PRODUCTION_RECEIPT', prefix: 'PR' },
    { type: 'E_INVOICE', prefix: 'EI' },
    { type: 'PURCHASE_REQUEST', prefix: 'PRQ' },
    { type: 'RFQ', prefix: 'RFQ' },
    { type: 'PICKING_ORDER', prefix: 'PK' },
    { type: 'DISPATCH_ORDER', prefix: 'DP' },
    { type: 'WMS_INBOUND', prefix: 'WI' },
    { type: 'WMS_OUTBOUND', prefix: 'WO' },
    { type: 'STOCK_COUNT', prefix: 'SC' },
    { type: 'JOURNAL_ENTRY', prefix: 'JE' },
    { type: 'INTERNAL_USE', prefix: 'IU' },
    { type: 'DEFECTIVE_GOODS', prefix: 'DG' },
    { type: 'APPROVAL_REQUEST', prefix: 'AP' },
    { type: 'IMPORT_PROJECT',   prefix: 'IMP' },
    { type: 'CONTRACT',         prefix: 'CT' },
    { type: 'AFTER_SALES',      prefix: 'AS' },
    { type: 'FIXED_ASSET',      prefix: 'FA' },
    { type: 'EXPENSE_REPORT',   prefix: 'EXP' },
    { type: 'PURCHASE_PLAN',    prefix: 'PP' },
    { type: 'SALES_RETURN',     prefix: 'SR' },
    { type: 'PURCHASE_RETURN',  prefix: 'PRR' },
    { type: 'VAT_FILING',       prefix: 'VAT' },
    { type: 'STATEMENT',        prefix: 'STM' },
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
  // ECOUNT 實際品項：愛舒樂/越南大發/大發/中潤/天嬌/凱達/勤達 等品牌
  const products = [
    // ── 愛舒樂（ASL）──
    { sku: 'ASL-D-M', name: '愛舒樂成人紙尿褲 M', category: '紙尿布', specification: 'M / 60-90cm / 10片入', unit: '包', boxQuantity: 6, costPrice: 285, sellingPrice: 395 },
    { sku: 'ASL-D-L', name: '愛舒樂成人紙尿褲 L', category: '紙尿布', specification: 'L / 80-120cm / 10片入', unit: '包', boxQuantity: 6, costPrice: 295, sellingPrice: 405 },
    { sku: 'ASL-D-XL', name: '愛舒樂成人紙尿褲 XL', category: '紙尿布', specification: 'XL / 110-160cm / 8片入', unit: '包', boxQuantity: 4, costPrice: 315, sellingPrice: 425 },
    { sku: 'ASL-P-M', name: '愛舒樂復健褲 M', category: '紙尿布', specification: 'M / 拉拉褲型', unit: '包', boxQuantity: 6, costPrice: 310, sellingPrice: 420 },
    { sku: 'ASL-P-L', name: '愛舒樂復健褲 L', category: '紙尿布', specification: 'L / 拉拉褲型', unit: '包', boxQuantity: 6, costPrice: 320, sellingPrice: 430 },
    // ── 越南大發（VDF）──
    { sku: 'VDF-D-M', name: '越南大發紙尿褲 M', category: '紙尿布', specification: 'M / 60-90cm / 10片入', unit: '包', boxQuantity: 8, costPrice: 180, sellingPrice: 270 },
    { sku: 'VDF-D-L', name: '越南大發紙尿褲 L', category: '紙尿布', specification: 'L / 80-120cm / 10片入', unit: '包', boxQuantity: 8, costPrice: 190, sellingPrice: 280 },
    { sku: 'VDF-D-XL', name: '越南大發紙尿褲 XL', category: '紙尿布', specification: 'XL / 110-160cm / 8片入', unit: '包', boxQuantity: 6, costPrice: 200, sellingPrice: 295 },
    { sku: 'VDF-D-XXL', name: '越南大發紙尿褲 XXL', category: '紙尿布', specification: 'XXL / 150cm以上 / 8片入', unit: '包', boxQuantity: 6, costPrice: 215, sellingPrice: 310 },
    // ── 大發（DF）──
    { sku: 'DF-D-M', name: '大發成人紙尿褲 M', category: '紙尿布', specification: 'M / 60-90cm / 10片入', unit: '包', boxQuantity: 6, costPrice: 240, sellingPrice: 340 },
    { sku: 'DF-D-L', name: '大發成人紙尿褲 L', category: '紙尿布', specification: 'L / 80-120cm / 10片入', unit: '包', boxQuantity: 6, costPrice: 250, sellingPrice: 350 },
    { sku: 'DF-D-XL', name: '大發成人紙尿褲 XL', category: '紙尿布', specification: 'XL / 110-160cm / 8片入', unit: '包', boxQuantity: 4, costPrice: 265, sellingPrice: 365 },
    { sku: 'DF-P-L', name: '大發復健褲 L', category: '紙尿布', specification: 'L / 拉拉褲型', unit: '包', boxQuantity: 6, costPrice: 275, sellingPrice: 380 },
    // ── 中潤（ZR）──
    { sku: 'ZR-D-M', name: '中潤成人紙尿褲 M', category: '紙尿布', specification: 'M / 60-90cm', unit: '包', boxQuantity: 6, costPrice: 220, sellingPrice: 315 },
    { sku: 'ZR-D-L', name: '中潤成人紙尿褲 L', category: '紙尿布', specification: 'L / 80-120cm', unit: '包', boxQuantity: 6, costPrice: 230, sellingPrice: 325 },
    { sku: 'ZR-D-XL', name: '中潤成人紙尿褲 XL', category: '紙尿布', specification: 'XL / 110-160cm', unit: '包', boxQuantity: 4, costPrice: 245, sellingPrice: 340 },
    // ── 天嬌（TJ）──
    { sku: 'TJ-D-M', name: '天嬌成人紙尿褲 M', category: '紙尿布', specification: 'M / 60-90cm / 10片', unit: '包', boxQuantity: 6, costPrice: 255, sellingPrice: 355 },
    { sku: 'TJ-D-L', name: '天嬌成人紙尿褲 L', category: '紙尿布', specification: 'L / 80-120cm / 10片', unit: '包', boxQuantity: 6, costPrice: 265, sellingPrice: 365 },
    { sku: 'TJ-D-XL', name: '天嬌成人紙尿褲 XL', category: '紙尿布', specification: 'XL / 110-160cm / 8片', unit: '包', boxQuantity: 4, costPrice: 280, sellingPrice: 380 },
    // ── 凱達（KD）──
    { sku: 'KD-D-M', name: '凱達成人尿布 M', category: '紙尿布', specification: 'M / 60-90cm', unit: '包', boxQuantity: 6, costPrice: 195, sellingPrice: 285 },
    { sku: 'KD-D-L', name: '凱達成人尿布 L', category: '紙尿布', specification: 'L / 80-120cm', unit: '包', boxQuantity: 6, costPrice: 205, sellingPrice: 295 },
    { sku: 'KD-D-XL', name: '凱達成人尿布 XL', category: '紙尿布', specification: 'XL / 110-160cm', unit: '包', boxQuantity: 4, costPrice: 215, sellingPrice: 310 },
    // ── 勤達（QD）──
    { sku: 'QD-D-M', name: '勤達成人紙尿褲 M', category: '紙尿布', specification: 'M / 60-90cm', unit: '包', boxQuantity: 6, costPrice: 210, sellingPrice: 300 },
    { sku: 'QD-D-L', name: '勤達成人紙尿褲 L', category: '紙尿布', specification: 'L / 80-120cm', unit: '包', boxQuantity: 6, costPrice: 220, sellingPrice: 310 },
    { sku: 'QD-D-XL', name: '勤達成人紙尿褲 XL', category: '紙尿布', specification: 'XL / 110-160cm', unit: '包', boxQuantity: 4, costPrice: 235, sellingPrice: 325 },
    // ── 護墊／防漏墊 ──
    { sku: 'PAD-ASL-S', name: '愛舒樂護墊 S(30x60cm)', category: '護墊', specification: '30x60cm / 30片入', unit: '包', boxQuantity: 12, costPrice: 110, sellingPrice: 170 },
    { sku: 'PAD-ASL-M', name: '愛舒樂護墊 M(40x60cm)', category: '護墊', specification: '40x60cm / 30片入', unit: '包', boxQuantity: 12, costPrice: 130, sellingPrice: 195 },
    { sku: 'PAD-ASL-L', name: '愛舒樂護墊 L(60x90cm)', category: '護墊', specification: '60x90cm / 20片入', unit: '包', boxQuantity: 10, costPrice: 155, sellingPrice: 230 },
    { sku: 'PAD-VDF-S', name: '大發護墊 S', category: '護墊', specification: '30x60cm / 30片入', unit: '包', boxQuantity: 12, costPrice: 85, sellingPrice: 135 },
    { sku: 'PAD-VDF-L', name: '大發護墊 L', category: '護墊', specification: '60x90cm / 20片入', unit: '包', boxQuantity: 10, costPrice: 115, sellingPrice: 175 },
    // ── 清潔護理 ──
    { sku: 'WET-ASL-80', name: '愛舒樂成人濕紙巾 80片', category: '清潔用品', specification: '80片 / 加厚型', unit: '包', boxQuantity: 24, costPrice: 48, sellingPrice: 78 },
    { sku: 'WET-DF-80', name: '大發成人濕紙巾 80片', category: '清潔用品', specification: '80片', unit: '包', boxQuantity: 24, costPrice: 38, sellingPrice: 65 },
    { sku: 'CREAM-001', name: '護膚乳液 500ml', category: '護理用品', specification: '500ml / 無香精', unit: '瓶', boxQuantity: 12, costPrice: 95, sellingPrice: 155 },
    { sku: 'FOAM-001', name: '乾洗慕斯 400ml', category: '護理用品', specification: '400ml / 免沖洗', unit: '瓶', boxQuantity: 12, costPrice: 120, sellingPrice: 190 },
    // ── 防護用品 ──
    { sku: 'GLV-M', name: '拋棄式手套 M(100入)', category: '防護用品', specification: 'M / 100入 / 無粉', unit: '盒', boxQuantity: 10, costPrice: 85, sellingPrice: 130 },
    { sku: 'GLV-L', name: '拋棄式手套 L(100入)', category: '防護用品', specification: 'L / 100入 / 無粉', unit: '盒', boxQuantity: 10, costPrice: 88, sellingPrice: 135 },
    { sku: 'MSK-MED', name: '醫療口罩(50入)', category: '防護用品', specification: '50入 / 三層 / 雙鋼印', unit: '盒', boxQuantity: 20, costPrice: 90, sellingPrice: 145 },
    { sku: 'GOWN-001', name: '拋棄式隔離衣(10入)', category: '防護用品', specification: 'PP不織布 / XL', unit: '包', boxQuantity: 20, costPrice: 180, sellingPrice: 280 },
    // ── 輔助器材 ──
    { sku: 'BED-PAD-L', name: '看護墊(防水) L(60x90)', category: '看護用品', specification: '60x90cm / 10片入 / 防水', unit: '包', boxQuantity: 8, costPrice: 145, sellingPrice: 225 },
    { sku: 'BED-PAD-XL', name: '看護墊(防水) XL(90x180)', category: '看護用品', specification: '90x180cm / 5片入 / 防水', unit: '包', boxQuantity: 6, costPrice: 175, sellingPrice: 270 },
    { sku: 'TUBE-001', name: '醫療用鼻胃管 FR14', category: '醫療耗材', specification: 'FR14 / 100cm', unit: '條', boxQuantity: 50, costPrice: 45, sellingPrice: 75 },
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
  // 001機構類 / 002通路類 / 003電商類 / 004居服類
  const customers = [
    // ── 001 機構類 ──
    { code: 'C001', name: '台北市松山護理之家', type: 'NURSING_HOME' as const, contactPerson: '王主任', phone: '02-2345-6789', email: 'wang@songshancare.com.tw', address: '台北市松山區民生東路三段100號', paymentTerms: 'NET30', creditLimit: 500000 },
    { code: 'C002', name: '新北市板橋長青安養中心', type: 'ELDERLY_HOME' as const, contactPerson: '李主任', phone: '02-2968-1234', email: 'li@banqiao-elder.com.tw', address: '新北市板橋區文化路二段50號', paymentTerms: 'NET30', creditLimit: 300000 },
    { code: 'C003', name: '台中博愛醫院', type: 'HOSPITAL' as const, contactPerson: '陳採購', phone: '04-2233-4567', email: 'purchase@boai-hospital.com.tw', address: '台中市西區博愛街100號', paymentTerms: 'NET60', creditLimit: 1000000 },
    { code: 'C006', name: '桃園市中壢德昌護理之家', type: 'NURSING_HOME' as const, contactPerson: '吳護理長', phone: '03-4521-678', email: 'wu@dechang-care.com.tw', address: '桃園市中壢區中山路200號', paymentTerms: 'NET30', creditLimit: 400000 },
    { code: 'C007', name: '台南市仁德康寧護理之家', type: 'NURSING_HOME' as const, contactPerson: '蔡所長', phone: '06-2701-234', email: 'cai@kangning-nursing.com.tw', address: '台南市仁德區文華路150號', paymentTerms: 'NET30', creditLimit: 350000 },
    { code: 'C008', name: '高雄市鳳山幸福老人之家', type: 'ELDERLY_HOME' as const, contactPerson: '林所長', phone: '07-7654-321', email: 'lin@fongshan-happy.org.tw', address: '高雄市鳳山區光復路一段300號', paymentTerms: 'NET30', creditLimit: 200000 },
    { code: 'C009', name: '新竹縣芎林仁心養護中心', type: 'ELDERLY_HOME' as const, contactPerson: '黃主任', phone: '03-5923-456', email: 'huang@renxin-care.com.tw', address: '新竹縣芎林鄉文山路50號', paymentTerms: 'NET45', creditLimit: 180000 },
    { code: 'C010', name: '台北市萬華愛心照護機構', type: 'DAY_CARE' as const, contactPerson: '鄭主任', phone: '02-2308-9012', email: 'zheng@wanhua-care.org.tw', address: '台北市萬華區西藏路200號', paymentTerms: 'NET30', creditLimit: 250000 },
    { code: 'C011', name: '彰化縣員林博愛護理之家', type: 'NURSING_HOME' as const, contactPerson: '許護理長', phone: '04-8323-456', email: 'xu@yuanlin-boai.com.tw', address: '彰化縣員林市員林大道二段100號', paymentTerms: 'NET30', creditLimit: 280000 },
    { code: 'C012', name: '屏東縣東港同安長照中心', type: 'ELDERLY_HOME' as const, contactPerson: '方主任', phone: '08-8323-789', email: 'fang@dongang-tongan.org.tw', address: '屏東縣東港鎮中山路150號', paymentTerms: 'NET45', creditLimit: 160000 },
    // ── 002 通路類 ──
    { code: 'C004', name: '全台醫材經銷有限公司', type: 'DISTRIBUTOR' as const, contactPerson: '張業務', phone: '02-8765-4321', email: 'zhang@allmed.com.tw', address: '台北市中山區南京東路二段200號', paymentTerms: 'NET45', creditLimit: 800000 },
    { code: 'C013', name: '南北醫材股份有限公司', type: 'DISTRIBUTOR' as const, contactPerson: '周業務', phone: '02-2345-9876', email: 'zhou@nanbei-medical.com.tw', address: '台北市大同區重慶北路二段50號', paymentTerms: 'NET45', creditLimit: 600000 },
    { code: 'C014', name: '中部藥材行', type: 'DISTRIBUTOR' as const, contactPerson: '廖老闆', phone: '04-2235-6789', email: 'liao@center-pharma.com.tw', address: '台中市北屯區文心路四段300號', paymentTerms: 'NET30', creditLimit: 400000 },
    { code: 'C015', name: '南台灣醫療用品行', type: 'DISTRIBUTOR' as const, contactPerson: '謝主任', phone: '07-2234-5678', email: 'xie@south-medical.com.tw', address: '高雄市三民區九如二路200號', paymentTerms: 'NET30', creditLimit: 500000 },
    // ── 003 電商類 ──
    { code: 'C016', name: '康健樂活電商平台', type: 'B2C_OTHER' as const, contactPerson: '顏經理', phone: '02-2718-3456', email: 'yan@health-ec.com.tw', address: '台北市信義區松高路100號', paymentTerms: 'NET15', creditLimit: 1200000 },
    { code: 'C017', name: '好照護網路商店', type: 'B2C_SHOPEE' as const, contactPerson: '趙店長', phone: '02-8712-3456', email: 'zhao@goodcare-shop.com.tw', address: '台北市內湖區瑞光路300號', paymentTerms: 'NET15', creditLimit: 800000 },
    { code: 'C018', name: '樂齡生活館電商', type: 'B2C_MOMO' as const, contactPerson: '潘負責人', phone: '02-2717-8901', email: 'pan@leeling-shop.com.tw', address: '新北市汐止區新台五路一段100號', paymentTerms: 'NET30', creditLimit: 500000 },
    // ── 004 居服類 ──
    { code: 'C019', name: '新北市居家服務協會', type: 'HOME_CARE' as const, contactPerson: '宋會長', phone: '02-2956-7890', email: 'song@newtp-homecare.org.tw', address: '新北市板橋區中山路一段200號', paymentTerms: 'NET45', creditLimit: 300000 },
    { code: 'C020', name: '桃竹苗居服中心', type: 'HOME_CARE' as const, contactPerson: '曾督導', phone: '03-3625-678', email: 'zeng@tzy-homecare.org.tw', address: '桃園市桃園區中正路100號', paymentTerms: 'NET45', creditLimit: 250000 },
    { code: 'C021', name: '中彰投長照服務站', type: 'HOME_CARE' as const, contactPerson: '賴站長', phone: '04-2226-5678', email: 'lai@central-ltc.org.tw', address: '台中市西區民生路200號', paymentTerms: 'NET45', creditLimit: 280000 },
    { code: 'C022', name: '雲嘉南居家照護機構', type: 'HOME_CARE' as const, contactPerson: '林主任', phone: '06-2357-8901', email: 'lin@yjs-homecare.org.tw', address: '台南市永康區復興路100號', paymentTerms: 'NET45', creditLimit: 200000 },
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

  // ========== 供應商 ==========
  const supplierList = [
    { code: 'SUP-VN-001', name: '越南大發工業股份有限公司', country: 'VN', contactPerson: 'Nguyen Van A', phone: '+84-28-1234-5678', email: 'export@vndafa.com.vn', address: 'Ho Chi Minh City, Vietnam', paymentTerms: 'T/T 30 days' },
    { code: 'SUP-VN-002', name: '越南天嬌衛生用品廠', country: 'VN', contactPerson: 'Tran Thi B', phone: '+84-28-2345-6789', email: 'sales@tienjiao-vn.com', address: 'Binh Duong, Vietnam', paymentTerms: 'L/C' },
    { code: 'SUP-VN-003', name: '越南勤達護理用品有限公司', country: 'VN', contactPerson: 'Le Van C', phone: '+84-24-3456-7890', email: 'export@qinda-vn.com', address: 'Hanoi, Vietnam', paymentTerms: 'T/T 45 days' },
    { code: 'SUP-TW-001', name: '中潤企業股份有限公司', country: 'TW', contactPerson: '陳業務', phone: '02-2345-1234', email: 'sales@zhongrun.com.tw', address: '新北市三重區重新路二段150號', paymentTerms: 'NET30' },
    { code: 'SUP-TW-002', name: '凱達生技醫材股份有限公司', country: 'TW', contactPerson: '林業務', phone: '02-8765-2345', email: 'sales@kaida-biotech.com.tw', address: '台北市南港區園區街3號', paymentTerms: 'NET30' },
    { code: 'SUP-TW-003', name: '愛舒樂健康科技股份有限公司', country: 'TW', contactPerson: '張業務', phone: '03-5678-3456', email: 'sales@ishule.com.tw', address: '新竹市東區光復路二段100號', paymentTerms: 'NET45' },
    { code: 'SUP-TW-004', name: '台灣包材供應股份有限公司', country: 'TW', contactPerson: '吳業務', phone: '04-2278-4567', email: 'sales@tw-packaging.com.tw', address: '台中市工業區一路50號', paymentTerms: 'NET30' },
    { code: 'SUP-CN-001', name: '大連大發衛生用品廠', country: 'CN', contactPerson: 'Wang Ming', phone: '+86-411-1234-5678', email: 'export@dldafa.com', address: 'Dalian, Liaoning, China', paymentTerms: 'T/T 30 days' },
  ]

  for (const s of supplierList) {
    await prisma.supplier.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    })
  }
  console.log('✅ 供應商建立完成')

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
  // ========== 會計科目（台灣 GAAP 標準） ==========
  const chartOfAccounts = [
    // ── 1xxx 資產 ──
    { code: '1000', name: '資產', type: 'ASSET', subType: null, normalBalance: 'DEBIT', parentCode: null, level: 1 },
    { code: '1100', name: '流動資產', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1000', level: 2 },
    { code: '1101', name: '現金及約當現金', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1102', name: '銀行存款', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1103', name: '零用金', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1110', name: '短期投資', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1120', name: '應收票據', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1130', name: '應收帳款', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1131', name: '備抵呆帳—應收帳款', type: 'ASSET', subType: '流動資產', normalBalance: 'CREDIT', parentCode: '1130', level: 4 },
    { code: '1140', name: '其他應收款', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1150', name: '存貨', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1151', name: '商品存貨', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1150', level: 4 },
    { code: '1152', name: '原物料存貨', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1150', level: 4 },
    { code: '1153', name: '在製品', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1150', level: 4 },
    { code: '1154', name: '製成品', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1150', level: 4 },
    { code: '1155', name: '包材存貨', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1150', level: 4 },
    { code: '1160', name: '預付款項', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1170', name: '預付費用', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1180', name: '進項稅額', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    { code: '1190', name: '其他流動資產', type: 'ASSET', subType: '流動資產', normalBalance: 'DEBIT', parentCode: '1100', level: 3 },
    // 非流動資產
    { code: '1500', name: '非流動資產', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1000', level: 2 },
    { code: '1510', name: '不動產、廠房及設備', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1500', level: 3 },
    { code: '1511', name: '土地', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1510', level: 4 },
    { code: '1512', name: '房屋及建築', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1510', level: 4 },
    { code: '1513', name: '機器設備', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1510', level: 4 },
    { code: '1514', name: '運輸設備', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1510', level: 4 },
    { code: '1515', name: '辦公設備', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1510', level: 4 },
    { code: '1516', name: '租賃改良', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1510', level: 4 },
    { code: '1519', name: '累計折舊', type: 'ASSET', subType: '非流動資產', normalBalance: 'CREDIT', parentCode: '1510', level: 4 },
    { code: '1520', name: '無形資產', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1500', level: 3 },
    { code: '1530', name: '長期投資', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1500', level: 3 },
    { code: '1540', name: '存出保證金', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1500', level: 3 },
    { code: '1590', name: '其他非流動資產', type: 'ASSET', subType: '非流動資產', normalBalance: 'DEBIT', parentCode: '1500', level: 3 },

    // ── 2xxx 負債 ──
    { code: '2000', name: '負債', type: 'LIABILITY', subType: null, normalBalance: 'CREDIT', parentCode: null, level: 1 },
    { code: '2100', name: '流動負債', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2000', level: 2 },
    { code: '2110', name: '短期借款', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2100', level: 3 },
    { code: '2120', name: '應付票據', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2100', level: 3 },
    { code: '2130', name: '應付帳款', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2100', level: 3 },
    { code: '2140', name: '應付費用', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2100', level: 3 },
    { code: '2141', name: '應付薪資', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2140', level: 4 },
    { code: '2142', name: '應付租金', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2140', level: 4 },
    { code: '2143', name: '應付利息', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2140', level: 4 },
    { code: '2150', name: '預收款項', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2100', level: 3 },
    { code: '2160', name: '銷項稅額', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2100', level: 3 },
    { code: '2170', name: '其他應付款', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2100', level: 3 },
    { code: '2171', name: '應付勞健保', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2170', level: 4 },
    { code: '2172', name: '應付退休金', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2170', level: 4 },
    { code: '2180', name: '一年內到期長期負債', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2100', level: 3 },
    { code: '2190', name: '其他流動負債', type: 'LIABILITY', subType: '流動負債', normalBalance: 'CREDIT', parentCode: '2100', level: 3 },
    // 非流動負債
    { code: '2500', name: '非流動負債', type: 'LIABILITY', subType: '非流動負債', normalBalance: 'CREDIT', parentCode: '2000', level: 2 },
    { code: '2510', name: '長期借款', type: 'LIABILITY', subType: '非流動負債', normalBalance: 'CREDIT', parentCode: '2500', level: 3 },
    { code: '2520', name: '存入保證金', type: 'LIABILITY', subType: '非流動負債', normalBalance: 'CREDIT', parentCode: '2500', level: 3 },
    { code: '2590', name: '其他非流動負債', type: 'LIABILITY', subType: '非流動負債', normalBalance: 'CREDIT', parentCode: '2500', level: 3 },

    // ── 3xxx 權益 ──
    { code: '3000', name: '權益', type: 'EQUITY', subType: null, normalBalance: 'CREDIT', parentCode: null, level: 1 },
    { code: '3100', name: '股本', type: 'EQUITY', subType: '股本', normalBalance: 'CREDIT', parentCode: '3000', level: 2 },
    { code: '3110', name: '普通股股本', type: 'EQUITY', subType: '股本', normalBalance: 'CREDIT', parentCode: '3100', level: 3 },
    { code: '3200', name: '資本公積', type: 'EQUITY', subType: '資本公積', normalBalance: 'CREDIT', parentCode: '3000', level: 2 },
    { code: '3300', name: '保留盈餘', type: 'EQUITY', subType: '保留盈餘', normalBalance: 'CREDIT', parentCode: '3000', level: 2 },
    { code: '3310', name: '法定盈餘公積', type: 'EQUITY', subType: '保留盈餘', normalBalance: 'CREDIT', parentCode: '3300', level: 3 },
    { code: '3320', name: '未分配盈餘', type: 'EQUITY', subType: '保留盈餘', normalBalance: 'CREDIT', parentCode: '3300', level: 3 },
    { code: '3400', name: '業主往來', type: 'EQUITY', subType: '業主往來', normalBalance: 'CREDIT', parentCode: '3000', level: 2 },

    // ── 4xxx 收入 ──
    { code: '4000', name: '營業收入', type: 'REVENUE', subType: null, normalBalance: 'CREDIT', parentCode: null, level: 1 },
    { code: '4100', name: '銷貨收入', type: 'REVENUE', subType: '銷貨收入', normalBalance: 'CREDIT', parentCode: '4000', level: 2 },
    { code: '4110', name: 'B2B 銷貨收入', type: 'REVENUE', subType: '銷貨收入', normalBalance: 'CREDIT', parentCode: '4100', level: 3 },
    { code: '4120', name: 'B2C 銷貨收入', type: 'REVENUE', subType: '銷貨收入', normalBalance: 'CREDIT', parentCode: '4100', level: 3 },
    { code: '4130', name: '電商通路收入', type: 'REVENUE', subType: '銷貨收入', normalBalance: 'CREDIT', parentCode: '4100', level: 3 },
    { code: '4140', name: '蝦皮收入', type: 'REVENUE', subType: '銷貨收入', normalBalance: 'CREDIT', parentCode: '4100', level: 3 },
    { code: '4150', name: 'momo 收入', type: 'REVENUE', subType: '銷貨收入', normalBalance: 'CREDIT', parentCode: '4100', level: 3 },
    { code: '4190', name: '其他營業收入', type: 'REVENUE', subType: '銷貨收入', normalBalance: 'CREDIT', parentCode: '4000', level: 2 },
    { code: '4200', name: '銷貨退回', type: 'REVENUE', subType: '銷貨退回', normalBalance: 'DEBIT', parentCode: '4000', level: 2 },
    { code: '4300', name: '銷貨折讓', type: 'REVENUE', subType: '銷貨折讓', normalBalance: 'DEBIT', parentCode: '4000', level: 2 },

    // ── 5xxx 銷貨成本 ──
    { code: '5000', name: '營業成本', type: 'EXPENSE', subType: '營業成本', normalBalance: 'DEBIT', parentCode: null, level: 1 },
    { code: '5100', name: '銷貨成本', type: 'EXPENSE', subType: '營業成本', normalBalance: 'DEBIT', parentCode: '5000', level: 2 },
    { code: '5110', name: '進貨成本', type: 'EXPENSE', subType: '營業成本', normalBalance: 'DEBIT', parentCode: '5100', level: 3 },
    { code: '5120', name: '進貨運費', type: 'EXPENSE', subType: '營業成本', normalBalance: 'DEBIT', parentCode: '5100', level: 3 },
    { code: '5130', name: '進貨退出', type: 'EXPENSE', subType: '營業成本', normalBalance: 'CREDIT', parentCode: '5100', level: 3 },
    { code: '5140', name: '進貨折讓', type: 'EXPENSE', subType: '營業成本', normalBalance: 'CREDIT', parentCode: '5100', level: 3 },
    { code: '5150', name: '存貨盤虧/報廢損失', type: 'EXPENSE', subType: '營業成本', normalBalance: 'DEBIT', parentCode: '5100', level: 3 },
    { code: '5200', name: '製造費用', type: 'EXPENSE', subType: '營業成本', normalBalance: 'DEBIT', parentCode: '5000', level: 2 },
    { code: '5210', name: 'OEM 加工費', type: 'EXPENSE', subType: '營業成本', normalBalance: 'DEBIT', parentCode: '5200', level: 3 },
    { code: '5220', name: '包裝費', type: 'EXPENSE', subType: '營業成本', normalBalance: 'DEBIT', parentCode: '5200', level: 3 },

    // ── 6xxx 營業費用 ──
    { code: '6000', name: '營業費用', type: 'EXPENSE', subType: '營業費用', normalBalance: 'DEBIT', parentCode: null, level: 1 },
    { code: '6100', name: '推銷費用', type: 'EXPENSE', subType: '推銷費用', normalBalance: 'DEBIT', parentCode: '6000', level: 2 },
    { code: '6110', name: '薪資費用—業務', type: 'EXPENSE', subType: '推銷費用', normalBalance: 'DEBIT', parentCode: '6100', level: 3 },
    { code: '6120', name: '佣金支出', type: 'EXPENSE', subType: '推銷費用', normalBalance: 'DEBIT', parentCode: '6100', level: 3 },
    { code: '6130', name: '廣告費', type: 'EXPENSE', subType: '推銷費用', normalBalance: 'DEBIT', parentCode: '6100', level: 3 },
    { code: '6140', name: '運費—銷貨', type: 'EXPENSE', subType: '推銷費用', normalBalance: 'DEBIT', parentCode: '6100', level: 3 },
    { code: '6150', name: '樣品費', type: 'EXPENSE', subType: '推銷費用', normalBalance: 'DEBIT', parentCode: '6100', level: 3 },
    { code: '6160', name: '通路手續費', type: 'EXPENSE', subType: '推銷費用', normalBalance: 'DEBIT', parentCode: '6100', level: 3 },
    { code: '6170', name: '展覽費', type: 'EXPENSE', subType: '推銷費用', normalBalance: 'DEBIT', parentCode: '6100', level: 3 },
    { code: '6190', name: '其他推銷費用', type: 'EXPENSE', subType: '推銷費用', normalBalance: 'DEBIT', parentCode: '6100', level: 3 },
    { code: '6200', name: '管理費用', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6000', level: 2 },
    { code: '6210', name: '薪資費用—管理', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6220', name: '租金費用', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6230', name: '水電費', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6240', name: '保險費', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6250', name: '稅捐', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6260', name: '折舊費用', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6270', name: '文具用品', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6280', name: '勞健保費', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6290', name: '伙食費', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6300', name: '交通費', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6310', name: '郵電費', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6320', name: '修繕費', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6330', name: '專業服務費', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6340', name: '呆帳損失', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6350', name: '訓練費', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },
    { code: '6390', name: '其他管理費用', type: 'EXPENSE', subType: '管理費用', normalBalance: 'DEBIT', parentCode: '6200', level: 3 },

    // ── 7xxx 營業外收支 ──
    { code: '7000', name: '營業外收入及支出', type: 'REVENUE', subType: '營業外', normalBalance: 'CREDIT', parentCode: null, level: 1 },
    { code: '7100', name: '利息收入', type: 'REVENUE', subType: '營業外收入', normalBalance: 'CREDIT', parentCode: '7000', level: 2 },
    { code: '7110', name: '匯兌收益', type: 'REVENUE', subType: '營業外收入', normalBalance: 'CREDIT', parentCode: '7000', level: 2 },
    { code: '7120', name: '處分資產利益', type: 'REVENUE', subType: '營業外收入', normalBalance: 'CREDIT', parentCode: '7000', level: 2 },
    { code: '7190', name: '其他營業外收入', type: 'REVENUE', subType: '營業外收入', normalBalance: 'CREDIT', parentCode: '7000', level: 2 },
    { code: '7500', name: '利息費用', type: 'EXPENSE', subType: '營業外支出', normalBalance: 'DEBIT', parentCode: '7000', level: 2 },
    { code: '7510', name: '匯兌損失', type: 'EXPENSE', subType: '營業外支出', normalBalance: 'DEBIT', parentCode: '7000', level: 2 },
    { code: '7520', name: '處分資產損失', type: 'EXPENSE', subType: '營業外支出', normalBalance: 'DEBIT', parentCode: '7000', level: 2 },
    { code: '7590', name: '其他營業外支出', type: 'EXPENSE', subType: '營業外支出', normalBalance: 'DEBIT', parentCode: '7000', level: 2 },

    // ── 8xxx 所得稅 ──
    { code: '8000', name: '所得稅費用', type: 'EXPENSE', subType: '所得稅', normalBalance: 'DEBIT', parentCode: null, level: 1 },
    { code: '8100', name: '本期所得稅費用', type: 'EXPENSE', subType: '所得稅', normalBalance: 'DEBIT', parentCode: '8000', level: 2 },
  ]

  for (const acct of chartOfAccounts) {
    await prisma.accountingAccount.upsert({
      where: { code: acct.code },
      update: { name: acct.name },
      create: acct,
    })
  }
  console.log(`✅ 會計科目建立完成 (${chartOfAccounts.length} 筆)`)

  // ========== 部門（組織圖用） ==========
  const departments = [
    { code: 'HQ',     name: '總部',     parentCode: null },
    { code: 'SALES',  name: '業務部',   parentCode: 'HQ' },
    { code: 'SALES-N',name: '北區業務',  parentCode: 'SALES' },
    { code: 'SALES-S',name: '南區業務',  parentCode: 'SALES' },
    { code: 'WH',     name: '倉儲部',   parentCode: 'HQ' },
    { code: 'WH-GS',  name: '龜山主倉',  parentCode: 'WH' },
    { code: 'WH-ZH',  name: '中和倉',    parentCode: 'WH' },
    { code: 'FIN',    name: '財務部',   parentCode: 'HQ' },
    { code: 'PROC',   name: '採購部',   parentCode: 'HQ' },
    { code: 'CS',     name: '客服部',   parentCode: 'HQ' },
    { code: 'ECOM',   name: '電商部',   parentCode: 'HQ' },
    { code: 'CARE',   name: '護理督導部', parentCode: 'HQ' },
  ]

  for (const dept of departments) {
    const parentId = dept.parentCode
      ? (await prisma.department.findUnique({ where: { code: dept.parentCode } }))?.id ?? null
      : null
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, parentId },
      create: { code: dept.code, name: dept.name, parentId },
    })
  }
  console.log(`✅ 部門建立完成 (${departments.length} 筆)`)

  // ========== 員工檔 + 出勤 + 薪資 ==========
  const allUsers = await prisma.user.findMany({ where: { isActive: true } })
  for (const u of allUsers) {
    await prisma.employeeProfile.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        gender: 'MALE',
        maritalStatus: 'SINGLE',
        education: '大學',
        laborInsuranceDate: new Date('2022-01-01'),
        healthInsuranceDate: new Date('2022-01-01'),
      },
    })
  }

  // 出勤記錄 - 過去 5 個工作日
  const salesUser2 = await prisma.user.findFirst({ where: { email: 'sales@comfortplus.com' } })
  const warehouseUser = await prisma.user.findFirst({ where: { email: 'warehouse@comfortplus.com' } })
  const usersForAtt = [salesUser2, warehouseUser].filter(Boolean)
  const today = new Date()
  for (const u of usersForAtt) {
    if (!u) continue
    for (let d = 1; d <= 5; d++) {
      const dt = new Date(today)
      dt.setDate(dt.getDate() - d)
      if (dt.getDay() === 0 || dt.getDay() === 6) continue
      const dateOnly = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
      await prisma.attendance.upsert({
        where: { userId_date: { userId: u.id, date: dateOnly } },
        update: {},
        create: {
          userId: u.id,
          date: dateOnly,
          clockIn: new Date(dt.setHours(8, 55, 0, 0)),
          clockOut: new Date(dt.setHours(18, 5, 0, 0)),
          status: 'PRESENT',
          overtime: d === 2 ? 1.5 : undefined,
        },
      })
    }
  }

  // 薪資記錄 - 最近 2 個月
  const financeUser = await prisma.user.findFirst({ where: { email: 'finance@comfortplus.com' } })
  const salaryData = [
    { email: 'sales@comfortplus.com', baseSalary: 38000, allowances: 3000, overtimePay: 1200, bonus: 0, laborInsurance: 1100, healthInsurance: 680, tax: 0 },
    { email: 'warehouse@comfortplus.com', baseSalary: 32000, allowances: 2000, overtimePay: 800, bonus: 0, laborInsurance: 936, healthInsurance: 580, tax: 0 },
    { email: 'finance@comfortplus.com', baseSalary: 45000, allowances: 3500, overtimePay: 0, bonus: 5000, laborInsurance: 1368, healthInsurance: 834, tax: 540 },
    { email: 'procurement@comfortplus.com', baseSalary: 40000, allowances: 3000, overtimePay: 0, bonus: 0, laborInsurance: 1197, healthInsurance: 730, tax: 240 },
  ]
  const months = [
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
  ]
  for (const sd of salaryData) {
    const u = await prisma.user.findFirst({ where: { email: sd.email } })
    if (!u) continue
    for (const m of months) {
      const netPay = sd.baseSalary + sd.allowances + sd.overtimePay + sd.bonus - sd.laborInsurance - sd.healthInsurance - sd.tax
      const existing = await prisma.payrollRecord.findUnique({ where: { userId_periodYear_periodMonth: { userId: u.id, periodYear: m.year, periodMonth: m.month } } })
      if (!existing) {
        await prisma.payrollRecord.create({
          data: {
            userId: u.id,
            periodYear: m.year,
            periodMonth: m.month,
            baseSalary: sd.baseSalary,
            allowances: sd.allowances,
            overtimePay: sd.overtimePay,
            bonus: sd.bonus,
            deductions: 0,
            laborInsurance: sd.laborInsurance,
            healthInsurance: sd.healthInsurance,
            tax: sd.tax,
            netPay,
            status: m.month === 1 ? 'PAID' : 'CONFIRMED',
            paidAt: m.month === 1 ? new Date('2026-01-25') : undefined,
          },
        })
      }
    }
  }
  console.log('✅ HR 員工/出勤/薪資建立完成')

  // ========== 會計傳票 ==========
  const adminForJournal = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
  const accounts = await prisma.accountingAccount.findMany({ where: { isActive: true } })
  const acctMap = Object.fromEntries(accounts.map(a => [a.code, a]))

  if (adminForJournal && acctMap['1100'] && acctMap['4100']) {
    const journalEntries = [
      {
        entryNo: 'JE-2026-001',
        entryDate: new Date('2026-01-31'),
        description: '2026年1月銷貨收入確認',
        entryType: 'AUTO',
        status: 'POSTED',
        totalDebit: 876500,
        totalCredit: 876500,
        lines: [
          { accountCode: '1130', debit: 876500, credit: 0, description: '應收帳款-1月銷貨' },
          { accountCode: '4110', debit: 0, credit: 835714, description: '銷貨收入-1月' },
          { accountCode: '2160', debit: 0, credit: 40786, description: '銷項稅額-5%' },
        ],
      },
      {
        entryNo: 'JE-2026-002',
        entryDate: new Date('2026-02-28'),
        description: '2026年2月銷貨收入確認',
        entryType: 'AUTO',
        status: 'POSTED',
        totalDebit: 921000,
        totalCredit: 921000,
        lines: [
          { accountCode: '1130', debit: 921000, credit: 0, description: '應收帳款-2月銷貨' },
          { accountCode: '4110', debit: 0, credit: 877143, description: '銷貨收入-2月' },
          { accountCode: '2160', debit: 0, credit: 43857, description: '銷項稅額-5%' },
        ],
      },
      {
        entryNo: 'JE-2026-003',
        entryDate: new Date('2026-01-25'),
        description: '1月薪資費用',
        entryType: 'MANUAL',
        status: 'POSTED',
        totalDebit: 328780,
        totalCredit: 328780,
        lines: [
          { accountCode: '6110', debit: 155000, credit: 0, description: '業務部薪資' },
          { accountCode: '6210', debit: 173780, credit: 0, description: '管理部薪資' },
          { accountCode: '2141', debit: 0, credit: 328780, description: '應付薪資' },
        ],
      },
      {
        entryNo: 'JE-2026-004',
        entryDate: new Date('2026-02-05'),
        description: '越南大發進貨付款',
        entryType: 'MANUAL',
        status: 'POSTED',
        totalDebit: 285000,
        totalCredit: 285000,
        lines: [
          { accountCode: '1151', debit: 285000, credit: 0, description: '商品存貨-進貨入帳' },
          { accountCode: '1102', debit: 0, credit: 285000, description: '銀行存款-電匯' },
        ],
      },
      {
        entryNo: 'JE-2026-005',
        entryDate: new Date('2026-03-01'),
        description: '租金費用-3月',
        entryType: 'MANUAL',
        status: 'DRAFT',
        totalDebit: 65000,
        totalCredit: 65000,
        lines: [
          { accountCode: '6220', debit: 65000, credit: 0, description: '龜山倉租金' },
          { accountCode: '2140', debit: 0, credit: 65000, description: '應付費用' },
        ],
      },
    ]

    for (const je of journalEntries) {
      const existing = await prisma.journalEntry.findUnique({ where: { entryNo: je.entryNo } })
      if (!existing) {
        const validLines = je.lines.filter(l => acctMap[l.accountCode])
        if (validLines.length < je.lines.length) continue
        await prisma.journalEntry.create({
          data: {
            entryNo: je.entryNo,
            entryDate: je.entryDate,
            description: je.description,
            entryType: je.entryType,
            status: je.status,
            totalDebit: je.totalDebit,
            totalCredit: je.totalCredit,
            postedAt: je.status === 'POSTED' ? je.entryDate : undefined,
            postedById: je.status === 'POSTED' ? adminForJournal.id : undefined,
            createdById: adminForJournal.id,
            lines: {
              create: validLines.map((l, idx) => ({
                accountId: acctMap[l.accountCode].id,
                debit: l.debit,
                credit: l.credit,
                description: l.description,
                lineNo: idx + 1,
              })),
            },
          },
        })
      }
    }
    console.log('✅ 會計傳票建立完成')
  }

  // ========== 固定資產 ==========
  const warehouseMain = await prisma.warehouse.findFirst({ where: { code: 'MAIN' } })
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
  if (warehouseMain && adminUser) {
    const fixedAssets = [
      { assetNo: 'FA-2023-001', name: '龜山主倉叉車 #1', category: 'EQUIPMENT', location: '龜山主倉 B區', purchaseDate: new Date('2023-03-15'), purchaseAmount: 380000, salvageValue: 50000, usefulLifeYears: 8, status: 'ACTIVE', notes: '電動堆高叉車，最大承重2噸' },
      { assetNo: 'FA-2023-002', name: '中和倉移動貨架 A組', category: 'EQUIPMENT', location: '中和768倉', purchaseDate: new Date('2023-06-20'), purchaseAmount: 120000, salvageValue: 10000, usefulLifeYears: 10, status: 'ACTIVE' },
      { assetNo: 'FA-2022-001', name: '業務部筆電 x5台', category: 'IT', location: '總部3F', purchaseDate: new Date('2022-01-10'), purchaseAmount: 175000, salvageValue: 5000, usefulLifeYears: 5, status: 'ACTIVE', notes: 'MacBook Air M1 x5' },
      { assetNo: 'FA-2022-002', name: '辦公室桌椅組 A棟', category: 'FURNITURE', location: '總部2F', purchaseDate: new Date('2022-03-01'), purchaseAmount: 85000, salvageValue: 5000, usefulLifeYears: 7, status: 'ACTIVE' },
      { assetNo: 'FA-2024-001', name: '冷藏貨車 #1 (7200cc)', category: 'VEHICLE', location: '龜山主倉', purchaseDate: new Date('2024-01-05'), purchaseAmount: 1250000, salvageValue: 150000, usefulLifeYears: 10, status: 'ACTIVE', serialNo: 'ABC-1234' },
      { assetNo: 'FA-2024-002', name: '掃描儀暨列印機 Brother MFC', category: 'IT', location: '總部1F', purchaseDate: new Date('2024-07-15'), purchaseAmount: 28000, salvageValue: 2000, usefulLifeYears: 5, status: 'ACTIVE' },
    ]
    for (const asset of fixedAssets) {
      await prisma.fixedAsset.upsert({
        where: { assetNo: asset.assetNo },
        update: {},
        create: { ...asset, createdById: adminUser.id },
      })
    }
    console.log(`✅ 固定資產建立完成 (${fixedAssets.length} 筆)`)
  }

  // ========== 預算 ==========
  if (adminUser) {
    const budgetItems = [
      { budgetYear: 2026, budgetMonth: null, department: '業務部', category: 'REVENUE', description: '2026年度業務目標', budgetAmount: 12000000, actualAmount: 2680000, notes: 'Q1 達成率 22.3%' },
      { budgetYear: 2026, budgetMonth: null, department: '倉儲部', category: 'OPEX', description: '2026年度倉儲作業費用', budgetAmount: 1800000, actualAmount: 410000, notes: '含人力+物料' },
      { budgetYear: 2026, budgetMonth: null, department: '採購部', category: 'COGS', description: '2026年度進貨預算', budgetAmount: 8500000, actualAmount: 1920000, notes: '含越南+台灣廠商' },
      { budgetYear: 2026, budgetMonth: null, department: '財務部', category: 'OPEX', description: '2026年度管理費用', budgetAmount: 960000, actualAmount: 235000, notes: '含薪資+租金+水電' },
      { budgetYear: 2026, budgetMonth: 1, department: '業務部', category: 'REVENUE', description: '1月業績目標', budgetAmount: 1000000, actualAmount: 876500, notes: '' },
      { budgetYear: 2026, budgetMonth: 2, department: '業務部', category: 'REVENUE', description: '2月業績目標', budgetAmount: 900000, actualAmount: 921000, notes: '農曆年後回溫' },
      { budgetYear: 2026, budgetMonth: 3, department: '業務部', category: 'REVENUE', description: '3月業績目標', budgetAmount: 1100000, actualAmount: 882500, notes: '' },
    ]
    for (const b of budgetItems) {
      const existing = await prisma.budget.findFirst({ where: { budgetYear: b.budgetYear, budgetMonth: b.budgetMonth ?? null, department: b.department, category: b.category } })
      if (!existing) {
        await prisma.budget.create({ data: { ...b, createdById: adminUser.id } })
      }
    }
    console.log(`✅ 預算資料建立完成`)
  }

  // ========== 應付帳款 AP ==========
  if (adminUser) {
    const suppliers = await prisma.supplier.findMany({ take: 5 })
    const now2 = new Date()
    const apRecords = [
      { supplierId: suppliers[0]?.id, invoiceNo: 'VN2026-0301', invoiceDate: new Date('2026-03-01'), dueDate: new Date('2026-04-30'), amount: 285000, paidAmount: 0, status: 'NOT_DUE' as const, currency: 'USD', notes: 'Mar批次進貨' },
      { supplierId: suppliers[1]?.id, invoiceNo: 'VN2026-0215', invoiceDate: new Date('2026-02-15'), dueDate: new Date('2026-03-15'), amount: 192000, paidAmount: 192000, status: 'PAID' as const, currency: 'TWD', notes: '已結清' },
      { supplierId: suppliers[2]?.id, invoiceNo: 'TW2026-0310', invoiceDate: new Date('2026-03-10'), dueDate: new Date('2026-04-10'), amount: 56800, paidAmount: 0, status: 'NOT_DUE' as const, currency: 'TWD', notes: '包材費' },
      { supplierId: suppliers[0]?.id, invoiceNo: 'VN2026-0110', invoiceDate: new Date('2026-01-10'), dueDate: new Date('2026-02-28'), amount: 320000, paidAmount: 0, status: 'DUE' as const, currency: 'USD', notes: '逾期未付' },
    ]
    for (const ap of apRecords) {
      if (!ap.supplierId) continue
      const existing = await prisma.accountsPayable.findFirst({ where: { invoiceNo: ap.invoiceNo } })
      if (!existing) {
        await prisma.accountsPayable.create({ data: ap })
      }
    }
    console.log(`✅ 應付帳款建立完成`)
  }

  // ========== 應收帳款 AR ==========
  if (adminUser) {
    const customers2 = await prisma.customer.findMany({ take: 5 })
    const salesOrders = await prisma.salesOrder.findMany({ where: { status: { in: ['CONFIRMED', 'COMPLETED'] } }, take: 5 })
    const arRecords = [
      { customerId: customers2[0]?.id, orderId: salesOrders[0]?.id, invoiceNo: 'AR-2026-001', invoiceDate: new Date('2026-03-01'), dueDate: new Date('2026-04-01'), amount: 47800, paidAmount: 0, status: 'NOT_DUE' as const },
      { customerId: customers2[1]?.id, orderId: salesOrders[1]?.id, invoiceNo: 'AR-2026-002', invoiceDate: new Date('2026-02-15'), dueDate: new Date('2026-03-16'), amount: 32500, paidAmount: 32500, status: 'PAID' as const },
      { customerId: customers2[2]?.id, orderId: salesOrders[2]?.id, invoiceNo: 'AR-2026-003', invoiceDate: new Date('2026-01-20'), dueDate: new Date('2026-02-20'), amount: 85600, paidAmount: 0, status: 'DUE' as const },
      { customerId: customers2[3]?.id, orderId: salesOrders[3]?.id, invoiceNo: 'AR-2026-004', invoiceDate: new Date('2026-03-10'), dueDate: new Date('2026-04-10'), amount: 22400, paidAmount: 0, status: 'NOT_DUE' as const },
    ]
    for (const ar of arRecords) {
      if (!ar.customerId) continue
      const existing = await prisma.accountsReceivable.findFirst({ where: { invoiceNo: ar.invoiceNo } })
      if (!existing) {
        await prisma.accountsReceivable.create({ data: { ...ar, orderId: ar.orderId ?? undefined } })
      }
    }
    console.log(`✅ 應收帳款建立完成`)
  }

  // ========== 銷貨單 (SalesInvoice) ==========
  if (adminUser && warehouseMain) {
    const salesUser = await prisma.user.findFirst({ where: { email: 'sales@comfortplus.com' } })
    const confirmOrders = await prisma.salesOrder.findMany({ where: { status: { in: ['CONFIRMED', 'COMPLETED'] } }, include: { customer: true, items: { include: { product: true } } }, take: 3 })
    for (let siIdx = 0; siIdx < confirmOrders.length; siIdx++) {
      const so = confirmOrders[siIdx]
      const existingSI = await prisma.salesInvoice.findFirst({ where: { sourceOrderId: so.id } })
      if (!existingSI && so.items.length > 0) {
        const subtotal = so.items.reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0)
        const taxAmount = Math.round(subtotal * 0.05)
        const totalAmount = subtotal + taxAmount
        const invoiceNumber = `SI${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}${String(siIdx + 1).padStart(3,'0')}`
        await prisma.salesInvoice.create({
          data: {
            invoiceNumber,
            date: new Date(),
            customerId: so.customerId,
            salesPersonId: salesUser?.id ?? adminUser.id,
            handlerId: adminUser.id,
            warehouseId: warehouseMain.id,
            subtotal,
            taxAmount,
            totalAmount,
            status: 'CONFIRMED',
            sourceOrderId: so.id,
            createdById: adminUser.id,
            receiverName: so.customer.contactPerson ?? so.customer.name,
            shippingAddress: so.customer.address ?? '',
            items: {
              create: so.items.map((item, idx) => {
                const unitPrice = Number(item.unitPrice)
                const qty = Number(item.quantity)
                const itemSubtotal = unitPrice * qty
                const itemTax = Math.round(itemSubtotal * 0.05)
                return {
                  productId: item.productId,
                  productName: item.product.name,
                  specification: item.product.specification ?? '',
                  quantity: qty,
                  unit: item.product.unit ?? '包',
                  unitPrice,
                  unitPriceTax: Math.round(unitPrice * 1.05),
                  subtotal: itemSubtotal,
                  taxAmount: itemTax,
                  totalAmount: itemSubtotal + itemTax,
                }
              }),
            },
          },
        })
      }
    }
    console.log(`✅ 銷貨單建立完成`)
  }

  // ========== 合約 ==========
  if (adminUser) {
    const contractCustomers = await prisma.customer.findMany({ take: 4 })
    const contracts = [
      { contractNo: 'CT-2025-001', title: '台北松山護理之家年度供貨合約', customerId: contractCustomers[0]?.id, effectiveFrom: new Date('2025-01-01'), effectiveTo: new Date('2025-12-31'), totalValue: 1440000, status: 'ACTIVE', contractType: 'SALES', notes: '每月固定配送 10萬/月' },
      { contractNo: 'CT-2025-002', title: '長青安養中心服務合約', customerId: contractCustomers[1]?.id, effectiveFrom: new Date('2025-03-01'), effectiveTo: new Date('2026-02-28'), totalValue: 960000, status: 'ACTIVE', contractType: 'SERVICE', notes: '每季結算' },
      { contractNo: 'CT-2026-001', title: '台中博愛醫院2026年供貨框架合約', customerId: contractCustomers[2]?.id, effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-12-31'), totalValue: 3600000, status: 'ACTIVE', contractType: 'SALES', notes: '大客戶優惠價，NET60付款' },
      { contractNo: 'CT-2024-001', title: '全台醫材經銷年度協議', customerId: contractCustomers[3]?.id, effectiveFrom: new Date('2024-01-01'), effectiveTo: new Date('2024-12-31'), totalValue: 2400000, status: 'EXPIRED', contractType: 'SALES', notes: '已到期，需更新' },
    ]
    for (const c of contracts) {
      if (!c.customerId) continue
      const existing = await prisma.contract.findFirst({ where: { contractNo: c.contractNo } })
      if (!existing) {
        await prisma.contract.create({ data: { ...c, createdById: adminUser.id } })
      }
    }
    console.log(`✅ 合約資料建立完成`)
  }

  // ========== WMS 儲位 ==========
  if (warehouseMain) {
    const wmsZone = await prisma.wmsZone.upsert({
      where: { warehouseId_code: { warehouseId: warehouseMain.id, code: 'A' } },
      update: {},
      create: { warehouseId: warehouseMain.id, code: 'A', name: 'A區-尿布主儲區' },
    })
    const wmsZoneB = await prisma.wmsZone.upsert({
      where: { warehouseId_code: { warehouseId: warehouseMain.id, code: 'B' } },
      update: {},
      create: { warehouseId: warehouseMain.id, code: 'B', name: 'B區-護墊護理區' },
    })
    const locationCodes = ['A-01-01', 'A-01-02', 'A-02-01', 'A-02-02', 'A-03-01', 'B-01-01', 'B-01-02', 'B-02-01']
    for (const loc of locationCodes) {
      const zoneId = loc.startsWith('A') ? wmsZone.id : wmsZoneB.id
      await prisma.wmsLocation.upsert({
        where: { zoneId_code: { zoneId, code: loc } },
        update: {},
        create: { zoneId, code: loc },
      })
    }
    console.log(`✅ WMS 儲位建立完成`)
  }

  // ========== SalesOpportunity ==========
  try {
    const oppCustomers = await prisma.customer.findMany({ take: 5 })
    const salesUserOpp = await prisma.user.findFirst({ where: { email: 'sales@comfortplus.com' } })
    if (oppCustomers.length > 0 && salesUserOpp) {
      const opps = [
        { title: '台北松山護理之家 – 成人紙尿布 M號年度採購', customerId: oppCustomers[0].id, ownerId: salesUserOpp.id, stage: 'NEGOTIATING' as const, probability: 70, expectedAmount: 480000, expectedCloseDate: new Date('2026-04-30'), productInterest: 'ADL-001 M號', notes: '院長有意願，等採購主任回覆' },
        { title: '板橋長青安養中心 – 護墊新品試用', customerId: oppCustomers[1].id, ownerId: salesUserOpp.id, stage: 'SAMPLING' as const, probability: 45, expectedAmount: 120000, expectedCloseDate: new Date('2026-05-15'), productInterest: 'PAD-001 日用型', notes: '已寄送樣品 x2箱，等待回饋' },
        { title: '台中博愛醫院 – XL號擴大訂購', customerId: oppCustomers[2].id, ownerId: salesUserOpp.id, stage: 'QUOTED' as const, probability: 60, expectedAmount: 960000, expectedCloseDate: new Date('2026-06-30'), productInterest: 'ADL-003 XL號', notes: '已提交報價，競品為李節' },
        { title: '全台醫材 – OEM包裝合作', customerId: oppCustomers[3].id, ownerId: salesUserOpp.id, stage: 'NEEDS_ANALYSIS' as const, probability: 30, expectedAmount: 2400000, expectedCloseDate: new Date('2026-09-30'), productInterest: 'ADL-001/002/003', notes: '需求評估中，需要工廠配合' },
        { title: '高雄鳳山幸福老人之家 – 初次合作', customerId: oppCustomers[4].id, ownerId: salesUserOpp.id, stage: 'VISITED' as const, probability: 20, expectedAmount: 240000, expectedCloseDate: new Date('2026-07-31'), productInterest: 'ADL-002 L號', notes: '第一次拜訪，院方興趣正面' },
      ]
      for (const opp of opps) {
        const exists = await prisma.salesOpportunity.findFirst({ where: { customerId: opp.customerId, title: opp.title } })
        if (!exists) await prisma.salesOpportunity.create({ data: opp })
      }
      console.log('✅ SalesOpportunity 建立完成 (5 筆)')
    }
  } catch (e) { console.error('❌ SalesOpportunity 失敗:', e) }

  // ========== AfterSalesOrder ==========
  try {
    const asCustomers = await prisma.customer.findMany({ take: 5 })
    const adminForAS = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
    if (asCustomers.length > 0 && adminForAS) {
      const asOrders = [
        { orderNo: 'AS-2026-001', source: 'WARRANTY', status: 'OPEN', priority: 'HIGH', customerId: asCustomers[0].id, contactName: '林護理長', contactPhone: '0912-345678', description: '成人紙尿布 M號出現滲漏問題，客訴 3件', createdById: adminForAS.id },
        { orderNo: 'AS-2026-002', source: 'REPAIR', status: 'IN_PROGRESS', priority: 'MEDIUM', customerId: asCustomers[1].id, contactName: '張主任', contactPhone: '0923-456789', description: '護墊黏性不足，回潮問題', scheduledAt: new Date('2026-03-28'), createdById: adminForAS.id },
        { orderNo: 'AS-2026-003', source: 'REPLACEMENT', status: 'RESOLVED', priority: 'LOW', customerId: asCustomers[2].id, contactName: '陳採購', contactPhone: '0934-567890', description: '包裝破損，申請更換 1箱 XL號', completedAt: new Date('2026-03-20'), createdById: adminForAS.id },
        { orderNo: 'AS-2026-004', source: 'TRAINING', status: 'OPEN', priority: 'MEDIUM', customerId: asCustomers[3].id, contactName: '王小姐', contactPhone: '0945-678901', description: '新進照服員使用培訓需求', scheduledAt: new Date('2026-04-05'), createdById: adminForAS.id },
        { orderNo: 'AS-2026-005', source: 'WARRANTY', status: 'IN_PROGRESS', priority: 'URGENT', customerId: asCustomers[4].id, contactName: '劉院長', contactPhone: '0956-789012', description: '整批 L號品質異常，需緊急處理', assignedToId: adminForAS.id, createdById: adminForAS.id },
      ]
      for (const o of asOrders) {
        const exists = await prisma.afterSalesOrder.findFirst({ where: { orderNo: o.orderNo } })
        if (!exists) await prisma.afterSalesOrder.create({ data: o })
      }
      console.log('✅ AfterSalesOrder 建立完成 (5 筆)')
    }
  } catch (e) { console.error('❌ AfterSalesOrder 失敗:', e) }

  // ========== StockCount ==========
  try {
    const whForCount = await prisma.warehouse.findFirst({ where: { code: 'MAIN' } })
    const adminForCount = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
    const productsForCount = await prisma.product.findMany({ take: 5 })
    if (whForCount && adminForCount && productsForCount.length >= 2) {
      const counts = [
        { countNo: 'SC-2026-001', warehouseId: whForCount.id, status: 'COMPLETED' as const, countDate: new Date('2026-02-28'), countType: 'FULL', plannedDate: new Date('2026-02-28'), createdById: adminForCount.id, totalItems: 3, totalVariance: -5, completedAt: new Date('2026-02-28') },
        { countNo: 'SC-2026-002', warehouseId: whForCount.id, status: 'DRAFT' as const, countType: 'CYCLE', plannedDate: new Date('2026-03-31'), createdById: adminForCount.id },
      ]
      for (const sc of counts) {
        const exists = await prisma.stockCount.findFirst({ where: { countNo: sc.countNo } })
        if (!exists) {
          await prisma.stockCount.create({
            data: {
              ...sc,
              items: {
                create: productsForCount.slice(0, 3).map((p, i) => ({
                  productId: p.id,
                  systemQty: 100 + i * 50,
                  countedQty: 98 + i * 50 - (i === 1 ? 3 : 0),
                  variance: i === 1 ? -3 : (i === 0 ? -2 : 0),
                })),
              },
            },
          })
        }
      }
      console.log('✅ StockCount 建立完成 (2 筆)')
    }
  } catch (e) { console.error('❌ StockCount 失敗:', e) }

  // ========== InternalUse ==========
  try {
    const whForIU = await prisma.warehouse.findFirst({ where: { code: 'MAIN' } })
    const salesUserIU = await prisma.user.findFirst({ where: { email: 'sales@comfortplus.com' } })
    const adminForIU = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
    const productsForIU = await prisma.product.findMany({ take: 3 })
    if (whForIU && salesUserIU && adminForIU && productsForIU.length > 0) {
      const iuList = [
        { useNo: 'IU-2026-001', purpose: 'SAMPLE', warehouseId: whForIU.id, requestedById: salesUserIU.id, status: 'ISSUED', approvedById: adminForIU.id, approvedAt: new Date('2026-03-01'), issuedAt: new Date('2026-03-02'), notes: '樣品寄送台中博愛醫院', productId: productsForIU[0].id, qty: 5 },
        { useNo: 'IU-2026-002', purpose: 'MARKETING', warehouseId: whForIU.id, requestedById: salesUserIU.id, status: 'APPROVED', approvedById: adminForIU.id, approvedAt: new Date('2026-03-10'), notes: '展覽活動用品', productId: productsForIU[1].id, qty: 20 },
        { useNo: 'IU-2026-003', purpose: 'STAFF', warehouseId: whForIU.id, requestedById: adminForIU.id, status: 'DRAFT', notes: '員工福利用品', productId: productsForIU[2].id, qty: 3 },
      ]
      for (const iu of iuList) {
        const { productId, qty, ...iuData } = iu
        const exists = await prisma.internalUse.findFirst({ where: { useNo: iu.useNo } })
        if (!exists) {
          await prisma.internalUse.create({
            data: {
              ...iuData,
              items: { create: [{ productId, quantity: qty }] },
            },
          })
        }
      }
      console.log('✅ InternalUse 建立完成 (3 筆)')
    }
  } catch (e) { console.error('❌ InternalUse 失敗:', e) }

  // ========== PurchaseRequest ==========
  try {
    const adminForPR = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
    const procUser = await prisma.user.findFirst({ where: { email: 'procurement@comfortplus.com' } })
    const whForPR = await prisma.warehouse.findFirst({ where: { code: 'MAIN' } })
    const productsForPR = await prisma.product.findMany({ take: 5 })
    const suppliersForPR = await prisma.supplier.findMany({ take: 3 })
    if (adminForPR && whForPR && productsForPR.length > 0 && suppliersForPR.length > 0) {
      const handler = procUser ?? adminForPR
      const prList = [
        { requestNumber: 'PRQ-20260301-001', warehouseId: whForPR.id, handlerId: handler.id, createdById: adminForPR.id, status: 'SUBMITTED' as const, deliveryDate: new Date('2026-04-15'), notes: '補充 M號庫存', productId: productsForPR[0].id, supplierId: suppliersForPR[2].id, qty: 5000 },
        { requestNumber: 'PRQ-20260305-002', warehouseId: whForPR.id, handlerId: handler.id, createdById: adminForPR.id, status: 'APPROVED' as const, deliveryDate: new Date('2026-04-30'), notes: 'L號補充', productId: productsForPR[1].id, supplierId: suppliersForPR[2].id, qty: 3000 },
        { requestNumber: 'PRQ-20260310-003', warehouseId: whForPR.id, handlerId: handler.id, createdById: adminForPR.id, status: 'DRAFT' as const, deliveryDate: new Date('2026-05-31'), notes: '護墊日用型補充', productId: productsForPR[3].id, supplierId: suppliersForPR[0].id, qty: 2000 },
        { requestNumber: 'PRQ-20260315-004', warehouseId: whForPR.id, handlerId: handler.id, createdById: adminForPR.id, status: 'SUBMITTED' as const, deliveryDate: new Date('2026-04-20'), notes: 'XL號緊急補充', productId: productsForPR[2].id, supplierId: suppliersForPR[2].id, qty: 1500 },
      ]
      for (const pr of prList) {
        const { productId, supplierId, qty, ...prData } = pr
        const exists = await prisma.purchaseRequest.findFirst({ where: { requestNumber: pr.requestNumber } })
        if (!exists) {
          await prisma.purchaseRequest.create({
            data: {
              ...prData,
              items: { create: [{ productId, supplierId, quantity: qty, specification: '符合原廠規格' }] },
            },
          })
        }
      }
      console.log('✅ PurchaseRequest 建立完成 (4 筆)')
    }
  } catch (e) { console.error('❌ PurchaseRequest 失敗:', e) }

  // ========== ProductionOrder (needs PurchaseOrder – create stub PO first) ==========
  try {
    const adminForPO = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
    const suppliersForPO = await prisma.supplier.findMany({ take: 3 })
    const productsForPO = await prisma.product.findMany({ take: 3 })
    if (adminForPO && suppliersForPO.length > 0 && productsForPO.length >= 3) {
      // Ensure stub PurchaseOrders exist
      const stubPOs = [
        { poNo: 'PO-2026-STUB-001', supplierId: suppliersForPO[2].id, purchaseDate: new Date('2026-01-10'), expectedDate: new Date('2026-04-30'), subtotal: 850000, totalAmount: 850000, currency: 'USD', status: 'ORDERED' as const, createdById: adminForPO.id },
        { poNo: 'PO-2026-STUB-002', supplierId: suppliersForPO[2].id, purchaseDate: new Date('2026-02-05'), expectedDate: new Date('2026-05-31'), subtotal: 620000, totalAmount: 620000, currency: 'USD', status: 'ORDERED' as const, createdById: adminForPO.id },
        { poNo: 'PO-2026-STUB-003', supplierId: suppliersForPO[2].id, purchaseDate: new Date('2026-03-01'), expectedDate: new Date('2026-06-30'), subtotal: 480000, totalAmount: 480000, currency: 'USD', status: 'DRAFT' as const, createdById: adminForPO.id },
      ]
      const poIds: string[] = []
      for (const po of stubPOs) {
        let existing = await prisma.purchaseOrder.findFirst({ where: { poNo: po.poNo } })
        if (!existing) {
          existing = await prisma.purchaseOrder.create({ data: po })
        }
        poIds.push(existing.id)
      }
      const prodOrders = [
        { productionNo: 'PROD-2026-001', purchaseOrderId: poIds[0], factoryId: suppliersForPO[2].id, status: 'IN_PRODUCTION' as const, orderQty: 50000, producedQty: 30000, productionStartDate: new Date('2026-02-01'), productionEndDate: new Date('2026-04-15'), notes: '越南大發 M號生產' },
        { productionNo: 'PROD-2026-002', purchaseOrderId: poIds[1], factoryId: suppliersForPO[2].id, status: 'PENDING' as const, orderQty: 30000, notes: 'L號待排產' },
        { productionNo: 'PROD-2026-003', purchaseOrderId: poIds[2], factoryId: suppliersForPO[2].id, status: 'SAMPLE_SUBMITTED' as const, orderQty: 20000, sampleSubmitDate: new Date('2026-03-15'), notes: 'XL號打樣中' },
      ]
      for (const prod of prodOrders) {
        const exists = await prisma.productionOrder.findFirst({ where: { productionNo: prod.productionNo } })
        if (!exists) await prisma.productionOrder.create({ data: prod })
      }
      console.log('✅ ProductionOrder 建立完成 (3 筆)')

      // ========== MaterialRequisition ==========
      try {
        const wh2 = await prisma.warehouse.findMany({ take: 2 })
        if (wh2.length >= 1) {
          const toWh = wh2.length >= 2 ? wh2[1] : wh2[0]
          const prodOrder1 = await prisma.productionOrder.findFirst({ where: { productionNo: 'PROD-2026-001' } })
          const prodOrder2 = await prisma.productionOrder.findFirst({ where: { productionNo: 'PROD-2026-002' } })
          const mrList = [
            { requisitionNumber: 'MR-20260215-001', productionOrderId: prodOrder1!.id, fromWarehouseId: wh2[0].id, toWarehouseId: toWh.id, handlerId: adminForPO.id, createdById: adminForPO.id, status: 'ISSUED' as const, notes: 'M號生產所需原料', productId: productsForPO[0].id, qty: 50000 },
            { requisitionNumber: 'MR-20260310-002', productionOrderId: prodOrder2!.id, fromWarehouseId: wh2[0].id, toWarehouseId: toWh.id, handlerId: adminForPO.id, createdById: adminForPO.id, status: 'DRAFT' as const, notes: 'L號生產準備', productId: productsForPO[1].id, qty: 30000 },
          ]
          for (const mr of mrList) {
            const { productId, qty, ...mrData } = mr
            const exists = await prisma.materialRequisition.findFirst({ where: { requisitionNumber: mr.requisitionNumber } })
            if (!exists) {
              await prisma.materialRequisition.create({
                data: {
                  ...mrData,
                  items: { create: [{ productId, productName: productsForPO.find(p => p.id === productId)?.name ?? '', quantity: qty }] },
                },
              })
            }
          }
          console.log('✅ MaterialRequisition 建立完成 (2 筆)')
        }
      } catch (e2) { console.error('❌ MaterialRequisition 失敗:', e2) }
    }
  } catch (e) { console.error('❌ ProductionOrder 失敗:', e) }

  // ========== SeaFreight ==========
  try {
    const sfList = [
      { freightNo: 'SF-2026-001', status: 'ARRIVED' as const, customsStatus: 'CLEARED' as const, shippingMode: 'SEA', incoterm: 'FOB', forwarder: '台灣貨代有限公司', containerType: '40HQ', containerNo: 'TCKU3456789', vesselName: 'Ever Given III', portOfLoading: 'Ho Chi Minh City', portOfDischarge: 'Keelung', etd: new Date('2026-01-15'), eta: new Date('2026-02-10'), actualDeparture: new Date('2026-01-16'), actualArrival: new Date('2026-02-12'), palletCount: 24, boxCount: 480, oceanFreight: 85000, customsFee: 12000, totalCostTWD: 120000, notes: '2026年Q1首批進貨' },
      { freightNo: 'SF-2026-002', status: 'IN_TRANSIT' as const, customsStatus: 'NOT_STARTED' as const, shippingMode: 'SEA', incoterm: 'CIF', forwarder: '全球物流股份有限公司', containerType: '40GP', vesselName: 'Cosco Shipping', portOfLoading: 'Ho Chi Minh City', portOfDischarge: 'Taichung', etd: new Date('2026-03-10'), eta: new Date('2026-04-05'), palletCount: 20, boxCount: 400, oceanFreight: 72000, notes: 'Q2首批在途' },
      { freightNo: 'SF-2026-003', status: 'PENDING' as const, customsStatus: 'NOT_STARTED' as const, shippingMode: 'SEA', incoterm: 'EXW', forwarder: '中亞海運代理', containerType: '20GP', portOfLoading: 'Ho Chi Minh City', portOfDischarge: 'Keelung', etd: new Date('2026-05-01'), eta: new Date('2026-05-28'), notes: 'Q2第二批預訂' },
    ]
    for (const sf of sfList) {
      const exists = await prisma.seaFreight.findFirst({ where: { freightNo: sf.freightNo } })
      if (!exists) await prisma.seaFreight.create({ data: sf })
    }
    console.log('✅ SeaFreight 建立完成 (3 筆)')
  } catch (e) { console.error('❌ SeaFreight 失敗:', e) }

  // ========== ImportProject ==========
  try {
    const adminForIP = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
    const suppliersForIP = await prisma.supplier.findMany({ take: 3 })
    const sf1 = await prisma.seaFreight.findFirst({ where: { freightNo: 'SF-2026-001' } })
    const sf2 = await prisma.seaFreight.findFirst({ where: { freightNo: 'SF-2026-002' } })
    if (adminForIP && suppliersForIP.length > 0) {
      const ipList = [
        { projectNo: 'IMP-2026-001', name: '2026年Q1越南大發進口專案', supplierId: suppliersForIP[2].id, freightId: sf1?.id, status: 'CLOSED', etd: new Date('2026-01-15'), eta: new Date('2026-02-10'), actualArrival: new Date('2026-02-12'), currency: 'USD', exchangeRate: 32.5, totalCost: 4230000, createdById: adminForIP.id, notes: '已完成清關入倉' },
        { projectNo: 'IMP-2026-002', name: '2026年Q2進口專案', supplierId: suppliersForIP[2].id, freightId: sf2?.id, status: 'IN_PROGRESS', etd: new Date('2026-03-10'), eta: new Date('2026-04-05'), currency: 'USD', exchangeRate: 32.8, createdById: adminForIP.id, notes: '貨物在途' },
      ]
      for (const ip of ipList) {
        const exists = await prisma.importProject.findFirst({ where: { projectNo: ip.projectNo } })
        if (!exists) await prisma.importProject.create({ data: ip })
      }
      console.log('✅ ImportProject 建立完成 (2 筆)')
    }
  } catch (e) { console.error('❌ ImportProject 失敗:', e) }

  // ========== SalesChannel + ChannelOrder ==========
  try {
    const productsForCh = await prisma.product.findMany({ take: 3 })
    const channels = [
      { code: 'SHOPEE-TW', name: '蝦皮購物（台灣）', platform: 'SHOPEE' as const, shopUrl: 'https://shopee.tw/comfortplus', commissionRate: 3.0, integrationMethod: 'API', isActive: true },
      { code: 'MOMO-TW', name: 'momo購物網', platform: 'MOMO' as const, shopUrl: 'https://www.momoshop.com.tw', commissionRate: 5.0, integrationMethod: 'CSV_IMPORT', isActive: true },
      { code: 'OFFICIAL-WEB', name: '官方電商網站', platform: 'OFFICIAL' as const, shopUrl: 'https://shop.comfortplus.com.tw', commissionRate: 0, integrationMethod: 'API', isActive: true },
    ]
    const channelIds: string[] = []
    for (const ch of channels) {
      const upserted = await prisma.salesChannel.upsert({
        where: { code: ch.code },
        update: {},
        create: ch,
      })
      channelIds.push(upserted.id)
    }
    if (productsForCh.length > 0 && channelIds.length >= 3) {
      const chOrders = [
        { channelId: channelIds[0], channelOrderNo: 'SP-202603-001001', buyerName: '王小明', buyerAddress: '台北市信義區信義路五段7號', orderAmount: 498, platformFee: 15, shippingFee: 60, netAmount: 423, status: 'COMPLETED' as const, paymentStatus: 'PAID', deliveryStatus: 'DELIVERED', orderedAt: new Date('2026-03-01'), productId: productsForCh[0].id, qty: 2, unitPrice: 249 },
        { channelId: channelIds[0], channelOrderNo: 'SP-202603-001002', buyerName: '李大華', buyerAddress: '新北市板橋區中山路一段1號', orderAmount: 747, platformFee: 22, shippingFee: 60, netAmount: 665, status: 'SHIPPED' as const, paymentStatus: 'PAID', deliveryStatus: 'SHIPPED', orderedAt: new Date('2026-03-05'), productId: productsForCh[1].id, qty: 3, unitPrice: 249 },
        { channelId: channelIds[1], channelOrderNo: 'MM-202603-005511', buyerName: '陳美玲', buyerAddress: '台中市西屯區台灣大道三段99號', orderAmount: 1290, platformFee: 65, shippingFee: 0, netAmount: 1225, status: 'PENDING' as const, paymentStatus: 'PAID', deliveryStatus: 'PENDING', orderedAt: new Date('2026-03-10'), productId: productsForCh[2].id, qty: 5, unitPrice: 258 },
        { channelId: channelIds[1], channelOrderNo: 'MM-202603-005512', buyerName: '黃志偉', buyerAddress: '高雄市苓雅區四維三路2號', orderAmount: 516, platformFee: 26, shippingFee: 60, netAmount: 430, status: 'CONFIRMED' as const, paymentStatus: 'PAID', deliveryStatus: 'PENDING', orderedAt: new Date('2026-03-12'), productId: productsForCh[0].id, qty: 2, unitPrice: 258 },
        { channelId: channelIds[2], channelOrderNo: 'OW-202603-000101', buyerName: '官網客戶A', buyerAddress: '桃園市中壢區中正路1號', orderAmount: 950, platformFee: 0, shippingFee: 60, netAmount: 890, status: 'DELIVERED' as const, paymentStatus: 'PAID', deliveryStatus: 'DELIVERED', orderedAt: new Date('2026-03-15'), productId: productsForCh[1].id, qty: 4, unitPrice: 237 },
      ]
      for (const co of chOrders) {
        const { productId, qty, unitPrice, ...coData } = co
        const exists = await prisma.channelOrder.findFirst({ where: { channelOrderNo: co.channelOrderNo } })
        if (!exists) {
          await prisma.channelOrder.create({
            data: {
              ...coData,
              items: { create: [{ productId, quantity: qty, unitPrice, subtotal: qty * unitPrice }] },
            },
          })
        }
      }
      console.log('✅ SalesChannel (3) + ChannelOrder (5) 建立完成')
    }
  } catch (e) { console.error('❌ SalesChannel/ChannelOrder 失敗:', e) }

  // ========== QualityCheck ==========
  try {
    const productsForQC = await prisma.product.findMany({ take: 4 })
    const suppliersForQC = await prisma.supplier.findMany({ take: 3 })
    if (productsForQC.length > 0 && suppliersForQC.length > 0) {
      const qcList = [
        { qcNo: 'QC-2026-001', inspectionType: 'FINISHED_PRODUCT' as const, qcStatus: 'COMPLETED' as const, result: 'ACCEPTED' as const, productId: productsForQC[0].id, supplierId: suppliersForQC[2].id, batchNo: 'LOT-VN-202601', inspectionDate: new Date('2026-02-10'), sampleSize: 200, passedQty: 195, failedQty: 5, passRate: 97.5, defectRate: 2.5, resultSummary: '允收，少量包裝輕微皺摺', notes: 'AQL 2.5 通過' },
        { qcNo: 'QC-2026-002', inspectionType: 'PRE_SHIPMENT' as const, qcStatus: 'COMPLETED' as const, result: 'CONDITIONAL_ACCEPT' as const, productId: productsForQC[1].id, supplierId: suppliersForQC[2].id, batchNo: 'LOT-VN-202602', inspectionDate: new Date('2026-03-05'), sampleSize: 150, passedQty: 138, failedQty: 12, passRate: 92.0, defectRate: 8.0, resultSummary: '條件允收，腰貼黏性略低', notes: '要求廠商改善腰貼製程' },
        { qcNo: 'QC-2026-003', inspectionType: 'INCOMING' as const, qcStatus: 'COMPLETED' as const, result: 'ACCEPTED' as const, productId: productsForQC[2].id, supplierId: suppliersForQC[2].id, batchNo: 'LOT-VN-202601B', inspectionDate: new Date('2026-02-15'), sampleSize: 100, passedQty: 100, failedQty: 0, passRate: 100, defectRate: 0, resultSummary: '全數合格', notes: '' },
        { qcNo: 'QC-2026-004', inspectionType: 'COMPLAINT_TRACE' as const, qcStatus: 'IN_PROGRESS' as const, productId: productsForQC[3].id, supplierId: suppliersForQC[2].id, batchNo: 'LOT-VN-202603', inspectionDate: new Date('2026-03-20'), sampleSize: 50, resultSummary: '客訴追查中，吸收量不足', notes: '對應 AS-2026-001 客訴案' },
      ]
      for (const qc of qcList) {
        const exists = await prisma.qualityCheck.findFirst({ where: { qcNo: qc.qcNo } })
        if (!exists) await prisma.qualityCheck.create({ data: qc })
      }
      console.log('✅ QualityCheck 建立完成 (4 筆)')
    }
  } catch (e) { console.error('❌ QualityCheck 失敗:', e) }

  // ========== ApprovalTemplate ==========
  try {
    const adminForApproval = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
    if (adminForApproval) {
      const templates = [
        { name: '銷售訂單簽核流程', module: 'ORDER', description: '金額 > 50萬需主管核准', steps: [{ stepOrder: 1, stepName: '業務主管審核', approverRole: 'SALES_MANAGER' }, { stepOrder: 2, stepName: '總經理核准', approverRole: 'GM' }] },
        { name: '採購請購單簽核', module: 'PURCHASE_REQUEST', description: '所有請購單需採購主管確認', steps: [{ stepOrder: 1, stepName: '採購主管確認', approverRole: 'PROCUREMENT' }, { stepOrder: 2, stepName: '財務審核', approverRole: 'FINANCE' }] },
        { name: '內部領用單審批', module: 'INTERNAL_USE', description: '內部領用需主管批准', steps: [{ stepOrder: 1, stepName: '倉管主管審核', approverRole: 'WAREHOUSE_MANAGER' }] },
      ]
      for (const tmpl of templates) {
        const exists = await prisma.approvalTemplate.findFirst({ where: { name: tmpl.name, module: tmpl.module } })
        if (!exists) {
          await prisma.approvalTemplate.create({
            data: {
              name: tmpl.name,
              module: tmpl.module,
              description: tmpl.description,
              createdById: adminForApproval.id,
              steps: { create: tmpl.steps },
            },
          })
        }
      }
      console.log('✅ ApprovalTemplate 建立完成 (3 筆)')
    }
  } catch (e) { console.error('❌ ApprovalTemplate 失敗:', e) }

  // ========== KnowledgeBaseEntry ==========
  try {
    const kbEntries = [
      { entryType: 'PRODUCT_FAQ', title: '成人紙尿布 M號 – 正確穿戴方式', summary: '詳述 M號尿布的正確穿戴步驟，包含腰貼固定位置、鬆緊判斷與常見錯誤。', tags: ['穿戴', 'M號', '照護技巧'], relatedSkus: ['ADL-001'], relatedBatchNos: [], customerTypes: ['NURSING_HOME', 'LONG_TERM_CARE'], symptomCodes: [] },
      { entryType: 'COMPLAINT_SOLUTION', title: '護墊夜用型回潮問題處理SOP', summary: '客訴回潮常見原因分析（更換頻率、穿戴角度、失禁量過大）及標準處理回覆話術。', tags: ['客訴', '回潮', 'PAD-002'], relatedSkus: ['PAD-002'], relatedBatchNos: [], customerTypes: ['NURSING_HOME'], symptomCodes: ['LEAK', 'REWET'] },
      { entryType: 'QC_KNOWLEDGE', title: '腰貼黏性不足 – 批次品質警示', summary: '2026年2月批次（LOT-VN-202602）發現腰貼黏性略低，條件允收。使用建議：確認固定位置，避免二次撕開。', tags: ['QC', '腰貼', '品質警示'], relatedSkus: ['ADL-001', 'ADL-002', 'ADL-003'], relatedBatchNos: ['LOT-VN-202602'], customerTypes: [], symptomCodes: ['ADHESION'] },
      { entryType: 'SALES_SKILL', title: '護理之家採購決策者分析', summary: '護理之家採購通常由護理長 + 採購主任共同決策，院長有否決權。業務攻略：先建立護理長信任，再推動上層決策。', tags: ['銷售技巧', '護理之家', '採購決策'], relatedSkus: [], relatedBatchNos: [], customerTypes: ['NURSING_HOME'], symptomCodes: [] },
      { entryType: 'LOGISTICS_GUIDE', title: '海運進口清關文件檢查清單', summary: '進口時必備文件：商業發票、裝箱單、提單(BL)、原產地證明(CO)、輸入許可證。缺少任一文件將導致通關延誤。', tags: ['清關', '進口', '海運'], relatedSkus: [], relatedBatchNos: [], customerTypes: [], symptomCodes: [] },
      { entryType: 'PRICING_GUIDE', title: '機構客戶報價策略 – 分級定價說明', summary: '依購買量分4級定價：月購 < 50箱為標準價，50-100箱享5%折扣，100-200箱享8%，200箱以上專案報價。', tags: ['報價', '定價', '機構客戶'], relatedSkus: ['ADL-001', 'ADL-002', 'ADL-003', 'PAD-001', 'PAD-002'], relatedBatchNos: [], customerTypes: ['NURSING_HOME', 'HOSPITAL', 'DISTRIBUTOR'], symptomCodes: [] },
    ]
    for (const kb of kbEntries) {
      const exists = await prisma.knowledgeBaseEntry.findFirst({ where: { title: kb.title } })
      if (!exists) await prisma.knowledgeBaseEntry.create({ data: kb })
    }
    console.log('✅ KnowledgeBaseEntry 建立完成 (6 筆)')
  } catch (e) { console.error('❌ KnowledgeBaseEntry 失敗:', e) }

  // ========== ExpenseReport ==========
  try {
    const salesUserExp = await prisma.user.findFirst({ where: { email: 'sales@comfortplus.com' } })
    const adminForExp = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
    if (salesUserExp && adminForExp) {
      const expReports = [
        { reportNo: 'EXP-2026-001', title: '3月業務拜訪交通費用', department: '業務部', status: 'APPROVED', totalAmount: 4850, submittedById: salesUserExp.id, approvedById: adminForExp.id, submittedAt: new Date('2026-03-20'), approvedAt: new Date('2026-03-22'), items: [
          { date: new Date('2026-03-05'), category: 'TRANSPORT', description: '拜訪台中博愛醫院高鐵票', amount: 1490, lineNo: 1 },
          { date: new Date('2026-03-10'), category: 'MEAL', description: '客戶餐敘（3人）', amount: 2160, lineNo: 2 },
          { date: new Date('2026-03-15'), category: 'TRANSPORT', description: '高雄拜訪計程車費', amount: 1200, lineNo: 3 },
        ]},
        { reportNo: 'EXP-2026-002', title: '2月展覽活動費用', department: '業務部', status: 'SUBMITTED', totalAmount: 12500, submittedById: salesUserExp.id, submittedAt: new Date('2026-03-01'), items: [
          { date: new Date('2026-02-20'), category: 'OTHER', description: '醫療展攤位材料費', amount: 8500, lineNo: 1 },
          { date: new Date('2026-02-21'), category: 'TRANSPORT', description: '展場布置運費', amount: 2000, lineNo: 2 },
          { date: new Date('2026-02-22'), category: 'MEAL', description: '展覽期間工作人員餐費', amount: 2000, lineNo: 3 },
        ]},
        { reportNo: 'EXP-2026-003', title: '辦公室文具耗材', department: '管理部', status: 'DRAFT', totalAmount: 3200, submittedById: adminForExp.id, items: [
          { date: new Date('2026-03-15'), category: 'OFFICE', description: 'A4 影印紙 x5箱', amount: 1200, lineNo: 1 },
          { date: new Date('2026-03-15'), category: 'OFFICE', description: '墨水匣、標籤紙', amount: 2000, lineNo: 2 },
        ]},
      ]
      for (const er of expReports) {
        const { items, ...erData } = er
        const exists = await prisma.expenseReport.findFirst({ where: { reportNo: er.reportNo } })
        if (!exists) {
          await prisma.expenseReport.create({
            data: {
              ...erData,
              items: { create: items },
            },
          })
        }
      }
      console.log('✅ ExpenseReport 建立完成 (3 筆)')
    }
  } catch (e) { console.error('❌ ExpenseReport 失敗:', e) }

  // ========== DiscountRule ==========
  try {
    const adminForDiscount = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
    if (adminForDiscount) {
      const discountRules = [
        { name: '大量採購折扣 – 100箱以上8折', ruleType: 'SALES', discountType: 'PERCENTAGE', scope: 'ALL', minQty: 100, discountValue: 8, effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-12-31'), isActive: true, priority: 10, notes: '機構客戶量購優惠', createdById: adminForDiscount.id },
        { name: '新客戶首單優惠', ruleType: 'SALES', discountType: 'FIXED_AMOUNT', scope: 'CUSTOMER_TYPE', scopeValue: 'NEW', minAmount: 5000, discountValue: 500, effectiveFrom: new Date('2026-01-01'), isActive: true, priority: 5, notes: '首單滿5000折500', createdById: adminForDiscount.id },
        { name: '護理之家年度框架合約折扣', ruleType: 'SALES', discountType: 'PERCENTAGE', scope: 'CUSTOMER_TYPE', scopeValue: 'NURSING_HOME', minAmount: 50000, discountValue: 5, effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-12-31'), isActive: true, priority: 8, notes: '有簽年度合約者額外5%', createdById: adminForDiscount.id },
        { name: '採購商回購折扣', ruleType: 'PURCHASE', discountType: 'PERCENTAGE', scope: 'ALL', minQty: 10000, discountValue: 3, effectiveFrom: new Date('2026-01-01'), isActive: true, priority: 3, notes: '向供應商批量採購優惠', createdById: adminForDiscount.id },
      ]
      for (const dr of discountRules) {
        const exists = await prisma.discountRule.findFirst({ where: { name: dr.name } })
        if (!exists) await prisma.discountRule.create({ data: dr })
      }
      console.log('✅ DiscountRule 建立完成 (4 筆)')
    }
  } catch (e) { console.error('❌ DiscountRule 失敗:', e) }

  // ========== RetailBrand + RetailOutlet ==========
  try {
    const retailBrands = [
      { code: 'QUANSHENG', name: '全聯福利中心', brandType: 'SUPERMARKET', buyerName: '採購部李經理', paymentTerms: '月結60天', creditDays: 60, notes: '全台最大連鎖超市' },
      { code: 'WATSONS', name: '屈臣氏', brandType: 'PHARMACY', buyerName: '商品部王採購', paymentTerms: '月結30天', creditDays: 30, notes: '藥妝通路' },
      { code: 'COSTCO', name: '好市多', brandType: 'WAREHOUSE', buyerName: '採購部陳主管', paymentTerms: '月結45天', creditDays: 45, purchaseMode: 'BUYOUT', minOrderQty: 500, notes: '倉儲型量販，最低訂購量高' },
    ]
    const brandIds: Record<string, string> = {}
    for (const brand of retailBrands) {
      const upserted = await prisma.retailBrand.upsert({
        where: { code: brand.code },
        update: {},
        create: brand,
      })
      brandIds[brand.code] = upserted.id
    }
    const salesUserRetail = await prisma.user.findFirst({ where: { email: 'sales@comfortplus.com' } })
    const outlets = [
      { brandId: brandIds['QUANSHENG'], outletCode: 'QS-TAIPEI-001', outletName: '全聯信義區旗艦店', city: '台北市', region: '北部', address: '台北市信義區信義路五段100號', storeManagerName: '林店長', openHours: '07:00-23:00', displayShelfCount: 2, salesRepId: salesUserRetail?.id },
      { brandId: brandIds['QUANSHENG'], outletCode: 'QS-TAICHUNG-001', outletName: '全聯台中文心店', city: '台中市', region: '中部', address: '台中市西屯區文心路二段200號', storeManagerName: '吳店長', openHours: '07:00-22:00', displayShelfCount: 1, salesRepId: salesUserRetail?.id },
      { brandId: brandIds['WATSONS'], outletCode: 'WT-TAIPEI-001', outletName: '屈臣氏台北忠孝店', city: '台北市', region: '北部', address: '台北市大安區忠孝東路四段100號', storeManagerName: '張店長', openHours: '10:00-22:00', maxSkuCount: 5, salesRepId: salesUserRetail?.id },
      { brandId: brandIds['COSTCO'], outletCode: 'CC-TAIPEI-001', outletName: '好市多內湖店', city: '台北市', region: '北部', address: '台北市內湖區舊宗路二段260號', storeManagerName: '周採購', openHours: '10:00-21:30', minOrderQtyPerEvent: 500, salesRepId: salesUserRetail?.id },
    ]
    for (const outlet of outlets) {
      const exists = await prisma.retailOutlet.findFirst({ where: { outletCode: outlet.outletCode } })
      if (!exists) await prisma.retailOutlet.create({ data: outlet })
    }
    console.log('✅ RetailBrand (3) + RetailOutlet (4) 建立完成')
  } catch (e) { console.error('❌ RetailBrand/RetailOutlet 失敗:', e) }

  // ========== Vehicle + DeliveryTrip ==========
  try {
    const v1 = await prisma.vehicle.upsert({
      where: { plateNo: 'AEK-1234' },
      update: {},
      create: {
        plateNo: 'AEK-1234', vehicleType: '3.5噸', brand: 'HINO', model: '300',
        year: 2022, fuelType: 'DIESEL', currentOdometer: 48200,
        insuranceExpiry: new Date('2026-09-30'), inspectionExpiry: new Date('2026-11-15'),
        licenseTaxExpiry: new Date('2026-04-30'), isActive: true, notes: '主力配送車',
      },
    })
    const v2 = await prisma.vehicle.upsert({
      where: { plateNo: 'BFP-5678' },
      update: {},
      create: {
        plateNo: 'BFP-5678', vehicleType: '1噸', brand: 'ISUZU', model: 'D-MAX',
        year: 2020, fuelType: 'DIESEL', currentOdometer: 72100,
        insuranceExpiry: new Date('2026-06-15'), inspectionExpiry: new Date('2025-12-31'),
        isActive: true,
      },
    })
    const wUser = await prisma.user.findFirst({ where: { email: 'warehouse@comfortplus.com' } })
    const trips = [
      { vehicleId: v1.id, vehicleNo: 'AEK-1234', driverName: '陳大明', driverPhone: '0912-345-678', region: '台北北區', tripDate: new Date('2026-03-20'), status: 'COMPLETED', totalFuelCost: 1200, tollFee: 150, driverAllowance: 800, totalTripCost: 2150, actualStops: 5 },
      { vehicleId: v1.id, vehicleNo: 'AEK-1234', driverName: '陳大明', driverPhone: '0912-345-678', region: '台北南區', tripDate: new Date('2026-03-22'), status: 'COMPLETED', totalFuelCost: 1050, tollFee: 200, driverAllowance: 800, totalTripCost: 2050, actualStops: 4 },
      { vehicleId: v2.id, vehicleNo: 'BFP-5678', driverName: '林志明', driverPhone: '0923-456-789', region: '新北市', tripDate: new Date('2026-03-25'), status: 'COMPLETED', totalFuelCost: 900, tollFee: 0, driverAllowance: 700, totalTripCost: 1600, actualStops: 3 },
      { vehicleId: v1.id, vehicleNo: 'AEK-1234', driverName: '陳大明', driverPhone: '0912-345-678', region: '台北北區', tripDate: new Date('2026-03-28'), status: 'PLANNED', actualStops: 6 },
    ]
    for (const trip of trips) {
      const exists = await prisma.deliveryTrip.findFirst({ where: { vehicleNo: trip.vehicleNo, tripDate: trip.tripDate } })
      if (!exists) {
        const no = await import('../src/lib/sequence').then(m => m.generateSequenceNo('TRIP')).catch(() => `TRIP${Date.now()}`)
        await prisma.deliveryTrip.create({ data: { ...trip, tripNo: no, status: trip.status as 'PLANNED' | 'DEPARTED' | 'COMPLETED' | 'CANCELLED' } })
      }
    }
    console.log('✅ Vehicle (2) + DeliveryTrip (4) 建立完成')
  } catch (e) { console.error('❌ Vehicle/DeliveryTrip 失敗:', e) }

  // ========== InventoryLot ==========
  try {
    const products = await prisma.product.findMany({ take: 5, select: { id: true, sku: true } })
    const warehouses = await prisma.warehouse.findMany({ take: 2 })
    const supplier = await prisma.supplier.findFirst()
    if (products.length && warehouses.length) {
      for (let i = 0; i < Math.min(products.length, 4); i++) {
        const prod = products[i]
        const wh = warehouses[i % warehouses.length]
        const mfgDate = new Date(`2026-0${(i + 1)}-01`)
        const expDate = new Date(`2027-0${(i + 1)}-01`)
        const lotNo = `${prod.sku.toUpperCase().slice(0, 8)}-${wh.code}-202601-${String(i + 1).padStart(3, '0')}`
        const exists = await prisma.inventoryLot.findUnique({ where: { lotNo } })
        if (!exists) {
          await prisma.inventoryLot.create({
            data: {
              lotNo,
              productId: prod.id,
              warehouseId: wh.id,
              category: 'FINISHED_GOODS',
              status: 'AVAILABLE',
              quantity: (i + 1) * 200,
              manufactureDate: mfgDate,
              expiryDate: expDate,
              supplierId: supplier?.id || null,
              location: `A-0${i + 1}-01`,
              notes: `批次 ${i + 1}`,
            },
          })
        }
      }
      // one near-expiry lot
      const nearLotNo = `NEAR-EXPIRY-TEST-001`
      const existsNear = await prisma.inventoryLot.findUnique({ where: { lotNo: nearLotNo } })
      if (!existsNear && products[0]) {
        await prisma.inventoryLot.create({
          data: {
            lotNo: nearLotNo,
            productId: products[0].id,
            warehouseId: warehouses[0].id,
            category: 'FINISHED_GOODS',
            status: 'AVAILABLE',
            quantity: 50,
            expiryDate: new Date(Date.now() + 15 * 24 * 3600 * 1000), // 15 days
            isNearExpiry: true,
            location: 'Z-99-01',
            notes: '即將到期測試批號',
          },
        })
      }
      console.log('✅ InventoryLot 建立完成')
    }
  } catch (e) { console.error('❌ InventoryLot 失敗:', e) }

  // ========== DefectiveGoods ==========
  try {
    const product = await prisma.product.findFirst()
    const warehouse = await prisma.warehouse.findFirst()
    const adminDef = await prisma.user.findFirst({ where: { email: 'admin@comfortplus.com' } })
    if (product && warehouse && adminDef) {
      const defectives = [
        { source: 'QC_FAIL', severity: 'MAJOR', quantity: 12, defectType: 'LEAK', description: '底部滲漏，QC驗收不通過', status: 'PENDING' },
        { source: 'CUSTOMER_RETURN', severity: 'MINOR', quantity: 6, defectType: 'PACKAGING', description: '外包裝破損，客戶退回', status: 'PROCESSING' },
        { source: 'WAREHOUSE_DAMAGE', severity: 'MINOR', quantity: 8, description: '搬運過程受潮', status: 'RESOLVED', disposition: 'SCRAP' },
        { source: 'PRODUCTION', severity: 'CRITICAL', quantity: 30, defectType: 'ABSORPTION', description: '吸收力不達標，全批退廠', status: 'RESOLVED', disposition: 'RETURN_SUPPLIER' },
      ]
      for (const d of defectives) {
        const no = `DEFECT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        const exists = await prisma.defectiveGoods.findFirst({ where: { source: d.source, description: d.description } })
        if (!exists) {
          await prisma.defectiveGoods.create({
            data: {
              defectNo: no, source: d.source, severity: d.severity,
              productId: product.id, warehouseId: warehouse.id,
              quantity: d.quantity, defectType: d.defectType ?? null,
              description: d.description, status: d.status,
              disposition: ('disposition' in d ? d.disposition as string : null) ?? null,
              unitCost: 85, totalLoss: 85 * d.quantity,
              createdById: adminDef.id,
            },
          })
        }
      }
      console.log('✅ DefectiveGoods (4) 建立完成')
    }
  } catch (e) { console.error('❌ DefectiveGoods 失敗:', e) }

  // ========== SpecialPrice ==========
  try {
    const customers = await prisma.customer.findMany({ take: 3, select: { id: true } })
    const products2 = await prisma.product.findMany({ take: 3, select: { id: true, sellingPrice: true } })
    if (customers.length && products2.length) {
      for (let i = 0; i < Math.min(customers.length, products2.length); i++) {
        const existing = await prisma.specialPrice.findUnique({
          where: { customerId_productId: { customerId: customers[i].id, productId: products2[i].id } },
        })
        if (!existing) {
          const basePrice = Number(products2[i].sellingPrice ?? 100)
          await prisma.specialPrice.create({
            data: {
              customerId: customers[i].id, productId: products2[i].id,
              price: basePrice * 0.9,
              effectiveDate: new Date('2026-01-01'),
              expiryDate: new Date('2026-12-31'),
              notes: '年度合約特殊價',
            },
          })
        }
      }
      console.log('✅ SpecialPrice 建立完成')
    }
  } catch (e) { console.error('❌ SpecialPrice 失敗:', e) }

  // ========== MeetingRecord ==========
  try {
    const salesUser = await prisma.user.findFirst({ where: { email: 'sales@comfortplus.com' } })
    const customer = await prisma.customer.findFirst()
    if (salesUser && customer) {
      type MeetingType = 'WEEKLY_ADMIN'|'CHANNEL_NEGOTIATION'|'ASSOCIATION_MEETING'|'EXHIBITION_DEBRIEF'|'PROMO_PLANNING'|'SUPPLIER_MEETING'|'INTERNAL'|'OTHER'
      type MeetingStatus = 'SCHEDULED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'
      const meetings: Array<{ title: string; meetingType: MeetingType; location?: string; startTime: Date; endTime?: Date; status: MeetingStatus; summary?: string; nextMeetingDate?: Date }> = [
        { title: '護理之家Q1採購討論', meetingType: 'CHANNEL_NEGOTIATION', location: '台北辦公室', startTime: new Date('2026-03-10T10:00:00'), endTime: new Date('2026-03-10T11:30:00'), status: 'COMPLETED', summary: '客戶確認Q1採購量為3000包，價格維持現行合約', nextMeetingDate: new Date('2026-04-07') },
        { title: '月度業務周會', meetingType: 'WEEKLY_ADMIN', location: '公司會議室A', startTime: new Date('2026-03-17T09:00:00'), endTime: new Date('2026-03-17T10:00:00'), status: 'COMPLETED', summary: 'Q1業績達成85%，重點客戶追蹤3家' },
        { title: '新客戶拜訪—中正長照中心', meetingType: 'INTERNAL', location: '客戶現場', startTime: new Date('2026-03-25T14:00:00'), endTime: new Date('2026-03-25T15:30:00'), status: 'COMPLETED', summary: '首次拜訪，客戶對愛舒樂系列有興趣，需要樣品' },
        { title: 'Q2促銷規劃會議', meetingType: 'PROMO_PLANNING', location: '視訊會議', startTime: new Date('2026-04-02T10:00:00'), endTime: new Date('2026-04-02T11:00:00'), status: 'SCHEDULED' },
      ]
      for (const m of meetings) {
        const exists = await prisma.meetingRecord.findFirst({ where: { title: m.title } })
        if (!exists) {
          const meetingNo = `MR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*9000)+1000)}`
          await prisma.meetingRecord.create({
            data: {
              ...m,
              meetingNo,
              meetingDate: m.startTime ?? new Date(),
              facilitatorId: salesUser.id,
              createdById: salesUser.id,
              customerId: customer.id,
              attendeesJson: [{ userId: salesUser.id, name: salesUser.name, role: salesUser.role }],
            },
          })
        }
      }
      console.log('✅ MeetingRecord (4) 建立完成')
    }
  } catch (e) { console.error('❌ MeetingRecord 失敗:', e) }

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
