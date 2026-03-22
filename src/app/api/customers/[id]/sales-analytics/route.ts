import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/customers/[id]/sales-analytics
// Auto-computes order rhythm from historical SalesOrders and upserts into CustomerDemandForecast
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: customerId } = await params

  // Fetch last 12 months of completed/shipped orders sorted by date
  const orders = await prisma.salesOrder.findMany({
    where: {
      customerId,
      status: { in: ['COMPLETED', 'SHIPPED', 'SIGNED', 'DELIVERED' as never] },
    },
    orderBy: { orderDate: 'desc' },
    take: 20,
    include: {
      items: { select: { quantity: true, boxQty: true } },
    },
  })

  if (orders.length === 0) {
    return NextResponse.json({ message: 'No order history', analytics: null })
  }

  // ── 平均下單間隔天數 ──────────────────────────────
  let avgDaysBetweenOrders: number | null = null
  if (orders.length >= 2) {
    const diffs: number[] = []
    for (let i = 0; i < orders.length - 1; i++) {
      const d1 = new Date(orders[i].orderDate).getTime()
      const d2 = new Date(orders[i + 1].orderDate).getTime()
      diffs.push(Math.round((d1 - d2) / (1000 * 60 * 60 * 24)))
    }
    avgDaysBetweenOrders = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
  }

  // ── 平均每次下單箱數 ──────────────────────────────
  const orderTotals = orders.map(o => {
    const totalBoxes = o.items.reduce((sum, item) => sum + (item.boxQty ?? 0), 0)
    const totalPacks = o.items.reduce((sum, item) => sum + item.quantity, 0)
    return { boxes: totalBoxes, packs: totalPacks }
  })
  const avgCasesPerOrder = orderTotals.length > 0
    ? orderTotals.reduce((s, o) => s + o.boxes, 0) / orderTotals.length
    : null

  // ── 最近 3 次下單趨勢 ──────────────────────────────
  let last3OrdersTrend: string | null = null
  if (orderTotals.length >= 3) {
    const recent3 = orderTotals.slice(0, 3).map(o => o.packs)
    const diff1 = recent3[0] - recent3[1]  // latest vs prev
    const diff2 = recent3[1] - recent3[2]  // prev vs oldest
    if (diff1 > 0 && diff2 > 0) last3OrdersTrend = 'GROWING'
    else if (diff1 < 0 && diff2 < 0) last3OrdersTrend = 'DECLINING'
    else last3OrdersTrend = 'STABLE'
  }

  // ── 預測下次下單日 ──────────────────────────────
  let predictedNextOrderDate: Date | null = null
  if (avgDaysBetweenOrders !== null && orders.length > 0) {
    const lastOrderDate = new Date(orders[0].orderDate)
    predictedNextOrderDate = new Date(lastOrderDate.getTime() + avgDaysBetweenOrders * 24 * 60 * 60 * 1000)
  }

  const analytics = {
    orderCount:            orders.length,
    avgDaysBetweenOrders,
    avgCasesPerOrder:      avgCasesPerOrder !== null ? Math.round(avgCasesPerOrder * 10) / 10 : null,
    last3OrdersTrend,
    predictedNextOrderDate,
    lastOrderDate:         orders[0]?.orderDate ?? null,
  }

  // Upsert analytics into CustomerDemandForecast
  try {
    await prisma.customerDemandForecast.upsert({
      where:  { customerId },
      create: {
        id: crypto.randomUUID(), customerId,
        avgDaysBetweenOrders,
        avgCasesPerOrder:       avgCasesPerOrder !== null ? avgCasesPerOrder : null,
        last3OrdersTrend,
        predictedNextOrderDate,
        analyticsUpdatedAt:     new Date(),
      },
      update: {
        avgDaysBetweenOrders,
        avgCasesPerOrder:       avgCasesPerOrder !== null ? avgCasesPerOrder : null,
        last3OrdersTrend,
        predictedNextOrderDate,
        analyticsUpdatedAt:     new Date(),
      },
    })
  } catch {
    // Non-critical: return analytics even if upsert fails
  }

  return NextResponse.json({ analytics })
}
