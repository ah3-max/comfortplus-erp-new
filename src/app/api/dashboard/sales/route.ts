import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [
    visits, calls, quotes, closedOrders,
    lastMonthRevAgg, lastMonthOrderCount,
    todayOrders, todayRevAgg,
    pendingTasks, todayVisits, expiringQuotes,
    pendingShipmentOrders,
  ] = await Promise.all([
    // 本月拜訪數
    prisma.visitRecord.count({
      where: { visitedById: userId, visitDate: { gte: startOfMonth } },
    }),
    // 本月電訪數
    prisma.callRecord.count({
      where: { calledById: userId, callDate: { gte: startOfMonth } },
    }),
    // 本月報價數
    prisma.quotation.count({
      where: { createdById: userId, createdAt: { gte: startOfMonth } },
    }),
    // 本月成交訂單
    prisma.salesOrder.findMany({
      where: { createdById: userId, createdAt: { gte: startOfMonth }, status: { notIn: ['CANCELLED', 'DRAFT'] } },
      select: { totalAmount: true, customerId: true },
    }),
    // 上月營收
    prisma.salesOrder.aggregate({
      where: { createdById: userId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
    // 上月訂單數
    prisma.salesOrder.count({
      where: { createdById: userId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: { not: 'CANCELLED' } },
    }),
    // 今日訂單
    prisma.salesOrder.count({
      where: { createdById: userId, createdAt: { gte: startOfToday }, status: { not: 'CANCELLED' } },
    }),
    // 今日營收
    prisma.salesOrder.aggregate({
      where: { createdById: userId, createdAt: { gte: startOfToday }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
    // 待辦任務
    prisma.salesTask.count({
      where: { assignedToId: userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    }),
    // 今日拜訪
    prisma.visitRecord.count({
      where: { visitedById: userId, visitDate: { gte: startOfToday } },
    }),
    // 即將到期報價
    prisma.quotation.count({
      where: {
        createdById: userId,
        status: { in: ['SENT', 'DRAFT'] },
        validUntil: { gte: now, lte: sevenDaysLater },
      },
    }),
    // 待出貨訂單
    prisma.salesOrder.count({
      where: { createdById: userId, status: { in: ['CONFIRMED', 'ALLOCATING', 'READY_TO_SHIP'] } },
    }),
  ])

  const monthRevenue = closedOrders.reduce((s, o) => s + Number(o.totalAmount), 0)
  const lastMonthRev = Number(lastMonthRevAgg._sum.totalAmount ?? 0)
  const revenueGrowth = lastMonthRev === 0 ? null : Math.round(((monthRevenue - lastMonthRev) / lastMonthRev) * 100)

  // ── 我的客戶（依最近互動排序）───────────────────────────
  const myCustomers = await prisma.customer.findMany({
    where: { salesRepId: userId, isActive: true },
    select: {
      id: true, name: true, code: true, type: true,
      lastContactDate: true,
      _count: { select: { salesOrders: { where: { status: { not: 'CANCELLED' } } } } },
    },
    orderBy: { lastContactDate: 'desc' },
    take: 10,
  })

  // ── 我的待處理報價 ──────────────────────────────────────
  const myQuotations = await prisma.quotation.findMany({
    where: {
      createdById: userId,
      status: { in: ['SENT', 'DRAFT'] },
    },
    select: {
      id: true, quotationNo: true, status: true, totalAmount: true,
      validUntil: true, createdAt: true,
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  })

  // ── 我的近期訂單 ────────────────────────────────────────
  const myRecentOrders = await prisma.salesOrder.findMany({
    where: { createdById: userId },
    select: {
      id: true, orderNo: true, status: true, totalAmount: true, createdAt: true,
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  })

  // ── 我的本月 SKU 排行 ──────────────────────────────────
  const myTopSkus = await prisma.salesOrderItem.groupBy({
    by: ['productId'],
    where: { order: { createdById: userId, createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { subtotal: 'desc' } },
    take: 5,
  })
  const skuProducts = await prisma.product.findMany({
    where: { id: { in: myTopSkus.map(s => s.productId) } },
    select: { id: true, name: true, sku: true, unit: true },
  })
  const skuMap = Object.fromEntries(skuProducts.map(p => [p.id, p]))
  const mySkuRanking = myTopSkus.map(s => ({
    product: skuMap[s.productId] ?? null,
    quantity: s._sum.quantity ?? 0,
    revenue: Number(s._sum.subtotal ?? 0),
  }))

  return NextResponse.json({
    today: {
      orders: todayOrders,
      revenue: Number(todayRevAgg._sum.totalAmount ?? 0),
      visits: todayVisits,
    },
    month: {
      revenue: monthRevenue,
      revenueGrowth,
      orders: closedOrders.length,
      lastMonthOrders: lastMonthOrderCount,
    },
    activity: {
      monthVisits: visits,
      monthCalls: calls,
      monthQuotes: quotes,
    },
    myCustomers,
    myQuotations,
    myRecentOrders,
    pendingTasks,
    expiringQuotes,
    pendingShipmentOrders,
    mySkuRanking,
  })
  } catch (error) {
    return handleApiError(error, 'dashboard.sales.GET')
  }
}
