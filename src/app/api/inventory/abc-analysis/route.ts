import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/inventory/abc-analysis
 * ABC analysis: rank products by sales revenue contribution
 * A = top 80%, B = next 15%, C = bottom 5%
 * Query: startDate, endDate
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER', 'WAREHOUSE_MANAGER', 'PROCUREMENT'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const startStr = searchParams.get('startDate')
    const endStr = searchParams.get('endDate')

    const now = new Date()
    const start = startStr ? new Date(startStr) : new Date(now.getFullYear(), 0, 1)
    const end = endStr ? new Date(endStr) : now
    end.setHours(23, 59, 59, 999)

    // Aggregate SalesOrderItems
    const items = await prisma.salesOrderItem.findMany({
      where: {
        order: {
          orderDate: { gte: start, lte: end },
          status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
        },
        product: { isActive: true },
      },
      select: {
        productId: true,
        quantity: true,
        subtotal: true,
        product: { select: { name: true, sku: true, category: true, unit: true } },
      },
    })

    // Aggregate by product
    const map = new Map<string, {
      productId: string; name: string; sku: string; category: string | null; unit: string
      qty: number; revenue: number; orderCount: number
    }>()

    for (const item of items) {
      const ex = map.get(item.productId)
      if (ex) {
        ex.qty += item.quantity
        ex.revenue += Number(item.subtotal)
        ex.orderCount++
      } else {
        map.set(item.productId, {
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          category: item.product.category ?? null,
          unit: item.product.unit,
          qty: item.quantity,
          revenue: Number(item.subtotal),
          orderCount: 1,
        })
      }
    }

    const sorted = [...map.values()].sort((a, b) => b.revenue - a.revenue)
    const grandTotal = sorted.reduce((s, v) => s + v.revenue, 0)

    // Classify A/B/C
    let cumulative = 0
    const data = sorted.map((p, i) => {
      cumulative += p.revenue
      const cumulativePct = grandTotal > 0 ? Math.round(cumulative / grandTotal * 1000) / 10 : 0
      const revenuePct = grandTotal > 0 ? Math.round(p.revenue / grandTotal * 1000) / 10 : 0
      const grade = cumulativePct <= 80 ? 'A' : cumulativePct <= 95 ? 'B' : 'C'
      return {
        rank: i + 1,
        productId: p.productId,
        name: p.name,
        sku: p.sku,
        category: p.category,
        unit: p.unit,
        qty: p.qty,
        revenue: p.revenue,
        revenuePct,
        cumulativePct,
        orderCount: p.orderCount,
        grade,
      }
    })

    const summary = {
      totalProducts: data.length,
      grandTotal,
      gradeA: data.filter(d => d.grade === 'A').length,
      gradeB: data.filter(d => d.grade === 'B').length,
      gradeC: data.filter(d => d.grade === 'C').length,
      gradeARevenue: data.filter(d => d.grade === 'A').reduce((s, v) => s + v.revenue, 0),
      gradeBRevenue: data.filter(d => d.grade === 'B').reduce((s, v) => s + v.revenue, 0),
      gradeCRevenue: data.filter(d => d.grade === 'C').reduce((s, v) => s + v.revenue, 0),
    }

    return NextResponse.json({ data, summary })
  } catch (error) {
    return handleApiError(error, 'inventory.abc-analysis.GET')
  }
}
