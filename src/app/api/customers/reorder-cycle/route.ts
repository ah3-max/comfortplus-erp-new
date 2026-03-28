import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/customers/reorder-cycle
 * Customer reorder cycle analysis: avg days between orders, last order, next expected order
 * Query: startDate, endDate, minOrders (minimum order count to include)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER', 'SALES'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const startStr = searchParams.get('startDate')
    const endStr = searchParams.get('endDate')
    const minOrders = parseInt(searchParams.get('minOrders') ?? '2')

    const now = new Date()
    const start = startStr ? new Date(startStr) : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const end = endStr ? new Date(endStr) : now
    end.setHours(23, 59, 59, 999)

    // Fetch all confirmed orders in the period
    const orders = await prisma.salesOrder.findMany({
      where: {
        orderDate: { gte: start, lte: end },
        status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
      },
      select: {
        customerId: true,
        orderDate: true,
        totalAmount: true,
        customer: { select: { name: true, shortName: true, type: true } },
      },
      orderBy: { orderDate: 'asc' },
    })

    // Group by customer
    const byCustomer = new Map<string, {
      customerId: string
      name: string
      type: string
      orders: { date: Date; amount: number }[]
    }>()

    for (const o of orders) {
      const ex = byCustomer.get(o.customerId)
      if (ex) {
        ex.orders.push({ date: o.orderDate, amount: Number(o.totalAmount) })
      } else {
        byCustomer.set(o.customerId, {
          customerId: o.customerId,
          name: o.customer.shortName ?? o.customer.name,
          type: String(o.customer.type),
          orders: [{ date: o.orderDate, amount: Number(o.totalAmount) }],
        })
      }
    }

    const data = [...byCustomer.values()]
      .filter(c => c.orders.length >= minOrders)
      .map(c => {
        const sorted = c.orders.sort((a, b) => a.date.getTime() - b.date.getTime())
        const orderCount = sorted.length

        // Compute gaps between consecutive orders
        const gaps: number[] = []
        for (let i = 1; i < sorted.length; i++) {
          gaps.push(Math.round((sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / 86400000))
        }

        const avgCycleDays = gaps.length > 0
          ? Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length)
          : null

        const minCycleDays = gaps.length > 0 ? Math.min(...gaps) : null
        const maxCycleDays = gaps.length > 0 ? Math.max(...gaps) : null

        const lastOrderDate = sorted[sorted.length - 1].date
        const daysSinceLastOrder = Math.round((now.getTime() - lastOrderDate.getTime()) / 86400000)

        // Expected next order date
        const nextExpected = avgCycleDays
          ? new Date(lastOrderDate.getTime() + avgCycleDays * 86400000)
          : null

        // Overdue: if current date > expected date
        const daysOverdue = nextExpected && now > nextExpected
          ? Math.round((now.getTime() - nextExpected.getTime()) / 86400000)
          : 0

        const totalRevenue = sorted.reduce((s, o) => s + o.amount, 0)
        const avgOrderValue = Math.round(totalRevenue / orderCount)

        return {
          customerId: c.customerId,
          name: c.name,
          type: c.type,
          orderCount,
          avgCycleDays,
          minCycleDays,
          maxCycleDays,
          lastOrderDate: lastOrderDate.toISOString().slice(0, 10),
          nextExpectedDate: nextExpected ? nextExpected.toISOString().slice(0, 10) : null,
          daysSinceLastOrder,
          daysOverdue,
          totalRevenue,
          avgOrderValue,
          status: daysOverdue > 14 ? 'OVERDUE' : daysOverdue > 0 ? 'DUE' : 'NORMAL',
        }
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue || b.totalRevenue - a.totalRevenue)

    const summary = {
      total: data.length,
      overdue: data.filter(d => d.status === 'OVERDUE').length,
      due: data.filter(d => d.status === 'DUE').length,
      normal: data.filter(d => d.status === 'NORMAL').length,
    }

    return NextResponse.json({ data, summary })
  } catch (error) {
    return handleApiError(error, 'customers.reorder-cycle.GET')
  }
}
