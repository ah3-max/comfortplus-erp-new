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
import { resolvePrices } from '@/lib/pricing'
import { aiChat } from '@/lib/ai'

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
 * 以中央價格解析器 (src/lib/pricing.ts) 決定成交價。
 * 優先序：SpecialPrice (客戶簽約價) > CustomerPriceLevel+Tier > PriceList > Product.sellingPrice
 */
export async function skillGenerateQuote(params: {
  customerId: string
  productIds?: string[]
  userId: string
}): Promise<SkillResult> {
  const { customerId, productIds, userId } = params

  // 1. Get customer info
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true, name: true, code: true, type: true,
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
      sellingPrice: true, costPrice: true, minSellPrice: true,
    },
  })

  if (products.length === 0) {
    return { success: false, skill: 'generate-quote', title: '產出報價單', message: '找不到有效商品' }
  }

  // 4. Resolve prices via central pricing engine (SpecialPrice > Tier > PriceList > sellingPrice)
  const { prices: resolved, priceLevel } = await resolvePrices(customer.id, products.map(p => p.id))

  // Count pricing sources for summary
  const sourceCount = { SPECIAL: 0, TIER: 0, LIST: 0, DEFAULT: 0 } as Record<string, number>

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
    const r = resolved[p.id]
    let unitPrice = r?.price ?? Number(p.sellingPrice)
    sourceCount[r?.source ?? 'DEFAULT'] = (sourceCount[r?.source ?? 'DEFAULT'] ?? 0) + 1

    // Never go below minSellPrice (safety guard; signed contract price usually honored)
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
      notes: `AI 自動產出 — 簽約價 ${sourceCount.SPECIAL} 項 / 層級價 ${sourceCount.TIER} 項 / 價目表 ${sourceCount.LIST} 項 / 目錄價 ${sourceCount.DEFAULT} 項`,
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

  const levelLabel = priceLevel ? `（價格層級 ${priceLevel}）` : ''
  return {
    success: true,
    skill: 'generate-quote',
    title: '報價單已產出',
    message: [
      `📋 報價單 ${quotationNo}`,
      `👤 客戶：${customer.name}${levelLabel}`,
      `💱 價格來源：簽約價 ${sourceCount.SPECIAL} / 層級價 ${sourceCount.TIER} / 價目表 ${sourceCount.LIST} / 目錄價 ${sourceCount.DEFAULT}`,
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
      id: true, name: true, code: true, devStatus: true, type: true,
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
    `   階段：${c.devStatus ?? '未分類'}｜類型：${c.type}｜訂單：${c._count.salesOrders} 筆`,
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

// ── Skill: 客戶摘要 + AI 建議下一步 ──────────────────────────────────────────

export async function skillSummarizeCustomer(params: {
  customerIdOrSearch: string
}): Promise<SkillResult> {
  const { customerIdOrSearch } = params

  // Try direct id first, else search by name
  let customer = await prisma.customer.findUnique({
    where: { id: customerIdOrSearch },
    select: {
      id: true, name: true, code: true, devStatus: true, type: true,
      paymentTerms: true, creditLimit: true, lastContactDate: true,
      nextFollowUpDate: true, notes: true,
      salesRep: { select: { name: true } },
    },
  }).catch(() => null)

  if (!customer) {
    const found = await prisma.customer.findFirst({
      where: {
        isActive: true,
        OR: [
          { name: { contains: customerIdOrSearch, mode: 'insensitive' } },
          { code: { contains: customerIdOrSearch, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, name: true, code: true, devStatus: true, type: true,
        paymentTerms: true, creditLimit: true, lastContactDate: true,
        nextFollowUpDate: true, notes: true,
        salesRep: { select: { name: true } },
      },
    })
    customer = found
  }

  if (!customer) {
    return { success: false, skill: 'summarize-customer', title: '客戶摘要', message: `找不到客戶「${customerIdOrSearch}」` }
  }

  const [logs, orders, samples, ar] = await Promise.all([
    prisma.followUpLog.findMany({
      where: { customerId: customer.id },
      orderBy: { logDate: 'desc' },
      take: 8,
      select: { logDate: true, logType: true, content: true, result: true },
    }),
    prisma.salesOrder.findMany({
      where: { customerId: customer.id, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { orderNo: true, totalAmount: true, status: true, createdAt: true },
    }),
    prisma.sampleRecord.findMany({
      where: { customerId: customer.id },
      orderBy: { sentDate: 'desc' },
      take: 3,
      select: { sentDate: true, items: true, followUpResult: true },
    }),
    prisma.accountsReceivable.aggregate({
      where: { customerId: customer.id, status: { not: 'PAID' } },
      _sum: { amount: true, paidAmount: true },
      _count: true,
    }),
  ])

  const outstandingAR = Number(ar._sum.amount ?? 0) - Number(ar._sum.paidAmount ?? 0)
  const totalSpent = orders.reduce((s, o) => s + Number(o.totalAmount), 0)

  // Build compact context for LLM
  const ctx = [
    `客戶：${customer.name}（${customer.code}）類型 ${customer.type}｜階段 ${customer.devStatus ?? '未分類'}`,
    `業務：${customer.salesRep?.name ?? '未指派'}`,
    `付款條件：${customer.paymentTerms ?? '未設'}｜信用額度：${customer.creditLimit ? Number(customer.creditLimit).toLocaleString() : '未設'}`,
    `上次聯絡：${customer.lastContactDate ? new Date(customer.lastContactDate).toISOString().slice(0, 10) : '無紀錄'}`,
    `下次追蹤：${customer.nextFollowUpDate ? new Date(customer.nextFollowUpDate).toISOString().slice(0, 10) : '無'}`,
    `未收帳款：${ar._count} 筆｜共 ${outstandingAR.toLocaleString()}`,
    `近 5 張訂單：${orders.length > 0 ? orders.map(o => `${o.orderNo}(${o.status}, ${Number(o.totalAmount).toLocaleString()})`).join('、') : '無'}`,
    `累計訂單金額（近 5 張）：${totalSpent.toLocaleString()}`,
    `近 3 次樣品：${samples.length > 0 ? samples.map(s => `${s.sentDate.toISOString().slice(0,10)} ${s.items}${s.followUpResult ? '/' + s.followUpResult : ''}`).join('、') : '無'}`,
    '',
    `近 8 次追蹤：`,
    ...logs.map(l => `  - [${l.logDate.toISOString().slice(0,10)} ${l.logType}] ${(l.content ?? '').slice(0, 100)}${l.result ? ' → ' + l.result.slice(0, 40) : ''}`),
  ].join('\n')

  const ai = await aiChat({
    messages: [
      { role: 'system', content: `你是業務助手。根據客戶完整資料，產出：
1. 一段 2-3 句的客戶現況摘要
2. 1-2 點明確的下一步建議（含具體動作）

用繁體中文，自然句子，不要編號、不要項目符號。回覆格式：
摘要：<摘要內容>

建議：<建議內容>` },
      { role: 'user', content: ctx },
    ],
    temperature: 0.4,
    maxTokens: 500,
  }).catch(() => null)

  const aiMessage = ai?.content?.trim() ?? '（AI 暫時無法回覆，以下為原始資料）'
  const stats = `📊 訂單 ${orders.length} 筆｜樣品 ${samples.length} 次｜追蹤 ${logs.length} 筆｜未收 ${outstandingAR.toLocaleString()}`

  return {
    success: true,
    skill: 'summarize-customer',
    title: `客戶摘要 — ${customer.name}`,
    message: `${stats}\n\n${aiMessage}`,
    actions: [
      { label: '客戶詳情', href: `/customers/${customer.id}` },
      { label: 'CRM 追蹤', href: `/crm` },
    ],
    data: { customerId: customer.id, outstandingAR, totalSpent },
  }
}

// ── Skill: 催收信草擬 ───────────────────────────────────────────────────────

export async function skillDraftCollectionEmail(params: {
  customerIdOrSearch: string
}): Promise<SkillResult> {
  const { customerIdOrSearch } = params

  let customer = await prisma.customer.findUnique({
    where: { id: customerIdOrSearch },
    select: { id: true, name: true, code: true, contactPerson: true, email: true },
  }).catch(() => null)

  if (!customer) {
    customer = await prisma.customer.findFirst({
      where: {
        isActive: true,
        OR: [
          { name: { contains: customerIdOrSearch, mode: 'insensitive' } },
          { code: { contains: customerIdOrSearch, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, code: true, contactPerson: true, email: true },
    })
  }

  if (!customer) {
    return { success: false, skill: 'draft-collection-email', title: '催收信草擬', message: `找不到客戶「${customerIdOrSearch}」` }
  }

  const ars = await prisma.accountsReceivable.findMany({
    where: { customerId: customer.id, status: { in: ['DUE', 'PARTIAL_PAID'] } },
    select: { invoiceNo: true, invoiceDate: true, dueDate: true, amount: true, paidAmount: true },
    orderBy: { dueDate: 'asc' },
  })

  if (ars.length === 0) {
    return {
      success: true,
      skill: 'draft-collection-email',
      title: '催收信草擬',
      message: `${customer.name} 目前沒有逾期應收帳款，不需要催收。`,
    }
  }

  const now = new Date()
  const totalDue = ars.reduce((s, a) => s + (Number(a.amount) - Number(a.paidAmount)), 0)
  const invoiceList = ars.map(a => {
    const days = a.dueDate ? Math.floor((now.getTime() - new Date(a.dueDate).getTime()) / 86400000) : 0
    return `${a.invoiceNo ?? '-'}（逾期 ${days} 天，未收 ${(Number(a.amount) - Number(a.paidAmount)).toLocaleString()}）`
  }).join('、')

  const ai = await aiChat({
    messages: [
      { role: 'system', content: `你是專業的應收帳款催收信撰寫助手。語氣禮貌但明確，繁體中文，不卑不亢。
輸出格式：
主旨：<主旨>

<正文 — 3-5 段落，包含：稱呼、說明用途、列出逾期明細總額、請求處理、結尾致謝>` },
      { role: 'user', content: `客戶：${customer.name}
聯絡人：${customer.contactPerson ?? '（未知）'}
逾期帳款：${ars.length} 筆，總計 ${totalDue.toLocaleString()} 元
明細：${invoiceList}
今日日期：${now.toISOString().slice(0, 10)}` },
    ],
    temperature: 0.5,
    maxTokens: 700,
  }).catch(() => null)

  const emailDraft = ai?.content?.trim() ?? `（AI 暫時無法回覆）\n客戶 ${customer.name} 有 ${ars.length} 筆逾期共 ${totalDue.toLocaleString()}`

  return {
    success: true,
    skill: 'draft-collection-email',
    title: `催收信草擬 — ${customer.name}`,
    message: emailDraft,
    actions: [
      { label: '客戶詳情', href: `/customers/${customer.id}` },
      ...(customer.email ? [{ label: `寄到 ${customer.email}`, href: `mailto:${customer.email}?subject=${encodeURIComponent('帳款提醒')}&body=${encodeURIComponent(emailDraft)}` }] : []),
    ],
    data: { customerId: customer.id, totalDue, invoiceCount: ars.length },
  }
}

// ── Skill: 自然語言建任務 ────────────────────────────────────────────────────

export async function skillCreateTask(params: {
  text: string
  userId: string
}): Promise<SkillResult> {
  const { text, userId } = params

  // Ask LLM to extract structured intent
  const ai = await aiChat({
    messages: [
      { role: 'system', content: `你是任務解析器。把使用者的自然語言拆為 JSON：
{
  "title": "任務標題（20 字內）",
  "customerSearch": "客戶名（若提及）| null",
  "dueDate": "YYYY-MM-DD（若提及則推算，今天是 ${new Date().toISOString().slice(0,10)}；下週三、明天、7/15 都要轉成日期）| null",
  "priority": "LOW | MEDIUM | HIGH"
}
嚴格只回 JSON，不要 markdown。` },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
    maxTokens: 200,
  }).catch(() => null)

  if (!ai) {
    return { success: false, skill: 'create-task', title: '建立任務', message: 'AI 無法解析，請手動建立' }
  }

  type TaskIntent = { title: string; customerSearch: string | null; dueDate: string | null; priority: string }
  let intent: TaskIntent | null = null
  try {
    const m = ai.content.match(/\{[\s\S]*\}/)
    if (m) intent = JSON.parse(m[0]) as TaskIntent
  } catch { /* fall through */ }

  if (!intent?.title) {
    return { success: false, skill: 'create-task', title: '建立任務', message: `無法從「${text}」抽出任務內容` }
  }

  // Resolve customer if mentioned
  let customerId: string | null = null
  let customerName = ''
  if (intent.customerSearch) {
    const c = await prisma.customer.findFirst({
      where: {
        isActive: true,
        OR: [
          { name: { contains: intent.customerSearch, mode: 'insensitive' } },
          { code: { contains: intent.customerSearch, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    })
    if (c) { customerId = c.id; customerName = c.name }
  }

  const task = await prisma.salesTask.create({
    data: {
      title: intent.title,
      taskType: 'FOLLOW_UP',
      priority: (['LOW', 'MEDIUM', 'HIGH'].includes(intent.priority) ? intent.priority : 'MEDIUM') as never,
      status: 'PENDING',
      dueDate: intent.dueDate ? new Date(intent.dueDate) : null,
      customerId,
      assignedToId: userId,
      createdById: userId,
      notes: `由 AI 從「${text}」建立`,
    },
  })

  return {
    success: true,
    skill: 'create-task',
    title: '任務已建立',
    message: [
      `📋 ${task.title}`,
      customerName ? `👤 客戶：${customerName}` : '',
      task.dueDate ? `📅 期限：${task.dueDate.toISOString().slice(0, 10)}` : '📅 未指定期限',
      `⚡ 優先級：${task.priority}`,
    ].filter(Boolean).join('\n'),
    actions: [
      { label: '查看任務', href: '/tasks' },
      ...(customerId ? [{ label: '客戶詳情', href: `/customers/${customerId}` }] : []),
    ],
    data: { taskId: task.id },
  }
}

// ── Skill: 前 N 名客戶 ───────────────────────────────────────────────────────

export async function skillTopCustomers(params: {
  metric?: 'revenue' | 'orders' | 'overdue'
  limit?: number
}): Promise<SkillResult> {
  const metric = params.metric ?? 'revenue'
  const limit = Math.min(20, Math.max(3, params.limit ?? 5))

  if (metric === 'overdue') {
    const rows = await prisma.$queryRaw<Array<{ customerId: string; name: string; code: string; outstanding: number }>>`
      SELECT ar."customerId", c.name, c.code,
             SUM(ar.amount - ar."paidAmount")::float AS outstanding
      FROM "AccountsReceivable" ar
      JOIN "Customer" c ON c.id = ar."customerId"
      WHERE ar.status <> 'PAID' AND ar.amount > ar."paidAmount"
      GROUP BY ar."customerId", c.name, c.code
      ORDER BY outstanding DESC
      LIMIT ${limit}
    `
    if (rows.length === 0) {
      return { success: true, skill: 'top-customers', title: '逾期客戶排行', message: '目前沒有逾期客戶' }
    }
    const msg = rows.map((r, i) => `${i + 1}. ${r.name}（${r.code}）— 未收 ${Number(r.outstanding).toLocaleString()}`).join('\n')
    return {
      success: true, skill: 'top-customers',
      title: `逾期金額前 ${rows.length} 名`,
      message: msg,
      actions: rows.slice(0, 5).map(r => ({ label: r.name, href: `/customers/${r.customerId}` })),
    }
  }

  if (metric === 'orders') {
    const rows = await prisma.$queryRaw<Array<{ customerId: string; name: string; code: string; orderCount: number }>>`
      SELECT so."customerId", c.name, c.code, COUNT(*)::int AS "orderCount"
      FROM "SalesOrder" so
      JOIN "Customer" c ON c.id = so."customerId"
      WHERE so.status <> 'CANCELLED'
      GROUP BY so."customerId", c.name, c.code
      ORDER BY "orderCount" DESC
      LIMIT ${limit}
    `
    const msg = rows.map((r, i) => `${i + 1}. ${r.name}（${r.code}）— ${r.orderCount} 筆訂單`).join('\n')
    return {
      success: true, skill: 'top-customers',
      title: `訂單數前 ${rows.length} 名`,
      message: msg,
      actions: rows.slice(0, 5).map(r => ({ label: r.name, href: `/customers/${r.customerId}` })),
    }
  }

  // revenue (default)
  const rows = await prisma.$queryRaw<Array<{ customerId: string; name: string; code: string; revenue: number }>>`
    SELECT so."customerId", c.name, c.code, SUM(so."totalAmount")::float AS revenue
    FROM "SalesOrder" so
    JOIN "Customer" c ON c.id = so."customerId"
    WHERE so.status <> 'CANCELLED'
    GROUP BY so."customerId", c.name, c.code
    ORDER BY revenue DESC
    LIMIT ${limit}
  `
  const msg = rows.map((r, i) => `${i + 1}. ${r.name}（${r.code}）— ${Number(r.revenue).toLocaleString()}`).join('\n')
  return {
    success: true, skill: 'top-customers',
    title: `累計營收前 ${rows.length} 名`,
    message: msg,
    actions: rows.slice(0, 5).map(r => ({ label: r.name, href: `/customers/${r.customerId}` })),
  }
}

// ── Skill: Pipeline 健康診斷 ─────────────────────────────────────────────────

export async function skillPipelineHealth(params: { userId: string; isManager?: boolean }): Promise<SkillResult> {
  const { userId, isManager } = params
  const scope = isManager ? {} : { createdById: userId }
  const custScope = isManager ? {} : { salesRepId: userId }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000)
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000)

  const [staleQuotes, uncontactedCustomers, stuckOrders, overdueTasks] = await Promise.all([
    prisma.quotation.count({
      where: { ...scope, status: 'SENT', updatedAt: { lt: sevenDaysAgo } },
    }),
    prisma.customer.count({
      where: {
        ...custScope,
        isActive: true,
        devStatus: { in: ['POTENTIAL', 'CONTACTED', 'VISITED', 'NEGOTIATING'] },
        OR: [
          { lastContactDate: null },
          { lastContactDate: { lt: fourteenDaysAgo } },
        ],
      },
    }),
    prisma.salesOrder.count({
      where: { ...scope, status: 'CONFIRMED', createdAt: { lt: threeDaysAgo } },
    }),
    prisma.salesTask.count({
      where: {
        assignedToId: isManager ? undefined : userId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { lt: now },
      },
    }),
  ])

  const issues = [
    staleQuotes > 0 && `📋 ${staleQuotes} 張已送出但超過 7 天無更新的報價單`,
    uncontactedCustomers > 0 && `🚨 ${uncontactedCustomers} 位開發中客戶超過 14 天未聯絡`,
    stuckOrders > 0 && `🐌 ${stuckOrders} 張訂單已確認超過 3 天卻尚未出貨`,
    overdueTasks > 0 && `⏰ ${overdueTasks} 項待辦任務已逾期`,
  ].filter(Boolean)

  if (issues.length === 0) {
    return { success: true, skill: 'pipeline-health', title: 'Pipeline 健康 ✅', message: '目前沒有明顯阻塞，所有指標正常。' }
  }

  return {
    success: true,
    skill: 'pipeline-health',
    title: `Pipeline 健康診斷（${issues.length} 項警示）`,
    message: issues.join('\n'),
    actions: [
      { label: '報價列表', href: '/quotations?status=SENT' },
      { label: 'CRM 警示', href: '/crm' },
      { label: '我的任務', href: '/tasks' },
    ],
    data: { staleQuotes, uncontactedCustomers, stuckOrders, overdueTasks },
  }
}
