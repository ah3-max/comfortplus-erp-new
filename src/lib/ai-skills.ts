/**
 * AI Skills — 可執行動作的 AI 指令系統
 *
 * Skills 與純聊天的差異：
 *   聊天 = 問答、分析、建議（只讀）
 *   Skills = 實際在 ERP 中執行動作（建立報價、查詢出貨等）
 *
 * 每個 Skill 定義：
 *   - 觸發關鍵字（用於 AI 意圖識別）
 *   - 所需參數
 *   - 執行邏輯
 *   - 回傳結果（含可操作連結）
 */

import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SkillResult {
  success: boolean
  skill: string
  title: string
  message: string
  /** Actionable links shown as buttons */
  actions?: { label: string; href: string }[]
  /** Data for display */
  data?: unknown
}

// ── Skill: 自動產出報價單 ────────────────────────────────────────────────────

/**
 * Pricing strategy based on customer grade + quotation round
 *
 * Grade A (大客戶):  首次 sellingPrice, 二次 wholesalePrice or -5%
 * Grade B (中客戶):  首次 sellingPrice +3%, 二次 sellingPrice
 * Grade C (小客戶):  首次 sellingPrice +8%, 二次 sellingPrice +3%
 * Grade D (新客戶):  首次 sellingPrice +10%, 二次 sellingPrice +5%
 * No grade:         首次 sellingPrice +5%, 二次 sellingPrice
 */
function getPriceMultiplier(grade: string | null, isFirstQuote: boolean): number {
  if (isFirstQuote) {
    switch (grade) {
      case 'A': return 1.0    // 大客戶直接建議售價
      case 'B': return 1.03   // +3%
      case 'C': return 1.08   // +8%
      case 'D': return 1.10   // +10%
      default:  return 1.05   // 未分級 +5%
    }
  } else {
    // 二次議價 — 更接近底價
    switch (grade) {
      case 'A': return 0.95   // 大客戶再降 5%
      case 'B': return 1.0    // 建議售價
      case 'C': return 1.03   // +3%
      case 'D': return 1.05   // +5%
      default:  return 1.0
    }
  }
}

export async function skillGenerateQuote(params: {
  customerId: string
  productIds?: string[]
  isFirstQuote?: boolean
  userId: string
}): Promise<SkillResult> {
  const { customerId, productIds, isFirstQuote = true, userId } = params

  // 1. Get customer info
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true, name: true, code: true, grade: true, type: true,
      paymentTerms: true,
      // 取得歷史訂單中最常購買的商品
      salesOrders: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          items: { select: { productId: true, quantity: true, unitPrice: true } },
        },
      },
    },
  })

  if (!customer) {
    return { success: false, skill: 'generate-quote', title: '產出報價單', message: '找不到此客戶' }
  }

  // 2. Determine products — use provided list, or customer's frequently purchased items
  let targetProductIds = productIds ?? []

  if (targetProductIds.length === 0) {
    // Extract from recent orders
    const productFrequency: Record<string, { count: number; lastQty: number; lastPrice: number }> = {}
    for (const order of customer.salesOrders) {
      for (const item of order.items) {
        const existing = productFrequency[item.productId]
        if (existing) {
          existing.count++
        } else {
          productFrequency[item.productId] = {
            count: 1,
            lastQty: item.quantity,
            lastPrice: Number(item.unitPrice),
          }
        }
      }
    }
    // Sort by frequency and take top 10
    targetProductIds = Object.entries(productFrequency)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([id]) => id)
  }

  if (targetProductIds.length === 0) {
    return {
      success: false, skill: 'generate-quote', title: '產出報價單',
      message: `${customer.name} 沒有歷史訂單記錄，無法自動產出報價單。請手動選擇商品。`,
      actions: [{ label: '手動新增報價', href: '/quotations?action=new' }],
    }
  }

  // 3. Get product details
  const products = await prisma.product.findMany({
    where: { id: { in: targetProductIds }, isActive: true },
    select: {
      id: true, sku: true, name: true, specification: true, unit: true,
      sellingPrice: true, wholesalePrice: true, channelPrice: true,
      costPrice: true, minSellPrice: true,
    },
  })

  if (products.length === 0) {
    return { success: false, skill: 'generate-quote', title: '產出報價單', message: '找不到有效商品' }
  }

  // 4. Calculate prices based on grade + quote round
  const multiplier = getPriceMultiplier(customer.grade, isFirstQuote)
  const gradeLabel = customer.grade ? `${customer.grade}級` : '未分級'
  const roundLabel = isFirstQuote ? '首次報價' : '二次議價'

  // Get last order quantities for reference
  const lastOrderItems: Record<string, { qty: number; price: number }> = {}
  for (const order of customer.salesOrders) {
    for (const item of order.items) {
      if (!lastOrderItems[item.productId]) {
        lastOrderItems[item.productId] = { qty: item.quantity, price: Number(item.unitPrice) }
      }
    }
  }

  const items = products.map(p => {
    const basePrice = Number(p.sellingPrice)
    let unitPrice = Math.round(basePrice * multiplier)

    // For Grade A second round, use wholesale price if available
    if (customer.grade === 'A' && !isFirstQuote && p.wholesalePrice) {
      unitPrice = Number(p.wholesalePrice)
    }

    // Never go below minSellPrice
    if (p.minSellPrice && unitPrice < Number(p.minSellPrice)) {
      unitPrice = Number(p.minSellPrice)
    }

    const lastOrder = lastOrderItems[p.id]
    const quantity = lastOrder?.qty ?? 1

    return {
      productId: p.id,
      quantity,
      unitPrice,
      discount: 0,
    }
  })

  // 5. Create the quotation
  const quotationNo = await generateSequenceNo('QUOTATION')
  const totalAmount = items.reduce((sum, item) =>
    sum + item.quantity * item.unitPrice * (1 - item.discount / 100), 0
  )

  const productMap = Object.fromEntries(products.map(p => [p.id, p]))

  const quotation = await prisma.quotation.create({
    data: {
      quotationNo,
      customerId: customer.id,
      createdById: userId,
      status: 'DRAFT',
      version: 1,
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      totalAmount,
      currency: 'TWD',
      paymentTerm: customer.paymentTerms || null,
      notes: `AI 自動產出 — ${gradeLabel}客戶${roundLabel}`,
      items: {
        create: items.map(item => {
          const p = productMap[item.productId]!
          const subtotal = item.quantity * item.unitPrice
          const cost = Number(p.costPrice) * item.quantity
          const margin = subtotal - cost
          return {
            productId: item.productId,
            productNameSnap: p.name,
            skuSnap: p.sku,
            specSnap: p.specification || null,
            unit: p.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: 0,
            subtotal,
            costSnap: Number(p.costPrice),
            grossMargin: margin,
            grossMarginRate: subtotal > 0 ? Math.round((margin / subtotal) * 10000) / 100 : null,
            notes: null,
          }
        }),
      },
    },
  })

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

  return {
    success: true,
    skill: 'generate-quote',
    title: '報價單已產出',
    message: [
      `📋 報價單 ${quotationNo}`,
      `👤 客戶：${customer.name}（${gradeLabel}）`,
      `📝 策略：${roundLabel}（價格倍率 ×${multiplier}）`,
      `📦 商品：${products.length} 項`,
      `💰 總金額：${fmt(totalAmount)}`,
      `📅 有效期限：14 天`,
      '',
      '報價單已建立為草稿，請確認後發送給客戶。',
    ].join('\n'),
    actions: [
      { label: '查看報價單', href: `/quotations/${quotation.id}` },
      { label: '所有報價單', href: '/quotations' },
    ],
    data: { quotationId: quotation.id, quotationNo },
  }
}

// ── Skill: 今日出貨查詢 ──────────────────────────────────────────────────────

export async function skillTodayShipments(): Promise<SkillResult> {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [pendingShipments, todayShipments] = await Promise.all([
    prisma.shipment.findMany({
      where: { status: { in: ['PREPARING', 'PACKED'] } },
      select: {
        id: true, shipmentNo: true, status: true, address: true, warehouse: true,
        order: {
          select: {
            orderNo: true,
            customer: { select: { name: true, code: true, address: true } },
          },
        },
        items: {
          select: { quantity: true, product: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.shipment.findMany({
      where: { shipDate: { gte: startOfToday }, status: 'SHIPPED' },
      select: {
        shipmentNo: true,
        order: { select: { customer: { select: { name: true } } } },
      },
    }),
  ])

  if (pendingShipments.length === 0 && todayShipments.length === 0) {
    return {
      success: true, skill: 'today-shipments', title: '今日出貨',
      message: '今天沒有待出貨或已出貨的訂單 👍',
    }
  }

  const lines: string[] = []

  if (pendingShipments.length > 0) {
    lines.push(`📦 待出貨：${pendingShipments.length} 筆\n`)
    pendingShipments.forEach((s, i) => {
      const addr = s.address || s.order.customer.address || '未設定地址'
      const itemsSummary = s.items.map(it => `${it.product.name}×${it.quantity}`).join('、')
      lines.push(`${i + 1}. ${s.shipmentNo} → ${s.order.customer.name}`)
      lines.push(`   📍 ${addr}`)
      lines.push(`   📋 ${itemsSummary}`)
      lines.push('')
    })
  }

  if (todayShipments.length > 0) {
    lines.push(`✅ 今日已出貨：${todayShipments.length} 筆`)
    todayShipments.forEach(s => {
      lines.push(`   ${s.shipmentNo} → ${s.order.customer.name}`)
    })
  }

  return {
    success: true,
    skill: 'today-shipments',
    title: `今日出貨（待處理 ${pendingShipments.length} 筆）`,
    message: lines.join('\n'),
    actions: [
      { label: '出貨管理', href: '/shipments' },
      ...(pendingShipments.length > 0 ? [{ label: '開始出貨', href: '/shipments?status=PREPARING' }] : []),
    ],
    data: { pending: pendingShipments.length, shipped: todayShipments.length },
  }
}

// ── Skill: 庫存盤點摘要 ──────────────────────────────────────────────────────

export async function skillInventoryCheck(): Promise<SkillResult> {
  const [totalItems, outOfStock, lowStock, topValue] = await Promise.all([
    prisma.inventory.aggregate({
      _count: { id: true },
      _sum: { quantity: true },
    }),
    prisma.$queryRaw<Array<{ name: string; sku: string }>>`
      SELECT p.name, p.sku FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId"
      WHERE i.quantity = 0 AND p."isActive" = true
      ORDER BY p.name LIMIT 10
    `,
    prisma.$queryRaw<Array<{ name: string; sku: string; quantity: number; safetyStock: number }>>`
      SELECT p.name, p.sku, i.quantity, i."safetyStock" FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId"
      WHERE i.quantity > 0 AND i.quantity <= i."safetyStock" AND p."isActive" = true
      ORDER BY (i.quantity::float / NULLIF(i."safetyStock", 0)) ASC LIMIT 10
    `,
    prisma.$queryRaw<Array<{ name: string; sku: string; quantity: number; value: number }>>`
      SELECT p.name, p.sku, i.quantity, (i.quantity * p."costPrice")::float AS value
      FROM "Inventory" i JOIN "Product" p ON p.id = i."productId"
      WHERE p."isActive" = true AND i.quantity > 0
      ORDER BY value DESC LIMIT 5
    `,
  ])

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
  const lines: string[] = []

  lines.push(`📊 庫存總覽`)
  lines.push(`   品項：${totalItems._count.id}｜總數量：${Number(totalItems._sum.quantity ?? 0).toLocaleString()}`)
  lines.push('')

  if (outOfStock.length > 0) {
    lines.push(`🔴 缺貨（${outOfStock.length} 項）：`)
    outOfStock.forEach(i => lines.push(`   • ${i.name}（${i.sku}）`))
    lines.push('')
  }

  if (lowStock.length > 0) {
    lines.push(`🟡 低庫存（${lowStock.length} 項）：`)
    lowStock.forEach(i => lines.push(`   • ${i.name}：${i.quantity}/${i.safetyStock}`))
    lines.push('')
  }

  if (topValue.length > 0) {
    lines.push(`💰 庫存金額 Top 5：`)
    topValue.forEach(i => lines.push(`   • ${i.name}：${i.quantity} 件 = ${fmt(i.value)}`))
  }

  return {
    success: true,
    skill: 'inventory-check',
    title: '庫存盤點摘要',
    message: lines.join('\n'),
    actions: [
      { label: '庫存管理', href: '/inventory' },
      ...(outOfStock.length > 0 ? [{ label: '查看缺貨', href: '/inventory?filter=outOfStock' }] : []),
      ...(lowStock.length > 0 ? [{ label: '查看低庫存', href: '/inventory?filter=lowStock' }] : []),
    ],
    data: { total: totalItems._count.id, outOfStock: outOfStock.length, lowStock: lowStock.length },
  }
}

// ── Skill: KPI 目標查詢 ──────────────────────────────────────────────────────

export async function skillKpiStatus(): Promise<SkillResult> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const targets = await prisma.salesTarget.findMany({
    where: { targetMonth: startOfMonth },
    include: { user: { select: { id: true, name: true, role: true } } },
  })

  if (targets.length === 0) {
    return {
      success: true, skill: 'kpi-status', title: 'KPI 目標',
      message: '本月尚未設定任何業務目標。請主管到 KPI 頁面設定。',
      actions: [{ label: '設定目標', href: '/kpi' }],
    }
  }

  const lines: string[] = ['📊 本月業務 KPI 追蹤\n']

  let totalTarget = 0
  let totalActual = 0

  for (const t of targets) {
    const revAgg = await prisma.salesOrder.aggregate({
      where: { createdById: t.userId, createdAt: { gte: startOfMonth, lte: endOfMonth }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    })
    const actual = Number(revAgg._sum.totalAmount ?? 0)
    const target = Number(t.revenueTarget)
    const rate = target > 0 ? Math.round((actual / target) * 1000) / 10 : 0

    totalTarget += target
    totalActual += actual

    const bar = rate >= 100 ? '🟢' : rate >= 70 ? '🔵' : rate >= 40 ? '🟡' : '🔴'
    lines.push(`${bar} ${t.user.name}：${rate}%（${Math.round(actual / 10000)}萬 / ${Math.round(target / 10000)}萬）`)
  }

  const totalRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 1000) / 10 : 0
  lines.push(`\n📈 團隊整體：${totalRate}%`)

  return {
    success: true,
    skill: 'kpi-status',
    title: `KPI 追蹤（團隊 ${totalRate}%）`,
    message: lines.join('\n'),
    actions: [{ label: 'KPI 詳情', href: '/kpi' }],
  }
}

// ── Skill: 客戶搜尋 ──────────────────────────────────────────────────────────

export async function skillFindCustomer(search: string): Promise<SkillResult> {
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, name: true, code: true, grade: true, type: true,
      phone: true, address: true,
      salesRep: { select: { name: true } },
      _count: { select: { salesOrders: true } },
    },
    take: 5,
  })

  if (customers.length === 0) {
    return { success: true, skill: 'find-customer', title: '客戶搜尋', message: `找不到「${search}」相關客戶` }
  }

  const lines = customers.map((c, i) => [
    `${i + 1}. ${c.name}（${c.code}）`,
    `   等級：${c.grade ?? '未分級'}｜類型：${c.type}｜訂單：${c._count.salesOrders} 筆`,
    c.phone ? `   📞 ${c.phone}` : '',
    c.salesRep ? `   👤 業務：${c.salesRep.name}` : '',
  ].filter(Boolean).join('\n'))

  return {
    success: true,
    skill: 'find-customer',
    title: `找到 ${customers.length} 個客戶`,
    message: lines.join('\n\n'),
    actions: customers.map(c => ({ label: c.name, href: `/customers/${c.id}` })),
  }
}
