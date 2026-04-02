import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {

  const now = new Date()
  const startOfToday    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0)
  const start12Months   = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  // ── 今日訂單 ──────────────────────────────────────────
  const [todayOrders, todayRevenue] = await Promise.all([
    prisma.salesOrder.count({
      where: { createdAt: { gte: startOfToday }, status: { not: 'CANCELLED' } },
    }),
    prisma.salesOrder.aggregate({
      where: { createdAt: { gte: startOfToday }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
  ])

  // ── 本月營收 / 環比 ───────────────────────────────────
  const [monthRevenueAgg, lastMonthRevenueAgg, monthOrders, lastMonthOrders] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
    prisma.salesOrder.aggregate({
      where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
    prisma.salesOrder.count({ where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } }),
    prisma.salesOrder.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: { not: 'CANCELLED' } } }),
  ])

  const monthRevenue = Number(monthRevenueAgg._sum.totalAmount ?? 0)
  const lastMonthRev = Number(lastMonthRevenueAgg._sum.totalAmount ?? 0)
  const revenueGrowth = lastMonthRev === 0 ? null : Math.round(((monthRevenue - lastMonthRev) / lastMonthRev) * 100)
  const orderGrowth   = lastMonthOrders === 0 ? null : Math.round(((monthOrders - lastMonthOrders) / lastMonthOrders) * 100)

  // ── 本月毛利 ──────────────────────────────────────────
  const monthItems = await prisma.salesOrderItem.findMany({
    where: { order: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } },
    include: { product: { select: { costPrice: true } } },
  })
  const monthGrossProfit = monthItems.reduce((sum, item) => {
    const cost = Number(item.product.costPrice) * item.quantity * (1 - Number(item.discount) / 100)
    return sum + (Number(item.subtotal) - cost)
  }, 0)
  const grossMargin = monthRevenue > 0 ? (monthGrossProfit / monthRevenue) * 100 : 0

  // ── 應收未收 ──────────────────────────────────────────
  const receivableOrders = await prisma.salesOrder.findMany({
    where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
    select: { totalAmount: true, paidAmount: true },
  })
  const totalReceivable = receivableOrders.reduce(
    (sum, o) => sum + Math.max(0, Number(o.totalAmount) - Number(o.paidAmount)), 0
  )
  const receivableCount = receivableOrders.filter(
    (o) => Number(o.totalAmount) > Number(o.paidAmount)
  ).length

  // ── 低庫存 ────────────────────────────────────────────
  const lowStockItems = await prisma.$queryRaw<Array<{
    productId: string; quantity: number; safetyStock: number
    name: string; sku: string; unit: string
  }>>`
    SELECT i."productId", i.quantity, i."safetyStock",
           p.name, p.sku, p.unit
    FROM "Inventory" i
    JOIN "Product" p ON p.id = i."productId"
    WHERE i.quantity <= i."safetyStock" AND i.quantity > 0 AND p."isActive" = true
    ORDER BY (i.quantity::float / NULLIF(i."safetyStock", 0)) ASC
    LIMIT 6
  `

  // ── 缺貨清單（庫存為 0）──────────────────────────────
  const outOfStockItems = await prisma.$queryRaw<Array<{
    productId: string; name: string; sku: string; unit: string; safetyStock: number
  }>>`
    SELECT i."productId", p.name, p.sku, p.unit, i."safetyStock"
    FROM "Inventory" i
    JOIN "Product" p ON p.id = i."productId"
    WHERE i.quantity = 0 AND p."isActive" = true
    ORDER BY p.name ASC
    LIMIT 10
  `

  // ── SKU 銷售排行（本月 Top 8）────────────────────────
  const topSkus = await prisma.salesOrderItem.groupBy({
    by: ['productId'],
    where: { order: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { subtotal: 'desc' } },
    take: 8,
  })
  const skuProducts = await prisma.product.findMany({
    where: { id: { in: topSkus.map((s) => s.productId) } },
    select: { id: true, sku: true, name: true, unit: true },
  })
  const skuMap = Object.fromEntries(skuProducts.map((p) => [p.id, p]))
  const skuRanking = topSkus.map((s) => ({
    product: skuMap[s.productId] ?? null,
    quantity: s._sum.quantity ?? 0,
    revenue: Number(s._sum.subtotal ?? 0),
  }))

  // ── 客戶銷售排行（本月 Top 8）────────────────────────
  const topCustomers = await prisma.salesOrder.groupBy({
    by: ['customerId'],
    where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
    _sum: { totalAmount: true },
    _count: { id: true },
    orderBy: { _sum: { totalAmount: 'desc' } },
    take: 8,
  })
  const topCustomerDetails = await prisma.customer.findMany({
    where: { id: { in: topCustomers.map((c) => c.customerId) } },
    select: { id: true, name: true, code: true, type: true },
  })
  const customerMap = Object.fromEntries(topCustomerDetails.map((c) => [c.id, c]))
  const customerRanking = topCustomers.map((c) => ({
    customer: customerMap[c.customerId] ?? null,
    revenue: Number(c._sum.totalAmount ?? 0),
    orders: c._count.id,
  }))

  // ── 業務排名（本月 Top 5）────────────────────────────
  const salesRankingRaw = await prisma.$queryRaw<Array<{
    userId: string; name: string; revenue: number; orders: bigint
  }>>`
    SELECT so."createdById" AS "userId", u.name,
           SUM(so."totalAmount")::float AS revenue,
           COUNT(so.id) AS orders
    FROM "SalesOrder" so
    JOIN "User" u ON u.id = so."createdById"
    WHERE so."createdAt" >= ${startOfMonth}
      AND so.status != 'CANCELLED'
    GROUP BY so."createdById", u.name
    ORDER BY revenue DESC
    LIMIT 5
  `
  const salesRanking = salesRankingRaw.map((r) => ({
    userId: r.userId,
    name: r.name,
    revenue: Number(r.revenue),
    orders: Number(r.orders),
  }))

  // ── 通路占比（客戶類型）──────────────────────────────
  const channelData = await prisma.salesOrder.findMany({
    where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
    include: { customer: { select: { type: true } } },
  })
  const channelMap: Record<string, number> = {}
  channelData.forEach((o) => {
    const t = o.customer.type
    channelMap[t] = (channelMap[t] ?? 0) + Number(o.totalAmount)
  })
  const channelTotal = Object.values(channelMap).reduce((s, v) => s + v, 0)
  const channelBreakdown = Object.entries(channelMap).map(([type, amount]) => ({
    type, amount,
    pct: channelTotal > 0 ? Math.round((amount / channelTotal) * 100) : 0,
  })).sort((a, b) => b.amount - a.amount)

  // ── 近 12 月營收趨勢 ──────────────────────────────────
  const revenueTrendRaw = await prisma.$queryRaw<Array<{
    month: Date; revenue: number; orders: bigint
  }>>`
    SELECT DATE_TRUNC('month', "createdAt") AS month,
           SUM("totalAmount")::float AS revenue,
           COUNT(id) AS orders
    FROM "SalesOrder"
    WHERE "createdAt" >= ${start12Months}
      AND status != 'CANCELLED'
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY month ASC
  `
  const revenueTrend = revenueTrendRaw.map((r) => ({
    month: new Date(r.month).toISOString().slice(0, 7),
    revenue: Number(r.revenue),
    orders: Number(r.orders),
  }))

  // ── 應付未付（採購單）────────────────────────────────
  const payableOrders = await prisma.purchaseOrder.findMany({
    where: { status: { notIn: ['CANCELLED', 'RECEIVED'] } },
    select: { totalAmount: true, paidAmount: true },
  })
  const totalPayable = payableOrders.reduce(
    (sum, o) => sum + Math.max(0, Number(o.totalAmount) - Number(o.paidAmount)), 0
  )
  const payableCount = payableOrders.filter(
    (o) => Number(o.totalAmount) > Number(o.paidAmount)
  ).length

  // ── 客訴件數（本月）────────────────────────────────────
  const [monthComplaints, monthReturns, totalMonthOrders] = await Promise.all([
    prisma.complaintRecord.count({
      where: { complaintDate: { gte: startOfMonth } },
    }),
    prisma.complaintRecord.count({
      where: { complaintDate: { gte: startOfMonth }, type: 'RETURN' },
    }),
    prisma.salesOrder.count({
      where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
    }),
  ])
  const returnRate = totalMonthOrders > 0 ? Math.round((monthReturns / totalMonthOrders) * 1000) / 10 : 0

  // ── 配送異常 + OEM 生產異常 ────────────────────────────
  const [deliveryAnomalyCount, oemOverdue, oemDelayed] = await Promise.all([
    prisma.shipment.count({
      where: { anomalyStatus: { not: 'NORMAL' }, createdAt: { gte: startOfMonth } },
    }),
    prisma.productionOrder.count({
      where: {
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        productionEndDate: { lt: now },
      },
    }),
    prisma.seaFreight.count({
      where: {
        status: { notIn: ['RECEIVED', 'CANCELLED'] },
        eta: { lt: now },
        actualArrival: null,
      },
    }),
  ])

  // ── 線上通路銷售（本月）────────────────────────────────
  const platformSalesRaw = await prisma.$queryRaw<Array<{
    platform: string; revenue: number; orders: bigint
  }>>`
    SELECT ch."platform", SUM(co."orderAmount")::float AS revenue, COUNT(co.id) AS orders
    FROM "ChannelOrder" co
    JOIN "SalesChannel" ch ON ch.id = co."channelId"
    WHERE co."orderedAt" >= ${startOfMonth} AND co.status != 'CANCELLED'
    GROUP BY ch."platform"
    ORDER BY revenue DESC
  `
  const platformSales = platformSalesRaw.map(p => ({
    platform: p.platform, revenue: Number(p.revenue), orders: Number(p.orders),
  }))

  // ── B2B / B2C(通路) 銷售占比 ──────────────────────────
  const b2bRevenue = monthRevenue
  const b2cRevenue = platformSales.reduce((s, p) => s + p.revenue, 0)
  const totalAllRevenue = b2bRevenue + b2cRevenue
  const salesMix = {
    b2b: { revenue: b2bRevenue, pct: totalAllRevenue > 0 ? Math.round((b2bRevenue / totalAllRevenue) * 100) : 0 },
    b2c: { revenue: b2cRevenue, pct: totalAllRevenue > 0 ? Math.round((b2cRevenue / totalAllRevenue) * 100) : 0 },
  }

  // ── 區域銷售分佈 ──────────────────────────────────────
  const regionRaw = await prisma.$queryRaw<Array<{
    region: string | null; revenue: number; orders: bigint
  }>>`
    SELECT c.region, SUM(so."totalAmount")::float AS revenue, COUNT(so.id) AS orders
    FROM "SalesOrder" so
    JOIN "Customer" c ON c.id = so."customerId"
    WHERE so."createdAt" >= ${startOfMonth} AND so.status != 'CANCELLED'
    GROUP BY c.region
    ORDER BY revenue DESC
  `
  const regionSales = regionRaw.map(r => ({
    region: r.region ?? '未設定', revenue: Number(r.revenue), orders: Number(r.orders),
  }))

  // ── 採購成本趨勢（近 12 月）────────────────────────────
  const purchaseTrendRaw = await prisma.$queryRaw<Array<{
    month: Date; cost: number; count: bigint
  }>>`
    SELECT DATE_TRUNC('month', "createdAt") AS month,
           SUM("totalAmount")::float AS cost, COUNT(id) AS count
    FROM "PurchaseOrder"
    WHERE "createdAt" >= ${start12Months} AND status != 'CANCELLED'
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY month ASC
  `
  const purchaseTrend = purchaseTrendRaw.map(r => ({
    month: new Date(r.month).toISOString().slice(0, 7),
    cost: Number(r.cost), count: Number(r.count),
  }))

  // ── 回購率（本月有下單且歷史也有下過單的客戶比例）──────
  const monthCustomerIds = await prisma.salesOrder.findMany({
    where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
    select: { customerId: true },
    distinct: ['customerId'],
  })
  const uniqueMonthCustomers = monthCustomerIds.length
  let repeatCustomers = 0
  if (uniqueMonthCustomers > 0) {
    const ids = monthCustomerIds.map(c => c.customerId)
    const repeats = await prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: ids },
        createdAt: { lt: startOfMonth },
        status: { not: 'CANCELLED' },
      },
    })
    repeatCustomers = repeats.length
  }
  const repurchaseRate = uniqueMonthCustomers > 0
    ? Math.round((repeatCustomers / uniqueMonthCustomers) * 100) : 0

  // ── 最新訂單 ──────────────────────────────────────────
  const recentOrders = await prisma.salesOrder.findMany({
    take: 8,
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { name: true } } },
  })

  // ── 待處理事項 ────────────────────────────────────────
  const [pendingOrders, preparingShipments, openServiceReqs, pendingTasks] = await Promise.all([
    prisma.salesOrder.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] } } }),
    prisma.shipment.count({ where: { status: { in: ['PREPARING', 'PACKED'] } } }),
    prisma.serviceRequest.count({ where: { status: { in: ['OPEN', 'ASSIGNED'] } } }),
    prisma.salesTask.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
  ])

  return NextResponse.json({
    today: {
      orders: todayOrders,
      revenue: Number(todayRevenue._sum.totalAmount ?? 0),
    },
    month: {
      revenue: monthRevenue,
      revenueGrowth,
      orders: monthOrders,
      orderGrowth,
      grossProfit: Math.round(monthGrossProfit),
      grossMargin: Math.round(grossMargin * 10) / 10,
    },
    receivable: { total: Math.round(totalReceivable), count: receivableCount },
    payable:    { total: Math.round(totalPayable), count: payableCount },
    lowStock:   { count: lowStockItems.length, items: lowStockItems },
    outOfStock: { count: outOfStockItems.length, items: outOfStockItems },
    complaints: { count: monthComplaints, rate: 0 },
    returns:    { count: monthReturns, rate: returnRate },
    deliveryAnomalies: { count: deliveryAnomalyCount },
    oemAnomalies:      { count: oemOverdue + oemDelayed },
    pending: { orders: pendingOrders, shipments: preparingShipments, serviceReqs: openServiceReqs, tasks: pendingTasks },
    skuRanking,
    customerRanking,
    salesRanking,
    channelBreakdown,
    revenueTrend,
    recentOrders,
    salesMix,
    platformSales,
    regionSales,
    purchaseTrend,
    repurchaseRate,
  })
  } catch (error) {
    return handleApiError(error, 'dashboard.GET')
  }
}
