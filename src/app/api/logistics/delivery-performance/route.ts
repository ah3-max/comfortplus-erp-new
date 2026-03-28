import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/logistics/delivery-performance
 * Delivery on-time rate analysis
 * Query: view=monthly|provider|customer, startDate, endDate
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER', 'WAREHOUSE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') ?? 'monthly'
    const startStr = searchParams.get('startDate')
    const endStr = searchParams.get('endDate')

    const now = new Date()
    const start = startStr ? new Date(startStr) : new Date(now.getFullYear(), 0, 1)
    const end = endStr ? new Date(endStr) : now
    end.setHours(23, 59, 59, 999)

    // Only look at shipments that have been delivered (deliveryDate set)
    const shipments = await prisma.shipment.findMany({
      where: {
        shipDate: { gte: start, lte: end },
        status: { in: ['DELIVERED'] as ('DELIVERED')[] },
      },
      select: {
        id: true,
        shipDate: true,
        expectedDeliveryDate: true,
        deliveryDate: true,
        signStatus: true,
        anomalyStatus: true,
        deliveryMethod: true,
        logisticsProviderId: true,
        logisticsProvider: { select: { name: true } },
        freightCost: true,
        order: {
          select: {
            customerId: true,
            promisedDeliveryDate: true,
            customer: { select: { name: true, shortName: true } },
          },
        },
      },
      orderBy: { shipDate: 'asc' },
    })

    // Helper: on-time = deliveryDate <= expectedDeliveryDate (or promisedDeliveryDate fallback)
    function isOnTime(s: typeof shipments[0]): boolean | null {
      const actual = s.deliveryDate
      const expected = s.expectedDeliveryDate ?? s.order.promisedDeliveryDate
      if (!actual || !expected) return null
      return actual <= expected
    }

    function getDaysDiff(s: typeof shipments[0]): number | null {
      const actual = s.deliveryDate
      const expected = s.expectedDeliveryDate ?? s.order.promisedDeliveryDate
      if (!actual || !expected) return null
      return Math.round((actual.getTime() - expected.getTime()) / 86400000)
    }

    if (view === 'monthly') {
      const byMonth = new Map<string, {
        month: string; total: number; onTime: number; late: number; noData: number
        totalDelay: number; anomalies: number
      }>()

      for (const s of shipments) {
        const month = (s.shipDate ?? new Date()).toISOString().slice(0, 7)
        const onTime = isOnTime(s)
        const daysDiff = getDaysDiff(s)
        const ex = byMonth.get(month)
        const entry = ex ?? { month, total: 0, onTime: 0, late: 0, noData: 0, totalDelay: 0, anomalies: 0 }
        entry.total++
        if (onTime === null) entry.noData++
        else if (onTime) entry.onTime++
        else { entry.late++; entry.totalDelay += daysDiff ?? 0 }
        if (s.anomalyStatus !== 'NORMAL') entry.anomalies++
        byMonth.set(month, entry)
      }

      const data = [...byMonth.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(r => ({
          ...r,
          onTimePct: r.total > 0 ? Math.round(r.onTime / r.total * 1000) / 10 : null,
          avgDelayDays: r.late > 0 ? Math.round(r.totalDelay / r.late * 10) / 10 : 0,
        }))
      return NextResponse.json({ data })
    }

    if (view === 'provider') {
      const byProvider = new Map<string, {
        providerId: string; name: string
        total: number; onTime: number; late: number; noData: number
        totalDelay: number; anomalies: number; totalFreight: number
      }>()

      for (const s of shipments) {
        const key = s.logisticsProviderId ?? '__direct__'
        const name = s.logisticsProvider?.name ?? (s.deliveryMethod === 'OWN_FLEET' ? '自有車' : '直送')
        const onTime = isOnTime(s)
        const daysDiff = getDaysDiff(s)
        const ex = byProvider.get(key)
        const entry = ex ?? { providerId: key, name, total: 0, onTime: 0, late: 0, noData: 0, totalDelay: 0, anomalies: 0, totalFreight: 0 }
        entry.total++
        if (onTime === null) entry.noData++
        else if (onTime) entry.onTime++
        else { entry.late++; entry.totalDelay += daysDiff ?? 0 }
        if (s.anomalyStatus !== 'NORMAL') entry.anomalies++
        entry.totalFreight += Number(s.freightCost ?? 0)
        byProvider.set(key, entry)
      }

      const data = [...byProvider.values()]
        .map(r => ({
          ...r,
          onTimePct: r.total > 0 ? Math.round(r.onTime / r.total * 1000) / 10 : null,
          avgDelayDays: r.late > 0 ? Math.round(r.totalDelay / r.late * 10) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total)
      return NextResponse.json({ data })
    }

    if (view === 'customer') {
      const byCustomer = new Map<string, {
        customerId: string; name: string
        total: number; onTime: number; late: number; noData: number; totalDelay: number
      }>()

      for (const s of shipments) {
        const key = s.order.customerId
        const name = s.order.customer.shortName ?? s.order.customer.name
        const onTime = isOnTime(s)
        const daysDiff = getDaysDiff(s)
        const ex = byCustomer.get(key)
        const entry = ex ?? { customerId: key, name, total: 0, onTime: 0, late: 0, noData: 0, totalDelay: 0 }
        entry.total++
        if (onTime === null) entry.noData++
        else if (onTime) entry.onTime++
        else { entry.late++; entry.totalDelay += daysDiff ?? 0 }
        byCustomer.set(key, entry)
      }

      const data = [...byCustomer.values()]
        .map(r => ({
          ...r,
          onTimePct: r.total > 0 ? Math.round(r.onTime / r.total * 1000) / 10 : null,
          avgDelayDays: r.late > 0 ? Math.round(r.totalDelay / r.late * 10) / 10 : 0,
        }))
        .sort((a, b) => (a.onTimePct ?? 101) - (b.onTimePct ?? 101))
      return NextResponse.json({ data })
    }

    // Overall summary (no view param)
    const total = shipments.length
    const evaluated = shipments.filter(s => isOnTime(s) !== null).length
    const onTimeCount = shipments.filter(s => isOnTime(s) === true).length
    const lateCount = shipments.filter(s => isOnTime(s) === false).length
    const anomalies = shipments.filter(s => s.anomalyStatus !== 'NORMAL').length

    return NextResponse.json({
      total, evaluated, onTimeCount, lateCount,
      onTimePct: evaluated > 0 ? Math.round(onTimeCount / evaluated * 1000) / 10 : null,
      anomalies,
    })
  } catch (error) {
    return handleApiError(error, 'logistics.delivery-performance.GET')
  }
}
