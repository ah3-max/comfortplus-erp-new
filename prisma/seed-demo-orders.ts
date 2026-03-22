/**
 * seed-demo-orders.ts
 * 建立跨 3 個月的 demo 訂單、報價、跟進記錄
 * 執行: npx tsx prisma/seed-demo-orders.ts
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(10 + Math.floor(Math.random() * 7), Math.floor(Math.random() * 60), 0, 0)
  return d
}

async function main() {
  console.log('🌱 建立 demo 訂單資料...')

  // ── 查找已存在的客戶與商品 ─────────────────────────────────
  const customers = await prisma.customer.findMany({ select: { id: true, name: true, code: true } })
  const products  = await prisma.product.findMany({ select: { id: true, name: true, sellingPrice: true, costPrice: true, unit: true } })
  const admin     = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })
  const sales     = await prisma.user.findFirst({ where: { role: 'SALES' }, select: { id: true } })

  if (!customers.length || !products.length || !admin || !sales) {
    console.error('❌ 請先執行 prisma/seed.ts 建立基礎資料')
    return
  }

  const c = customers
  const p = products

  // ── 訂單 helper ────────────────────────────────────────────
  async function createOrder(opts: {
    customerId: string
    createdById: string
    daysBack: number
    status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED'
    items: { productId: string; qty: number; price: number; cost: number; unit: string }[]
    paidPct?: number
  }) {
    const createdAt = daysAgo(opts.daysBack)
    const total = opts.items.reduce((s, i) => s + i.qty * i.price, 0)
    const paid  = Math.round(total * (opts.paidPct ?? 0))

    const seq = await prisma.sequence.findUnique({ where: { type: 'SALES_ORDER' } })
    const no  = seq ? seq.currentNo + 1 : 1
    await prisma.sequence.update({ where: { type: 'SALES_ORDER' }, data: { currentNo: no } })
    const orderNo = `SO${String(no).padStart(5, '0')}`

    return prisma.salesOrder.create({
      data: {
        orderNo,
        customerId:  opts.customerId,
        createdById: opts.createdById,
        status:      opts.status,
        totalAmount: total,
        paidAmount:  paid,
        createdAt,
        updatedAt:   createdAt,
        items: {
          create: opts.items.map(i => ({
            productId: i.productId,
            quantity:  i.qty,
            unitPrice: i.price,
            discount:  0,
            subtotal:  i.qty * i.price,
          })),
        },
      },
    })
  }

  // ── 報價 helper ────────────────────────────────────────────
  async function createQuotation(opts: {
    customerId: string
    createdById: string
    daysBack: number
    status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
    items: { productId: string; qty: number; price: number }[]
  }) {
    const createdAt = daysAgo(opts.daysBack)
    const total = opts.items.reduce((s, i) => s + i.qty * i.price, 0)

    const seq = await prisma.sequence.findUnique({ where: { type: 'QUOTATION' } })
    const no  = seq ? seq.currentNo + 1 : 1
    await prisma.sequence.update({ where: { type: 'QUOTATION' }, data: { currentNo: no } })
    const quotationNo = `Q${String(no).padStart(5, '0')}`

    return prisma.quotation.create({
      data: {
        quotationNo,
        customerId:   opts.customerId,
        createdById:  opts.createdById,
        status:       opts.status,
        totalAmount:  total,
        validUntil:   new Date(createdAt.getTime() + 30 * 86400_000),
        createdAt,
        updatedAt:    createdAt,
        items: {
          create: opts.items.map(i => ({
            productId: i.productId,
            quantity:  i.qty,
            unitPrice: i.price,
            discount:  0,
            subtotal:  i.qty * i.price,
          })),
        },
      },
    })
  }

  // ── 便利索引 ───────────────────────────────────────────────
  const byCode = (code: string) => c.find(x => x.code === code) ?? c[0]
  const bySku  = (sku: string)  => p.find(x => x.name.includes(sku) || x.name.includes(sku)) ?? p[0]

  const C1 = byCode('C001'), C2 = byCode('C002'), C3 = byCode('C003')
  const C4 = byCode('C004'), C5 = byCode('C005')
  const P1 = p[0], P2 = p[1], P3 = p[2], P4 = p[3], P5 = p[4], P6 = p[5]

  function item(prod: typeof P1, qty: number) {
    return { productId: prod.id, qty, price: Number(prod.sellingPrice), cost: Number(prod.costPrice), unit: prod.unit }
  }

  console.log('📦 建立訂單...')

  // ── 本月訂單 (0-15 天前) ───────────────────────────────────
  await createOrder({ customerId: C1.id, createdById: sales.id, daysBack: 1, status: 'CONFIRMED',  items: [item(P1,20), item(P4,10)], paidPct: 0 })
  await createOrder({ customerId: C3.id, createdById: sales.id, daysBack: 3, status: 'PROCESSING', items: [item(P2,50), item(P3,30)], paidPct: 0.5 })
  await createOrder({ customerId: C2.id, createdById: admin.id, daysBack: 5, status: 'SHIPPED',    items: [item(P1,15), item(P5,40), item(P6,20)], paidPct: 1 })
  await createOrder({ customerId: C4.id, createdById: sales.id, daysBack: 7, status: 'COMPLETED',  items: [item(P2,100), item(P3,80)], paidPct: 1 })
  await createOrder({ customerId: C5.id, createdById: sales.id, daysBack: 9, status: 'DELIVERED',  items: [item(P1,30)], paidPct: 1 })
  await createOrder({ customerId: C1.id, createdById: admin.id, daysBack: 12, status: 'COMPLETED', items: [item(P4,50), item(P5,60)], paidPct: 1 })
  await createOrder({ customerId: C3.id, createdById: sales.id, daysBack: 14, status: 'PENDING',   items: [item(P1,10), item(P2,10)], paidPct: 0 })
  console.log('✅ 本月訂單 7 筆')

  // ── 上月訂單 (30-59 天前) ─────────────────────────────────
  await createOrder({ customerId: C2.id, createdById: sales.id, daysBack: 32, status: 'COMPLETED', items: [item(P1,25), item(P3,20)], paidPct: 1 })
  await createOrder({ customerId: C4.id, createdById: admin.id, daysBack: 35, status: 'COMPLETED', items: [item(P2,80), item(P4,30)], paidPct: 1 })
  await createOrder({ customerId: C1.id, createdById: sales.id, daysBack: 38, status: 'COMPLETED', items: [item(P5,100), item(P6,50)], paidPct: 1 })
  await createOrder({ customerId: C3.id, createdById: sales.id, daysBack: 42, status: 'COMPLETED', items: [item(P1,40), item(P2,40)], paidPct: 1 })
  await createOrder({ customerId: C5.id, createdById: admin.id, daysBack: 50, status: 'COMPLETED', items: [item(P3,20), item(P4,25)], paidPct: 1 })
  console.log('✅ 上月訂單 5 筆')

  // ── 兩個月前 (60-89 天前) ──────────────────────────────────
  await createOrder({ customerId: C1.id, createdById: sales.id, daysBack: 62, status: 'COMPLETED', items: [item(P1,20), item(P2,15)], paidPct: 1 })
  await createOrder({ customerId: C2.id, createdById: sales.id, daysBack: 68, status: 'COMPLETED', items: [item(P4,60), item(P5,40)], paidPct: 1 })
  await createOrder({ customerId: C4.id, createdById: admin.id, daysBack: 75, status: 'COMPLETED', items: [item(P2,120), item(P3,100)], paidPct: 1 })
  console.log('✅ 兩個月前訂單 3 筆')

  // ── 報價單 ─────────────────────────────────────────────────
  console.log('📋 建立報價單...')
  await createQuotation({ customerId: C3.id, createdById: sales.id, daysBack: 2, status: 'SENT',     items: [item(P1,30), item(P2,30)] })
  await createQuotation({ customerId: C5.id, createdById: sales.id, daysBack: 4, status: 'DRAFT',    items: [item(P3,50)] })
  await createQuotation({ customerId: C1.id, createdById: admin.id, daysBack: 8, status: 'ACCEPTED', items: [item(P4,40), item(P5,30)] })
  await createQuotation({ customerId: C2.id, createdById: sales.id, daysBack: 33, status: 'ACCEPTED', items: [item(P1,30)] })
  await createQuotation({ customerId: C4.id, createdById: sales.id, daysBack: 40, status: 'REJECTED', items: [item(P2,50), item(P3,40)] })
  console.log('✅ 報價單 5 筆')

  // ── 一個客訴事件 ───────────────────────────────────────────
  console.log('⚠️  建立客訴事件...')
  try {
    const incSeq = await prisma.sequence.findFirst({ where: { type: 'CARE' } })
    const incNo  = incSeq ? incSeq.currentNo + 1 : 1
    if (incSeq) await prisma.sequence.update({ where: { type: 'CARE' }, data: { currentNo: incNo } })

    await prisma.careIncident.create({
      data: {
        incidentNo:   `CARE${String(incNo).padStart(5, '0')}`,
        customerId:   C1.id,
        reportedById: sales.id,
        incidentType: 'COMPLAINT',
        incidentSource: 'SALES_REP',
        severity:     'MEDIUM',
        incidentDate: daysAgo(3),
        issueSummary: '客戶反映部分批次尿布黏貼膠條黏性不足，使用時容易鬆脫',
        status:       'INVESTIGATING',
      },
    })
    console.log('✅ 客訴事件 1 筆')
  } catch (e) {
    console.log('ℹ️  客訴建立略過:', (e as Error).message.slice(0, 80))
  }

  console.log('\n🎉 Demo 資料建立完成！共建立 15 筆訂單、5 筆報價、1 件客訴')
  console.log('現在重新整理首頁應該可以看到資料了。')
}

main().catch(console.error).finally(() => prisma.$disconnect())
