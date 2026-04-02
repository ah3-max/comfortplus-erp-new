import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/wms/abc-analysis
 * ABC analysis based on revenue contribution (Pareto principle)
 * A: top 80% revenue (20% of SKUs)
 * B: next 15% revenue
 * C: bottom 5% revenue
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const months = Math.min(12, Math.max(1, Number(searchParams.get('months') ?? 3)))

    const since = new Date()
    since.setMonth(since.getMonth() - months)

    // Aggregate sales by product over the period
    const salesData = await prisma.$queryRaw<Array<{
      productId: string
      sku: string
      name: string
      unit: string
      totalRevenue: number
      totalQty: bigint
    }>>`
      SELECT
        oi."productId",
        p.sku,
        p.name,
        p.unit,
        SUM(oi.subtotal)::float AS "totalRevenue",
        SUM(oi.quantity) AS "totalQty"
      FROM "SalesOrderItem" oi
      JOIN "Product" p ON p.id = oi."productId"
      JOIN "SalesOrder" so ON so.id = oi."orderId"
      WHERE so."createdAt" >= ${since}
        AND so.status NOT IN ('CANCELLED', 'DRAFT')
      GROUP BY oi."productId", p.sku, p.name, p.unit
      ORDER BY "totalRevenue" DESC
    `

    const total = salesData.reduce((s, r) => s + Number(r.totalRevenue), 0)
    let cumRevenue = 0

    const items = salesData.map(r => {
      const revenue = Number(r.totalRevenue)
      cumRevenue += revenue
      const cumPct = total > 0 ? (cumRevenue / total) * 100 : 0
      const revPct = total > 0 ? (revenue / total) * 100 : 0

      const abcClass = cumPct - revPct <= 80 ? 'A'
        : cumPct - revPct <= 95 ? 'B' : 'C'

      return {
        productId: r.productId,
        sku: r.sku,
        name: r.name,
        unit: r.unit,
        totalRevenue: revenue,
        totalQty: Number(r.totalQty),
        revenuePct: Math.round(revPct * 10) / 10,
        cumulativePct: Math.round(cumPct * 10) / 10,
        abcClass,
        recommendation: abcClass === 'A'
          ? '放置快取區（靠近出貨口）'
          : abcClass === 'B'
          ? '放置中間區域'
          : '放置深儲區',
      }
    })

    return NextResponse.json({
      period: `${months} 個月`,
      totalRevenue: total,
      summary: {
        A: items.filter(i => i.abcClass === 'A').length,
        B: items.filter(i => i.abcClass === 'B').length,
        C: items.filter(i => i.abcClass === 'C').length,
      },
      items,
    })
  } catch (error) {
    return handleApiError(error, 'wms.abcAnalysis')
  }
}
