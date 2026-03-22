import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const periodStr = searchParams.get('period') // e.g. 2026-03
  const now = new Date()
  const year = periodStr ? parseInt(periodStr.split('-')[0]) : now.getFullYear()
  const month = periodStr ? parseInt(periodStr.split('-')[1]) - 1 : now.getMonth()
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 1)
  const prevMonthStart = new Date(year, month - 1, 1)
  const prevMonthEnd = monthStart

  // ── Sales KPIs ──
  const [
    monthOrders,
    monthQuotations,
    monthVisits,
    prevMonthOrders,
    monthNewCustomers,
    monthReturns,
  ] = await Promise.all([
    // This month orders (excl cancelled)
    prisma.salesOrder.aggregate({
      where: { createdAt: { gte: monthStart, lt: monthEnd }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // This month quotations sent/accepted
    prisma.quotation.findMany({
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
      select: { status: true, customerId: true },
    }),
    // This month visits
    prisma.followUpLog.count({
      where: {
        logDate: { gte: monthStart, lt: monthEnd },
        logType: { in: ['FIRST_VISIT', 'SECOND_VISIT', 'THIRD_VISIT'] },
      },
    }),
    // Previous month orders for comparison
    prisma.salesOrder.aggregate({
      where: { createdAt: { gte: prevMonthStart, lt: prevMonthEnd }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // New customers this month
    prisma.customer.count({
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
    }),
    // Returns this month
    prisma.returnOrder.count({
      where: { createdAt: { gte: monthStart, lt: monthEnd }, status: { not: 'REJECTED' } },
    }),
  ])

  // Calculate close rate
  const quotedCustomers = new Set(monthQuotations.map(q => q.customerId)).size
  const acceptedCustomers = new Set(monthQuotations.filter(q => ['ACCEPTED', 'CONVERTED'].includes(q.status)).map(q => q.customerId)).size
  const closeRate = quotedCustomers > 0 ? Math.round((acceptedCustomers / quotedCustomers) * 100) : 0

  // Calculate repurchase rate
  const monthOrderCustomers = await prisma.salesOrder.groupBy({
    by: ['customerId'],
    where: { createdAt: { gte: monthStart, lt: monthEnd }, status: { not: 'CANCELLED' } },
  })
  const customerIds = monthOrderCustomers.map(c => c.customerId)
  let repurchaseRate = 0
  if (customerIds.length > 0) {
    const priorCustomers = await prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, createdAt: { lt: monthStart }, status: { not: 'CANCELLED' } },
    })
    repurchaseRate = Math.round((priorCustomers.length / customerIds.length) * 100)
  }

  const revenue = Number(monthOrders._sum.totalAmount ?? 0)
  const prevRevenue = Number(prevMonthOrders._sum.totalAmount ?? 0)
  const revenueGrowth = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0

  // ── Complaint KPIs ──
  const [monthComplaints, monthShipments, resolvedComplaints] = await Promise.all([
    prisma.careIncident.count({
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.shipment.count({
      where: { createdAt: { gte: monthStart, lt: monthEnd }, status: { not: 'FAILED' } },
    }),
    prisma.careIncident.findMany({
      where: { resolvedAt: { gte: monthStart, lt: monthEnd } },
      select: { createdAt: true, resolvedAt: true },
    }),
  ])

  const complaintRate = monthShipments > 0 ? Math.round((monthComplaints / monthShipments) * 1000) / 10 : 0
  const avgResolutionHrs = resolvedComplaints.length > 0
    ? Math.round(resolvedComplaints.reduce((s, c) => s + (c.resolvedAt!.getTime() - c.createdAt.getTime()) / 3600000, 0) / resolvedComplaints.length)
    : 0

  // ── Finance KPIs ──
  const [arData, arPaidThisMonth] = await Promise.all([
    prisma.accountsReceivable.aggregate({
      where: { status: { not: 'PAID' } },
      _sum: { amount: true, paidAmount: true },
      _count: { id: true },
    }),
    prisma.receiptRecord.aggregate({
      where: { receiptDate: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    }),
  ])

  const arOutstanding = Number(arData._sum.amount ?? 0) - Number(arData._sum.paidAmount ?? 0)
  const overdueAR = await prisma.accountsReceivable.aggregate({
    where: { status: { in: ['DUE', 'PARTIAL_PAID'] }, dueDate: { lt: new Date() } },
    _sum: { amount: true, paidAmount: true },
  })
  const overdueAmount = Number(overdueAR._sum.amount ?? 0) - Number(overdueAR._sum.paidAmount ?? 0)
  const overdueRatio = arOutstanding > 0 ? Math.round((overdueAmount / arOutstanding) * 100) : 0

  // Daily avg revenue for AR turnover
  const daysInMonth = Math.ceil((Math.min(now.getTime(), monthEnd.getTime()) - monthStart.getTime()) / 86400_000) || 1
  const dailyAvgRevenue = revenue / daysInMonth
  const arTurnoverDays = dailyAvgRevenue > 0 ? Math.round(arOutstanding / dailyAvgRevenue) : 0

  // ── Inventory KPIs ──
  const [lowStockCount, nearExpiryCount] = await Promise.all([
    prisma.$queryRaw`SELECT COUNT(*) as count FROM "Inventory" WHERE quantity < "safetyStock" AND "safetyStock" > 0`.then((r: any) => Number(r[0]?.count ?? 0)),
    prisma.inventoryLot.count({
      where: { status: 'AVAILABLE', quantity: { gt: 0 }, expiryDate: { lte: new Date(now.getTime() + 90 * 86400_000), gte: now } },
    }),
  ])

  // ── Delivery KPIs ──
  const deliveredShipments = await prisma.shipment.findMany({
    where: { deliveryDate: { gte: monthStart, lt: monthEnd }, status: 'DELIVERED' },
    select: { expectedDeliveryDate: true, deliveryDate: true },
  })
  const onTimeCount = deliveredShipments.filter(s => s.expectedDeliveryDate && s.deliveryDate && s.deliveryDate <= s.expectedDeliveryDate).length
  const onTimeRate = deliveredShipments.length > 0 ? Math.round((onTimeCount / deliveredShipments.length) * 100) : 100

  return NextResponse.json({
    period: `${year}-${String(month + 1).padStart(2, '0')}`,
    sales: {
      revenue,
      revenueGrowth,
      orderCount: monthOrders._count.id,
      visitCount: monthVisits,
      closeRate,
      repurchaseRate,
      newCustomers: monthNewCustomers,
      returnCount: monthReturns,
      avgOrderValue: monthOrders._count.id > 0 ? Math.round(revenue / monthOrders._count.id) : 0,
    },
    complaints: {
      complaintCount: monthComplaints,
      complaintRate,
      avgResolutionHrs,
    },
    finance: {
      arOutstanding: Math.round(arOutstanding),
      arOverdueAmount: Math.round(overdueAmount),
      overdueRatio,
      arTurnoverDays,
      collectedThisMonth: Math.round(Number(arPaidThisMonth._sum.amount ?? 0)),
    },
    inventory: {
      lowStockSkus: lowStockCount,
      nearExpiryLots: nearExpiryCount,
    },
    delivery: {
      deliveredCount: deliveredShipments.length,
      onTimeRate,
    },
    generatedAt: now.toISOString(),
  })
}
