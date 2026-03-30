import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/finance/gross-margin
 * Gross margin analysis: monthly | customer | product
 * Query: view, startDate, endDate
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER'].includes(role)) {
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

    const baseWhere = {
      orderDate: { gte: start, lte: end },
      status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
    }

    // ── Monthly gross margin ───────────────────────────────────────────────
    if (view === 'monthly') {
      const orders = await prisma.salesOrder.findMany({
        where: baseWhere,
        select: {
          orderDate: true,
          totalAmount: true,
          costOfGoods: true,
          grossProfit: true,
          grossMarginPct: true,
        },
        orderBy: { orderDate: 'asc' },
      })

      const byMonth = new Map<string, {
        month: string; count: number
        revenue: number; cogs: number; grossProfit: number
      }>()
      for (const o of orders) {
        const month = o.orderDate.toISOString().slice(0, 7)
        const rev = Number(o.totalAmount)
        const cogs = Number(o.costOfGoods ?? 0)
        const gp = Number(o.grossProfit ?? (rev - cogs))
        const ex = byMonth.get(month)
        if (ex) {
          ex.count++
          ex.revenue += rev
          ex.cogs += cogs
          ex.grossProfit += gp
        } else {
          byMonth.set(month, { month, count: 1, revenue: rev, cogs, grossProfit: gp })
        }
      }

      const data = [...byMonth.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(r => ({
          ...r,
          grossMarginPct: r.revenue > 0 ? Math.round(r.grossProfit / r.revenue * 1000) / 10 : 0,
        }))
      return NextResponse.json({ data })
    }

    // ── Customer gross margin ──────────────────────────────────────────────
    if (view === 'customer') {
      const orders = await prisma.salesOrder.findMany({
        where: baseWhere,
        select: {
          customerId: true,
          totalAmount: true,
          costOfGoods: true,
          grossProfit: true,
          customer: { select: { name: true, shortName: true, type: true } },
        },
      })

      const byCustomer = new Map<string, {
        customerId: string; name: string; type: string
        count: number; revenue: number; cogs: number; grossProfit: number
      }>()
      for (const o of orders) {
        const rev = Number(o.totalAmount)
        const cogs = Number(o.costOfGoods ?? 0)
        const gp = Number(o.grossProfit ?? (rev - cogs))
        const ex = byCustomer.get(o.customerId)
        if (ex) {
          ex.count++; ex.revenue += rev; ex.cogs += cogs; ex.grossProfit += gp
        } else {
          byCustomer.set(o.customerId, {
            customerId: o.customerId,
            name: o.customer.shortName ?? o.customer.name,
            type: String(o.customer.type),
            count: 1, revenue: rev, cogs, grossProfit: gp,
          })
        }
      }

      const data = [...byCustomer.values()]
        .map(r => ({
          ...r,
          grossMarginPct: r.revenue > 0 ? Math.round(r.grossProfit / r.revenue * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.grossProfit - a.grossProfit)
      return NextResponse.json({ data })
    }

    // ── Product gross margin ───────────────────────────────────────────────
    if (view === 'product') {
      // Aggregate from order-level cost data grouped by product
      // Since SalesOrderItem has no cost fields, join through orders that have costOfGoods
      const orders = await prisma.salesOrder.findMany({
        where: {
          ...baseWhere,
          costOfGoods: { not: null },
        },
        select: {
          totalAmount: true,
          grossProfit: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              subtotal: true,
              product: { select: { name: true, sku: true } },
            },
          },
        },
      })

      const byProduct = new Map<string, {
        productId: string; name: string; sku: string
        qty: number; revenue: number; grossProfit: number; orderCount: number
      }>()

      for (const o of orders) {
        const orderRevenue = Number(o.totalAmount)
        const orderGP = Number(o.grossProfit ?? 0)
        const orderSubtotal = o.items.reduce((s, item) => s + Number(item.subtotal), 0)
        for (const item of o.items) {
          const rev = Number(item.subtotal)
          // Apportion gross profit proportionally to item revenue
          const itemGP = orderSubtotal > 0 ? orderGP * (rev / orderSubtotal) : 0
          const ex = byProduct.get(item.productId)
          if (ex) {
            ex.qty += item.quantity; ex.revenue += rev; ex.grossProfit += itemGP; ex.orderCount++
          } else {
            byProduct.set(item.productId, {
              productId: item.productId,
              name: item.product.name,
              sku: item.product.sku,
              qty: item.quantity, revenue: rev, grossProfit: itemGP, orderCount: 1,
            })
          }
        }
      }

      // Fallback: include items from orders without cost data (grossProfit = 0)
      const allItems = await prisma.salesOrderItem.findMany({
        where: {
          order: {
            orderDate: { gte: start, lte: end },
            status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
            costOfGoods: null,
          },
          product: { isActive: true },
        },
        select: {
          productId: true,
          quantity: true,
          subtotal: true,
          product: { select: { name: true, sku: true } },
        },
      })
      for (const item of allItems) {
        const rev = Number(item.subtotal)
        const ex = byProduct.get(item.productId)
        if (ex) {
          ex.qty += item.quantity; ex.revenue += rev; ex.orderCount++
        } else {
          byProduct.set(item.productId, {
            productId: item.productId,
            name: item.product.name,
            sku: item.product.sku,
            qty: item.quantity, revenue: rev, grossProfit: 0, orderCount: 1,
          })
        }
      }

      const data = [...byProduct.values()]
        .map(p => ({
          ...p,
          grossMarginPct: p.revenue > 0 ? Math.round(p.grossProfit / p.revenue * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.grossProfit - a.grossProfit)
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: '不支援的 view' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'finance.gross-margin.GET')
  }
}
