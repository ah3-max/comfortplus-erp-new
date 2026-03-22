import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/inventory/demand-projection?month=2026-03
// Aggregates all customer demand forecasts + actual confirmed orders + inventory levels
// Returns per-category demand projection for the given month (defaults to current month)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get('month') // '2026-03'

  const now = new Date()
  const year  = monthParam ? parseInt(monthParam.split('-')[0]) : now.getFullYear()
  const month = monthParam ? parseInt(monthParam.split('-')[1]) : now.getMonth() + 1
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd   = new Date(year, month, 0, 23, 59, 59)

  // ── 1. Sum demand forecasts across all CLOSED/STABLE customers ────────────────
  const forecasts = await prisma.customerDemandForecast.findMany({
    include: {
      customer: { select: { devStatus: true, isActive: true } },
    },
  })

  // Only include active customers who are actually buying
  const activeForecast = forecasts.filter(f =>
    f.customer.isActive &&
    ['CLOSED', 'STABLE_REPURCHASE', 'TRIAL'].includes(f.customer.devStatus)
  )

  const totalForecast = {
    DIAPER_LARGE: activeForecast.reduce((s, f) => s + (f.monthlyDiaperLargeQty ?? 0), 0),
    DIAPER_SMALL: activeForecast.reduce((s, f) => s + (f.monthlyDiaperSmallQty ?? 0), 0),
    UNDERPAD:     activeForecast.reduce((s, f) => s + (f.monthlyUnderpadsQty ?? 0), 0),
    WIPES:        activeForecast.reduce((s, f) => s + (f.monthlyWipesQty ?? 0), 0),
  }

  // Customer count breakdown
  const forecastingCustomers = activeForecast.length
  const needsForecast = await prisma.customer.count({
    where: {
      isActive: true,
      devStatus: { in: ['CLOSED', 'STABLE_REPURCHASE'] as never[] },
      demandForecast: null,
    },
  })

  // ── 2. Confirmed/pending order quantities for this month by product category ──
  const confirmedOrders = await prisma.salesOrderItem.findMany({
    where: {
      order: {
        orderDate: { gte: monthStart, lte: monthEnd },
        status: { in: ['CONFIRMED', 'ALLOCATING', 'READY_TO_SHIP', 'PARTIAL_SHIPPED', 'SHIPPED'] as never[] },
      },
    },
    include: {
      product: { select: { category: true, size: true } },
    },
  })

  // Map product category + size to demand category
  function toDemandCat(productCategory: string, size: string | null): string {
    const cat = productCategory.toLowerCase()
    if (cat.includes('尿布') || cat.includes('diaper')) {
      const s = (size ?? '').toUpperCase()
      if (['L', 'XL', 'XXL', '2XL', 'LL'].includes(s)) return 'DIAPER_LARGE'
      if (['S', 'M'].includes(s)) return 'DIAPER_SMALL'
      return 'DIAPER_LARGE' // default
    }
    if (cat.includes('看護墊') || cat.includes('underpad') || cat.includes('護墊')) return 'UNDERPAD'
    if (cat.includes('濕紙巾') || cat.includes('wipe')) return 'WIPES'
    return 'OTHER'
  }

  const confirmedQty: Record<string, number> = { DIAPER_LARGE: 0, DIAPER_SMALL: 0, UNDERPAD: 0, WIPES: 0 }
  for (const item of confirmedOrders) {
    const cat = toDemandCat(item.product.category, item.product.size)
    if (cat in confirmedQty) confirmedQty[cat] += item.quantity
  }

  // ── 3. Current inventory levels (all warehouses, FINISHED_GOODS) ─────────────
  const inventories = await prisma.inventory.findMany({
    where: { category: 'FINISHED_GOODS' as never },
    include: { product: { select: { category: true, size: true } } },
  })

  const stockQty:  Record<string, number> = { DIAPER_LARGE: 0, DIAPER_SMALL: 0, UNDERPAD: 0, WIPES: 0 }
  const safetyQty: Record<string, number> = { DIAPER_LARGE: 0, DIAPER_SMALL: 0, UNDERPAD: 0, WIPES: 0 }
  for (const inv of inventories) {
    const cat = toDemandCat(inv.product.category, inv.product.size)
    if (cat in stockQty) {
      stockQty[cat]  += inv.availableQty
      safetyQty[cat] += inv.safetyStock
    }
  }

  // ── 4. Build projection rows ──────────────────────────────────────────────────
  const CATEGORY_LABEL: Record<string, string> = {
    DIAPER_LARGE: '大尿布（L/XL）',
    DIAPER_SMALL: '小尿布（S/M）',
    UNDERPAD:     '看護墊',
    WIPES:        '濕紙巾',
  }

  const rows = (['DIAPER_LARGE', 'DIAPER_SMALL', 'UNDERPAD', 'WIPES'] as const).map(cat => {
    const forecast  = totalForecast[cat]
    const confirmed = confirmedQty[cat]
    const stock     = stockQty[cat]
    const safety    = safetyQty[cat]
    const shortage  = Math.max(0, forecast - stock - confirmed)
    const replenish = shortage > 0 ? shortage + safety : 0
    return {
      category:                   cat,
      categoryLabel:              CATEGORY_LABEL[cat],
      totalForecastQty:           forecast,
      totalConfirmedOrdersQty:    confirmed,
      availableStockQty:          stock,
      safetyStockQty:             safety,
      projectedShortageQty:       shortage,
      suggestedReplenishmentQty:  replenish,
      coverageRatio:              forecast > 0 ? Math.round((stock / forecast) * 100) : null,
    }
  })

  // ── 5. Near-term order list (customers with next order date coming up) ────────
  const upcomingOrders = await prisma.customerDemandForecast.findMany({
    where: {
      OR: [
        { nextExpectedOrderDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
        { predictedNextOrderDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
      ],
    },
    include: {
      customer: {
        select: {
          id: true, name: true, code: true, region: true, devStatus: true,
          salesRep: { select: { name: true } },
        },
      },
    },
    orderBy: { nextExpectedOrderDate: 'asc' },
    take: 20,
  })

  return NextResponse.json({
    projectionMonth: `${year}-${String(month).padStart(2, '0')}`,
    forecastingCustomers,
    needsForecast,
    rows,
    upcomingOrders: upcomingOrders.map(f => ({
      customerId:           f.customer.id,
      customerName:         f.customer.name,
      customerCode:         f.customer.code,
      region:               f.customer.region,
      salesRep:             f.customer.salesRep?.name,
      nextExpectedOrderDate: f.nextExpectedOrderDate,
      predictedNextOrderDate: f.predictedNextOrderDate,
      monthlyTotal:         (f.monthlyDiaperLargeQty ?? 0) + (f.monthlyDiaperSmallQty ?? 0) +
                            (f.monthlyUnderpadsQty ?? 0) + (f.monthlyWipesQty ?? 0),
      confidence:           f.forecastConfidence,
    })),
  })
}
