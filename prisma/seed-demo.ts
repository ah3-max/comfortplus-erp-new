/**
 * Demo Data Seed — 建立完整測試資料
 *
 * 包含：
 *   - 15 客戶（各等級/類型/狀態）
 *   - 30 訂單（各狀態）
 *   - 15 報價（含過期、待審核）
 *   - 10 出貨
 *   - 拜訪/電訪記錄
 *   - KPI 月目標
 *   - 庫存（含低庫存/缺貨）
 *
 * 使用：npx tsx prisma/seed-demo.ts
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function randomDate(daysAgo: number, daysAgoEnd = 0): Date {
  const now = Date.now()
  const start = now - daysAgo * 86400000
  const end = now - daysAgoEnd * 86400000
  return new Date(start + Math.random() * (end - start))
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function main() {
  console.log('🌱 建立 Demo 資料...')

  // Get existing users and products
  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true } })
  const salesUsers = users.filter(u => ['SALES', 'SALES_MANAGER'].includes(u.role))
  const products = await prisma.product.findMany({ select: { id: true, name: true, sku: true, unit: true, sellingPrice: true, costPrice: true } })

  if (salesUsers.length === 0) {
    console.error('❌ 沒有業務帳號，請先執行 npx tsx prisma/seed.ts')
    return
  }
  if (products.length === 0) {
    console.error('❌ 沒有商品，請先執行 npx tsx prisma/seed.ts')
    return
  }

  const managerUser = users.find(u => u.role === 'SALES_MANAGER') ?? salesUsers[0]

  // ═══════════════════════════════════════════════════════
  //  1. 客戶（15 個，各等級/類型）
  // ═══════════════════════════════════════════════════════
  const customerData = [
    { code: 'C0010', name: '陽明護理之家', type: 'NURSING_HOME', grade: 'A', region: 'NORTH_METRO', devStatus: 'STABLE_REPURCHASE' },
    { code: 'C0011', name: '松柏長照中心', type: 'SOCIAL_WELFARE', grade: 'A', region: 'NORTH_METRO', devStatus: 'STABLE_REPURCHASE' },
    { code: 'C0012', name: '慈恩安養中心', type: 'ELDERLY_HOME', grade: 'B', region: 'NORTH_METRO', devStatus: 'CLOSED' },
    { code: 'C0013', name: '仁愛護理之家', type: 'NURSING_HOME', grade: 'B', region: 'TAICHUNG_AREA', devStatus: 'CLOSED' },
    { code: 'C0014', name: '福田養護機構', type: 'ELDERLY_HOME', grade: 'C', region: 'TAINAN_KAOHSIUNG', devStatus: 'NEGOTIATING' },
    { code: 'C0015', name: '康寧居家照護', type: 'HOME_CARE', grade: 'B', region: 'NORTH_METRO', devStatus: 'TRIAL' },
    { code: 'C0016', name: '永康藥局', type: 'PHARMACY_CHANNEL', grade: 'C', region: 'TAINAN_KAOHSIUNG', devStatus: 'POTENTIAL' },
    { code: 'C0017', name: '大安健康用品', type: 'DISTRIBUTOR', grade: 'A', region: 'NORTH_METRO', devStatus: 'STABLE_REPURCHASE' },
    { code: 'C0018', name: '新光醫院附設護理之家', type: 'HOSPITAL', grade: 'A', region: 'NORTH_METRO', devStatus: 'CLOSED' },
    { code: 'C0019', name: '鴻運長照機構', type: 'SOCIAL_WELFARE', grade: 'D', region: 'HSINCHU_MIAOLI', devStatus: 'POTENTIAL' },
    { code: 'C0020', name: '吉祥老人之家', type: 'ELDERLY_HOME', grade: 'C', region: 'YUNLIN_CHIAYI', devStatus: 'NEGOTIATING' },
    { code: 'C0021', name: '北區經銷商（張先生）', type: 'DISTRIBUTOR', grade: 'B', region: 'KEELUNG_YILAN', devStatus: 'CLOSED' },
    { code: 'C0022', name: '和平護理之家', type: 'NURSING_HOME', grade: 'B', region: 'HUALIEN_TAITUNG', devStatus: 'TRIAL' },
    { code: 'C0023', name: '停業測試客戶', type: 'NURSING_HOME', grade: 'D', region: 'OFFSHORE', devStatus: 'CHURNED', isActive: false },
    { code: 'C0024', name: '樂齡居家服務', type: 'HOME_CARE', grade: 'C', region: 'NORTH_METRO', devStatus: 'POTENTIAL' },
  ]

  const customers: { id: string; name: string; grade: string | null }[] = []
  for (const c of customerData) {
    const rep = pick(salesUsers)
    const created = await prisma.customer.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        name: c.name,
        type: c.type as never,
        grade: (c.grade as never) ?? null,
        region: c.region as never,
        devStatus: c.devStatus as never,
        isActive: (c as { isActive?: boolean }).isActive ?? true,
        salesRepId: rep.id,
        contactPerson: `${c.name.slice(0, 2)}先生`,
        phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        address: `${c.name.includes('台') ? '台北市' : c.name.includes('高') ? '高雄市' : '新北市'}某某路${Math.floor(1 + Math.random() * 200)}號`,
        creditLimit: pick([100000, 200000, 500000, null]),
        lastContactDate: randomDate(30),
      },
      select: { id: true, name: true, grade: true },
    })
    customers.push(created)
  }
  console.log(`✅ ${customers.length} 個客戶`)

  // ═══════════════════════════════════════════════════════
  //  2. 庫存調整（含低庫存/缺貨）
  // ═══════════════════════════════════════════════════════
  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    const qty = i === 0 ? 0 : i === 1 ? 3 : Math.floor(50 + Math.random() * 200)
    const safety = i < 3 ? 10 : 20
    await prisma.inventory.upsert({
      where: { productId_warehouse_category: { productId: p.id, warehouse: 'MAIN', category: 'FINISHED_GOODS' } },
      update: { quantity: qty, availableQty: qty, safetyStock: safety },
      create: { productId: p.id, warehouse: 'MAIN', category: 'FINISHED_GOODS', quantity: qty, availableQty: qty, safetyStock: safety },
    })
    // Marketing warehouse
    await prisma.inventory.upsert({
      where: { productId_warehouse_category: { productId: p.id, warehouse: 'MARKETING', category: 'FINISHED_GOODS' } },
      update: { quantity: Math.floor(qty * 0.2), availableQty: Math.floor(qty * 0.2), safetyStock: 5 },
      create: { productId: p.id, warehouse: 'MARKETING', category: 'FINISHED_GOODS', quantity: Math.floor(qty * 0.2), availableQty: Math.floor(qty * 0.2), safetyStock: 5 },
    })
  }
  console.log('✅ 庫存更新（含缺貨 + 低庫存）')

  // ═══════════════════════════════════════════════════════
  //  3. 報價單（15 筆）
  // ═══════════════════════════════════════════════════════
  const quoteStatuses: string[] = ['DRAFT', 'SENT', 'SENT', 'APPROVED', 'CONVERTED', 'EXPIRED', 'REJECTED']
  let seqQ = await prisma.sequence.update({ where: { type: 'QUOTATION' }, data: { currentNo: { increment: 0 } } })

  for (let i = 0; i < 15; i++) {
    seqQ = await prisma.sequence.update({ where: { type: 'QUOTATION' }, data: { currentNo: { increment: 1 } } })
    const no = `Q${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(seqQ.currentNo).padStart(4, '0')}`
    const cust = pick(customers.filter(c => c.name !== '停業測試客戶'))
    const rep = pick(salesUsers)
    const itemCount = Math.floor(1 + Math.random() * 4)
    const selectedProducts = products.slice(0, itemCount)
    const items = selectedProducts.map(p => {
      const qty = Math.floor(5 + Math.random() * 50)
      const price = Number(p.sellingPrice) * (0.9 + Math.random() * 0.2)
      return { productId: p.id, quantity: qty, unitPrice: Math.round(price), discount: 0, subtotal: Math.round(qty * price) }
    })
    const total = items.reduce((s, it) => s + it.subtotal, 0)
    const status = pick(quoteStatuses)
    const created = randomDate(60)
    const validUntil = status === 'EXPIRED' ? randomDate(10, 1) : new Date(Date.now() + (Math.random() > 0.5 ? 14 : 2) * 86400000)

    await prisma.quotation.create({
      data: {
        quotationNo: no,
        customerId: cust.id,
        createdById: rep.id,
        status: status as never,
        version: 1,
        totalAmount: total,
        currency: 'TWD',
        validUntil,
        notes: i === 0 ? 'AI 自動產出測試' : null,
        createdAt: created,
        items: { create: items.map(it => ({ ...it, productNameSnap: selectedProducts.find(p => p.id === it.productId)?.name ?? '', skuSnap: selectedProducts.find(p => p.id === it.productId)?.sku ?? '' })) },
      },
    })
  }
  console.log('✅ 15 筆報價單')

  // ═══════════════════════════════════════════════════════
  //  4. 訂單（30 筆，各種狀態）
  // ═══════════════════════════════════════════════════════
  const orderStatuses: string[] = ['PENDING', 'PENDING', 'CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'ALLOCATING', 'READY_TO_SHIP', 'SHIPPED', 'SHIPPED', 'SIGNED', 'COMPLETED', 'COMPLETED', 'CANCELLED']
  let seqO = await prisma.sequence.update({ where: { type: 'SALES_ORDER' }, data: { currentNo: { increment: 0 } } })

  for (let i = 0; i < 30; i++) {
    seqO = await prisma.sequence.update({ where: { type: 'SALES_ORDER' }, data: { currentNo: { increment: 1 } } })
    const no = `SO${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(seqO.currentNo).padStart(4, '0')}`
    const cust = pick(customers.filter(c => c.name !== '停業測試客戶'))
    const rep = pick(salesUsers)
    const itemCount = Math.floor(1 + Math.random() * 3)
    const selectedProducts = products.sort(() => Math.random() - 0.5).slice(0, itemCount)
    const items = selectedProducts.map(p => {
      const qty = Math.floor(5 + Math.random() * 30)
      const price = Number(p.sellingPrice)
      return { productId: p.id, quantity: qty, unitPrice: price, discount: 0, subtotal: qty * price }
    })
    const total = items.reduce((s, it) => s + it.subtotal, 0)
    const status = pick(orderStatuses)
    const created = randomDate(90)
    const paid = status === 'COMPLETED' ? total : status === 'CANCELLED' ? 0 : Math.random() > 0.6 ? total * 0.5 : 0

    await prisma.salesOrder.create({
      data: {
        orderNo: no,
        customerId: cust.id,
        createdById: rep.id,
        status: status as never,
        orderType: 'B2B',
        orderSource: 'SALES_INPUT',
        currency: 'TWD',
        subtotal: total,
        totalAmount: total,
        paidAmount: paid,
        createdAt: created,
        items: { create: items },
      },
    })
  }
  console.log('✅ 30 筆訂單')

  // ═══════════════════════════════════════════════════════
  //  5. 出貨（10 筆）
  // ═══════════════════════════════════════════════════════
  const shippedOrders = await prisma.salesOrder.findMany({
    where: { status: { in: ['SHIPPED', 'SIGNED', 'COMPLETED'] } },
    include: { items: true },
    take: 10,
  })
  let seqS = await prisma.sequence.update({ where: { type: 'SHIPMENT' }, data: { currentNo: { increment: 0 } } })

  for (const order of shippedOrders) {
    seqS = await prisma.sequence.update({ where: { type: 'SHIPMENT' }, data: { currentNo: { increment: 1 } } })
    const no = `SH${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(seqS.currentNo).padStart(4, '0')}`
    const shipStatus = order.status === 'COMPLETED' ? 'DELIVERED' : order.status === 'SIGNED' ? 'DELIVERED' : 'SHIPPED'

    await prisma.shipment.create({
      data: {
        shipmentNo: no,
        orderId: order.id,
        createdById: order.createdById,
        status: shipStatus as never,
        deliveryMethod: pick(['EXPRESS', 'OWN_FLEET', 'FREIGHT'] as const) as never,
        warehouse: 'MAIN',
        shipDate: randomDate(30),
        deliveryDate: shipStatus === 'DELIVERED' ? randomDate(7) : null,
        items: {
          create: order.items.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        },
      },
    })
  }
  console.log(`✅ ${shippedOrders.length} 筆出貨`)

  // ═══════════════════════════════════════════════════════
  //  6. 拜訪 + 電訪記錄
  // ═══════════════════════════════════════════════════════
  const activeCustomers = customers.filter(c => c.name !== '停業測試客戶')
  for (let i = 0; i < 20; i++) {
    const rep = pick(salesUsers)
    const cust = pick(activeCustomers)
    await prisma.visitRecord.create({
      data: {
        customerId: cust.id,
        visitedById: rep.id,
        visitDate: randomDate(60),
        purpose: pick(['初訪', '複訪', '送貨', '教育訓練']),
        content: `拜訪${cust.name}，了解需求狀況`,
      },
    })
  }
  for (let i = 0; i < 15; i++) {
    const rep = pick(salesUsers)
    const cust = pick(activeCustomers)
    await prisma.callRecord.create({
      data: {
        customerId: cust.id,
        calledById: rep.id,
        callDate: randomDate(30),
        duration: Math.floor(3 + Math.random() * 20),
        purpose: pick(['追蹤訂單', '報價跟進', '新品推薦', '帳款催收']),
        content: `電話聯繫${cust.name}`,
      },
    })
  }
  console.log('✅ 20 筆拜訪 + 15 筆電訪')

  // ═══════════════════════════════════════════════════════
  //  7. KPI 月目標
  // ═══════════════════════════════════════════════════════
  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  for (const rep of salesUsers) {
    await prisma.salesTarget.upsert({
      where: { userId_targetMonth: { userId: rep.id, targetMonth: thisMonth } },
      update: {},
      create: {
        userId: rep.id,
        targetMonth: thisMonth,
        revenueTarget: pick([200000, 300000, 500000, 800000]),
        orderTarget: pick([10, 15, 20, 30]),
        visitTarget: pick([8, 12, 15, 20]),
        newCustTarget: pick([1, 2, 3, 5]),
      },
    })
  }
  console.log('✅ KPI 月目標設定')

  // ═══════════════════════════════════════════════════════
  //  8. 更新客戶 lastOrderDate
  // ═══════════════════════════════════════════════════════
  const ordersByCustomer = await prisma.salesOrder.groupBy({
    by: ['customerId'],
    _max: { createdAt: true },
  })
  for (const o of ordersByCustomer) {
    if (o._max.createdAt) {
      await prisma.customer.update({
        where: { id: o.customerId },
        data: { lastOrderDate: o._max.createdAt, lastContactDate: o._max.createdAt },
      })
    }
  }

  console.log('')
  console.log('🎉 Demo 資料建立完成！')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`客戶：${customers.length} 個`)
  console.log('報價：15 筆')
  console.log('訂單：30 筆')
  console.log(`出貨：${shippedOrders.length} 筆`)
  console.log('拜訪：20 筆')
  console.log('電訪：15 筆')
  console.log('KPI：已設定')
  console.log('庫存：含缺貨 + 低庫存')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
