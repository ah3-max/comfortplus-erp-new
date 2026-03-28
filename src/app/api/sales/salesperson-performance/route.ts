import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/sales/salesperson-performance
 * Compare salesperson performance vs targets
 * Query: year, month (YYYY-MM), or startDate/endDate
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month') // YYYY-MM
    const startStr = searchParams.get('startDate')
    const endStr = searchParams.get('endDate')

    const now = new Date()
    let start: Date, end: Date

    if (monthParam) {
      const [y, m] = monthParam.split('-').map(Number)
      start = new Date(y, m - 1, 1)
      end = new Date(y, m, 0, 23, 59, 59, 999)
    } else {
      start = startStr ? new Date(startStr) : new Date(now.getFullYear(), now.getMonth(), 1)
      end = endStr ? new Date(endStr) : now
      end.setHours(23, 59, 59, 999)
    }

    // Get all SALES / CS users
    const salesUsers = await prisma.user.findMany({
      where: {
        role: { in: ['SALES', 'CS'] as ('SALES' | 'CS')[] },
        isActive: true,
      },
      select: { id: true, name: true, role: true, email: true },
    })

    // Get orders in period by sales rep
    const orders = await prisma.salesOrder.findMany({
      where: {
        orderDate: { gte: start, lte: end },
        status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
      },
      select: {
        createdById: true,
        totalAmount: true,
        grossProfit: true,
        customerId: true,
        orderDate: true,
      },
    })

    // New customers acquired in period (first order date in range)
    const customerFirstOrders = await prisma.salesOrder.groupBy({
      by: ['customerId'],
      _min: { orderDate: true },
    })
    const newCustomerSet = new Set(
      customerFirstOrders
        .filter(c => c._min.orderDate && c._min.orderDate >= start && c._min.orderDate <= end)
        .map(c => c.customerId)
    )

    // Get meeting records (visits) per user
    const visits = await prisma.meetingRecord.groupBy({
      by: ['facilitatorId'],
      where: {
        meetingDate: { gte: start, lte: end },
        meetingType: { in: ['CHANNEL_NEGOTIATION', 'SUPPLIER_MEETING', 'INTERNAL', 'OTHER'] as never[] },
        status: { not: 'CANCELLED' as never },
      },
      _count: { id: true },
    })
    const visitMap = new Map(visits.map(v => [v.facilitatorId, v._count.id]))

    // Get targets for the month
    const targetMonth = new Date(start.getFullYear(), start.getMonth(), 1)
    const targets = await prisma.salesTarget.findMany({
      where: {
        targetMonth: {
          gte: targetMonth,
          lte: new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0),
        },
        userId: { in: salesUsers.map(u => u.id) },
      },
      select: {
        userId: true,
        revenueTarget: true,
        orderTarget: true,
        visitTarget: true,
        newCustTarget: true,
      },
    })
    const targetMap = new Map(targets.map(t => [t.userId, t]))

    // Aggregate per salesperson
    const byUser = new Map<string, {
      userId: string; revenue: number; grossProfit: number
      orderCount: number; customerSet: Set<string>; newCustomerCount: number
    }>()

    for (const o of orders) {
      const ex = byUser.get(o.createdById)
      const entry = ex ?? { userId: o.createdById, revenue: 0, grossProfit: 0, orderCount: 0, customerSet: new Set(), newCustomerCount: 0 }
      entry.revenue += Number(o.totalAmount)
      entry.grossProfit += Number(o.grossProfit ?? 0)
      entry.orderCount++
      entry.customerSet.add(o.customerId)
      if (newCustomerSet.has(o.customerId)) entry.newCustomerCount++
      byUser.set(o.createdById, entry)
    }

    const data = salesUsers.map(user => {
      const perf = byUser.get(user.id) ?? { revenue: 0, grossProfit: 0, orderCount: 0, customerSet: new Set(), newCustomerCount: 0 }
      const target = targetMap.get(user.id)
      const revenueTarget = Number(target?.revenueTarget ?? 0)
      const achieveRate = revenueTarget > 0 ? Math.round(perf.revenue / revenueTarget * 1000) / 10 : null
      const grossMarginPct = perf.revenue > 0 ? Math.round(perf.grossProfit / perf.revenue * 1000) / 10 : 0
      const visitCount = visitMap.get(user.id) ?? 0

      return {
        userId: user.id,
        name: user.name,
        role: user.role,
        orderCount: perf.orderCount,
        revenue: perf.revenue,
        grossProfit: perf.grossProfit,
        grossMarginPct,
        activeCustomers: perf.customerSet.size,
        newCustomers: perf.newCustomerCount,
        avgOrderValue: perf.orderCount > 0 ? Math.round(perf.revenue / perf.orderCount) : 0,
        visitCount,
        revenueTarget,
        achieveRate,
        orderTarget: target?.orderTarget ?? null,
        visitTarget: target?.visitTarget ?? null,
        newCustTarget: target?.newCustTarget ?? null,
      }
    }).sort((a, b) => b.revenue - a.revenue)

    const summary = {
      totalRevenue: data.reduce((s, d) => s + d.revenue, 0),
      totalOrders: data.reduce((s, d) => s + d.orderCount, 0),
      totalGP: data.reduce((s, d) => s + d.grossProfit, 0),
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    }

    return NextResponse.json({ data, summary })
  } catch (error) {
    return handleApiError(error, 'sales.salesperson-performance.GET')
  }
}
