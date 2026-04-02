import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/customers/order-frequency
 * Returns order frequency analysis per customer (last 6 months)
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const rows = await prisma.$queryRaw<Array<{
      customerId: string
      customerName: string
      customerCode: string
      orderCount: bigint
      totalRevenue: number
      firstOrder: Date
      lastOrder: Date
      avgDaysBetweenOrders: number | null
    }>>`
      SELECT
        c.id AS "customerId",
        c.name AS "customerName",
        c.code AS "customerCode",
        COUNT(so.id) AS "orderCount",
        SUM(so."totalAmount")::float AS "totalRevenue",
        MIN(so."createdAt") AS "firstOrder",
        MAX(so."createdAt") AS "lastOrder",
        CASE
          WHEN COUNT(so.id) > 1 THEN
            ROUND(
              EXTRACT(EPOCH FROM (MAX(so."createdAt") - MIN(so."createdAt")))
              / 86400 / NULLIF(COUNT(so.id) - 1, 0)
            )::float
          ELSE NULL
        END AS "avgDaysBetweenOrders"
      FROM "Customer" c
      JOIN "SalesOrder" so ON so."customerId" = c.id
      WHERE so."createdAt" >= ${sixMonthsAgo}
        AND so.status NOT IN ('CANCELLED', 'DRAFT')
        AND c."isActive" = true
      GROUP BY c.id, c.name, c.code
      ORDER BY "orderCount" DESC
      LIMIT 50
    `

    const now = new Date()
    const data = rows.map(r => {
      const daysSinceLast = Math.floor((now.getTime() - new Date(r.lastOrder).getTime()) / 86400000)
      const orderCount = Number(r.orderCount)
      const avgDays = r.avgDaysBetweenOrders ? Number(r.avgDaysBetweenOrders) : null

      // Churn risk: if avg interval is known and daysSinceLast > 1.5x avg interval
      const churnRisk = avgDays && daysSinceLast > avgDays * 1.5 ? 'HIGH'
        : avgDays && daysSinceLast > avgDays ? 'MEDIUM' : 'LOW'

      return {
        customerId: r.customerId,
        customerName: r.customerName,
        customerCode: r.customerCode,
        orderCount,
        totalRevenue: Number(r.totalRevenue ?? 0),
        firstOrder: r.firstOrder,
        lastOrder: r.lastOrder,
        daysSinceLast,
        avgDaysBetweenOrders: avgDays,
        churnRisk,
      }
    })

    return NextResponse.json(data)
  } catch (error) {
    return handleApiError(error, 'customers.orderFrequency')
  }
}
