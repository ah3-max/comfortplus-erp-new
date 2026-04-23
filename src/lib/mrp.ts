import { prisma } from '@/lib/prisma'

// ── Types ────────────────────────────────────────────────────────────────────

export interface MrpSkuResult {
  productId: string
  sku: string
  productName: string
  category: string

  // Demand
  avgMonthlyDemand: number
  demandMonths: number
  forecastNextMonth: number

  // Inventory
  currentStock: number
  availableStock: number
  safetyStock: number
  reservedQty: number

  // In-transit
  inTransitQty: number
  inTransitPoNos: string[]

  // Net requirements
  netRequirement: number
  daysUntilSafetyStock: number
  burndownDate: string | null

  // Supplier & lead time
  supplierId: string | null
  supplierName: string | null
  leadTimeDays: number
  moq: number

  // Suggestion
  suggestedOrderQty: number
  suggestedOrderDate: string | null
  urgency: 'CRITICAL' | 'WARNING' | 'NORMAL' | 'OK'
  urgencyReason: string
}

export interface MrpResult {
  runAt: string
  skus: MrpSkuResult[]
  summary: {
    totalSkus: number
    criticalCount: number
    warningCount: number
    normalCount: number
    okCount: number
  }
}

// ── Demand Forecast ──────────────────────────────────────────────────────────

interface MonthlyDemand {
  period: string
  quantity: number
}

async function getDemandHistory(productId: string, months: number): Promise<MonthlyDemand[]> {
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1)

  // System data: from SalesInvoice items (actual shipments)
  const systemData = await prisma.$queryRaw<Array<{ period: string; qty: number }>>`
    SELECT
      TO_CHAR(si."date", 'YYYY-MM') AS period,
      SUM(sii.quantity)::int AS qty
    FROM "SalesInvoiceItem" sii
    JOIN "SalesInvoice" si ON si.id = sii."salesInvoiceId"
    WHERE sii."productId" = ${productId}
      AND si.status NOT IN ('DRAFT', 'CANCELLED')
      AND si."date" >= ${startDate}
    GROUP BY TO_CHAR(si."date", 'YYYY-MM')
    ORDER BY period
  `

  // Imported data
  const importedData = await prisma.mrpDemandHistory.findMany({
    where: {
      productId,
      source: 'IMPORTED',
      period: { gte: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}` },
    },
    orderBy: { period: 'asc' },
  })

  // Merge: system data takes priority, imported fills gaps
  const systemMap = new Map(systemData.map(d => [d.period, d.qty]))
  const importedMap = new Map(importedData.map(d => [d.period, d.quantity]))

  const result: MonthlyDemand[] = []
  for (let i = months; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const qty = systemMap.get(period) ?? importedMap.get(period) ?? 0
    result.push({ period, quantity: qty })
  }

  return result
}

function weightedMovingAverage(history: MonthlyDemand[]): number {
  const data = history.filter(h => h.quantity > 0)
  if (data.length === 0) return 0

  // Use last 3 months with weights 0.5, 0.3, 0.2
  const recent = data.slice(-3)
  const weights = [0.2, 0.3, 0.5]
  const startIdx = 3 - recent.length

  let weightedSum = 0
  let totalWeight = 0
  for (let i = 0; i < recent.length; i++) {
    const w = weights[startIdx + i]
    weightedSum += recent[i].quantity * w
    totalWeight += w
  }

  return Math.round(weightedSum / totalWeight)
}

// ── In-Transit PO ────────────────────────────────────────────────────────────

interface InTransitInfo {
  qty: number
  poNos: string[]
}

async function getInTransitQty(productId: string): Promise<InTransitInfo> {
  const items = await prisma.purchaseOrderItem.findMany({
    where: {
      productId,
      order: {
        status: { in: ['ORDERED', 'FACTORY_CONFIRMED', 'IN_PRODUCTION', 'PARTIAL'] },
      },
    },
    select: {
      quantity: true,
      receivedQty: true,
      order: { select: { poNo: true } },
    },
  })

  const poNos = [...new Set(items.map(i => i.order.poNo))]
  const qty = items.reduce((sum, i) => sum + (i.quantity - i.receivedQty), 0)
  return { qty: Math.max(0, qty), poNos }
}

// ── Confirmed Orders (not yet shipped) ───────────────────────────────────────

async function getConfirmedOrderQty(productId: string): Promise<number> {
  const result = await prisma.$queryRaw<[{ qty: number }]>`
    SELECT COALESCE(SUM(soi.quantity), 0)::int AS qty
    FROM "SalesOrderItem" soi
    JOIN "SalesOrder" so ON so.id = soi."orderId"
    WHERE soi."productId" = ${productId}
      AND so.status = 'CONFIRMED'
  `
  return result[0]?.qty ?? 0
}

// ── Primary Supplier ─────────────────────────────────────────────────────────

interface SupplierInfo {
  supplierId: string | null
  supplierName: string | null
  leadTimeDays: number
  moq: number
}

async function getPrimarySupplier(productId: string): Promise<SupplierInfo> {
  // Try product-level defaults first
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { leadTimeDays: true, moq: true },
  })

  // Find supplier from recent POs
  const recentPo = await prisma.purchaseOrderItem.findFirst({
    where: { productId },
    orderBy: { order: { purchaseDate: 'desc' } },
    select: {
      order: {
        select: {
          supplierId: true,
          supplier: { select: { name: true, leadTimeDays: true, moq: true } },
        },
      },
    },
  })

  const supplier = recentPo?.order?.supplier
  return {
    supplierId: recentPo?.order?.supplierId ?? null,
    supplierName: supplier?.name ?? null,
    leadTimeDays: product?.leadTimeDays ?? supplier?.leadTimeDays ?? 30,
    moq: product?.moq ?? supplier?.moq ?? 1,
  }
}

// ── Core MRP Calculation ─────────────────────────────────────────────────────

async function calculateSkuMrp(
  productId: string,
  sku: string,
  productName: string,
  category: string,
  inventory: { quantity: number; availableQty: number; safetyStock: number; reservedQty: number },
): Promise<MrpSkuResult> {
  const [history, inTransit, confirmedOrders, supplierInfo] = await Promise.all([
    getDemandHistory(productId, 6),
    getInTransitQty(productId),
    getConfirmedOrderQty(productId),
    getPrimarySupplier(productId),
  ])

  const avgMonthly = weightedMovingAverage(history)
  const demandMonths = history.filter(h => h.quantity > 0).length

  // Forecast = weighted average + confirmed orders not yet shipped
  const forecastNextMonth = avgMonthly + confirmedOrders

  // Net requirement
  const netReq = forecastNextMonth + inventory.safetyStock - inventory.availableQty - inTransit.qty
  const netRequirement = Math.max(0, netReq)

  // Daily burn rate
  const dailyBurn = avgMonthly / 30
  const effectiveStock = inventory.availableQty - inventory.safetyStock

  // Days until safety stock
  let daysUntilSafety: number
  let burndownDate: string | null = null
  if (dailyBurn <= 0) {
    daysUntilSafety = 999
  } else {
    daysUntilSafety = Math.max(0, Math.floor(effectiveStock / dailyBurn))
    const bd = new Date()
    bd.setDate(bd.getDate() + daysUntilSafety)
    burndownDate = bd.toISOString().slice(0, 10)
  }

  // Suggested order qty (round up to MOQ)
  let suggestedOrderQty = 0
  if (netRequirement > 0) {
    suggestedOrderQty = Math.ceil(netRequirement / supplierInfo.moq) * supplierInfo.moq
  }

  // Suggested order date
  let suggestedOrderDate: string | null = null
  if (suggestedOrderQty > 0 && burndownDate) {
    const orderDate = new Date(burndownDate)
    orderDate.setDate(orderDate.getDate() - supplierInfo.leadTimeDays)
    suggestedOrderDate = orderDate.toISOString().slice(0, 10)
  }

  // Urgency
  const today = new Date().toISOString().slice(0, 10)
  let urgency: MrpSkuResult['urgency'] = 'OK'
  let urgencyReason = '庫存充足'

  if (netRequirement <= 0) {
    urgency = 'OK'
    urgencyReason = '庫存充足，無需補貨'
  } else if (suggestedOrderDate && suggestedOrderDate <= today) {
    urgency = 'CRITICAL'
    urgencyReason = `已超過建議下單日（${suggestedOrderDate}），需立即採購`
  } else if (daysUntilSafety <= 14) {
    urgency = 'WARNING'
    urgencyReason = `${daysUntilSafety} 天後將低於安全庫存`
  } else if (netRequirement > 0) {
    urgency = 'NORMAL'
    urgencyReason = `預計 ${daysUntilSafety} 天後需補貨`
  }

  return {
    productId, sku, productName, category,
    avgMonthlyDemand: avgMonthly,
    demandMonths: demandMonths,
    forecastNextMonth,
    currentStock: inventory.quantity,
    availableStock: inventory.availableQty,
    safetyStock: inventory.safetyStock,
    reservedQty: inventory.reservedQty,
    inTransitQty: inTransit.qty,
    inTransitPoNos: inTransit.poNos,
    netRequirement,
    daysUntilSafetyStock: daysUntilSafety,
    burndownDate,
    ...supplierInfo,
    suggestedOrderQty,
    suggestedOrderDate,
    urgency, urgencyReason,
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function runMrp(): Promise<MrpResult> {
  // Get all active products with inventory
  const inventories = await prisma.inventory.findMany({
    where: { category: 'FINISHED_GOODS' },
    select: {
      productId: true,
      quantity: true,
      availableQty: true,
      safetyStock: true,
      reservedQty: true,
      product: { select: { sku: true, name: true, category: true, isActive: true } },
    },
  })

  // Only active products
  const activeInventories = inventories.filter(inv => inv.product.isActive !== false)

  // Run MRP for each SKU (batch in groups of 10 for DB concurrency)
  const results: MrpSkuResult[] = []
  const batchSize = 10
  for (let i = 0; i < activeInventories.length; i += batchSize) {
    const batch = activeInventories.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(inv => calculateSkuMrp(
        inv.productId, inv.product.sku, inv.product.name, inv.product.category,
        { quantity: inv.quantity, availableQty: inv.availableQty, safetyStock: inv.safetyStock, reservedQty: inv.reservedQty },
      ))
    )
    results.push(...batchResults)
  }

  // Sort: CRITICAL first, then WARNING, NORMAL, OK
  const urgencyOrder = { CRITICAL: 0, WARNING: 1, NORMAL: 2, OK: 3 }
  results.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  const summary = {
    totalSkus: results.length,
    criticalCount: results.filter(r => r.urgency === 'CRITICAL').length,
    warningCount: results.filter(r => r.urgency === 'WARNING').length,
    normalCount: results.filter(r => r.urgency === 'NORMAL').length,
    okCount: results.filter(r => r.urgency === 'OK').length,
  }

  return {
    runAt: new Date().toISOString(),
    skus: results,
    summary,
  }
}
