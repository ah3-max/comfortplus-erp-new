import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/sales-returns/analysis
 * Return rate analysis: monthly | product | customer | reason
 * Query: view, startDate, endDate
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      requestDate: { gte: start, lte: end },
      status: { notIn: ['PENDING'] as ('PENDING')[] },
    }

    if (view === 'monthly') {
      const [returns, orders] = await Promise.all([
        prisma.returnOrder.findMany({
          where: baseWhere,
          select: {
            requestDate: true,
            refundAmount: true,
            items: { select: { quantity: true } },
          },
        }),
        prisma.salesOrder.findMany({
          where: {
            orderDate: { gte: start, lte: end },
            status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
          },
          select: { orderDate: true, totalAmount: true },
        }),
      ])

      const byMonth = new Map<string, { month: string; returnCount: number; returnQty: number; refundAmount: number }>()
      const salesByMonth = new Map<string, { revenue: number; count: number }>()

      for (const r of returns) {
        const month = r.requestDate.toISOString().slice(0, 7)
        const qty = r.items.reduce((s, i) => s + i.quantity, 0)
        const ex = byMonth.get(month)
        if (ex) { ex.returnCount++; ex.returnQty += qty; ex.refundAmount += Number(r.refundAmount ?? 0) }
        else byMonth.set(month, { month, returnCount: 1, returnQty: qty, refundAmount: Number(r.refundAmount ?? 0) })
      }
      for (const o of orders) {
        const month = o.orderDate.toISOString().slice(0, 7)
        const ex = salesByMonth.get(month)
        if (ex) { ex.revenue += Number(o.totalAmount); ex.count++ }
        else salesByMonth.set(month, { revenue: Number(o.totalAmount), count: 1 })
      }

      const allMonths = new Set([...byMonth.keys(), ...salesByMonth.keys()])
      const data = [...allMonths].sort().map(month => {
        const ret = byMonth.get(month) ?? { returnCount: 0, returnQty: 0, refundAmount: 0 }
        const sale = salesByMonth.get(month) ?? { revenue: 0, count: 0 }
        return {
          month,
          returnCount: ret.returnCount,
          returnQty: ret.returnQty,
          refundAmount: ret.refundAmount,
          salesCount: sale.count,
          salesRevenue: sale.revenue,
          returnRatePct: sale.count > 0 ? Math.round(ret.returnCount / sale.count * 1000) / 10 : 0,
          refundRatePct: sale.revenue > 0 ? Math.round(ret.refundAmount / sale.revenue * 1000) / 10 : 0,
        }
      })
      return NextResponse.json({ data })
    }

    if (view === 'product') {
      const items = await prisma.returnOrderItem.findMany({
        where: { returnOrder: baseWhere },
        select: {
          productId: true,
          quantity: true,
          reason: true,
          condition: true,
          product: { select: { name: true, sku: true } },
        },
      })

      const byProduct = new Map<string, { productId: string; name: string; sku: string; qty: number; returnCount: number }>()
      for (const item of items) {
        const ex = byProduct.get(item.productId)
        if (ex) { ex.qty += item.quantity; ex.returnCount++ }
        else byProduct.set(item.productId, {
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          qty: item.quantity,
          returnCount: 1,
        })
      }

      // Get sales qty for return rate
      const salesItems = await prisma.salesOrderItem.findMany({
        where: {
          order: {
            orderDate: { gte: start, lte: end },
            status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
          },
          productId: { in: [...byProduct.keys()] },
        },
        select: { productId: true, quantity: true },
      })
      const salesQtyMap = new Map<string, number>()
      for (const s of salesItems) {
        salesQtyMap.set(s.productId, (salesQtyMap.get(s.productId) ?? 0) + s.quantity)
      }

      const data = [...byProduct.values()].map(p => ({
        ...p,
        salesQty: salesQtyMap.get(p.productId) ?? 0,
        returnRatePct: (salesQtyMap.get(p.productId) ?? 0) > 0
          ? Math.round(p.qty / (salesQtyMap.get(p.productId) ?? 1) * 1000) / 10 : 0,
      })).sort((a, b) => b.qty - a.qty)
      return NextResponse.json({ data })
    }

    if (view === 'customer') {
      const returns = await prisma.returnOrder.findMany({
        where: baseWhere,
        select: {
          customerId: true,
          refundAmount: true,
          reason: true,
          returnType: true,
          items: { select: { quantity: true } },
          customer: { select: { name: true, shortName: true } },
        },
      })

      const byCustomer = new Map<string, {
        customerId: string; name: string
        returnCount: number; returnQty: number; refundAmount: number
      }>()
      for (const r of returns) {
        const qty = r.items.reduce((s, i) => s + i.quantity, 0)
        const ex = byCustomer.get(r.customerId)
        if (ex) { ex.returnCount++; ex.returnQty += qty; ex.refundAmount += Number(r.refundAmount ?? 0) }
        else byCustomer.set(r.customerId, {
          customerId: r.customerId,
          name: r.customer.shortName ?? r.customer.name,
          returnCount: 1, returnQty: qty, refundAmount: Number(r.refundAmount ?? 0),
        })
      }

      const data = [...byCustomer.values()].sort((a, b) => b.returnCount - a.returnCount)
      return NextResponse.json({ data })
    }

    if (view === 'reason') {
      const returns = await prisma.returnOrder.findMany({
        where: baseWhere,
        select: {
          reason: true,
          returnCategory: true,
          responsibility: true,
          refundAmount: true,
          items: { select: { quantity: true } },
        },
      })

      const byReason = new Map<string, { reason: string; count: number; qty: number; refundAmount: number }>()
      for (const r of returns) {
        const key = r.reason ?? r.returnCategory ?? '未分類'
        const qty = r.items.reduce((s, i) => s + i.quantity, 0)
        const ex = byReason.get(key)
        if (ex) { ex.count++; ex.qty += qty; ex.refundAmount += Number(r.refundAmount ?? 0) }
        else byReason.set(key, { reason: key, count: 1, qty, refundAmount: Number(r.refundAmount ?? 0) })
      }

      const total = [...byReason.values()].reduce((s, v) => s + v.count, 0)
      const data = [...byReason.values()]
        .map(r => ({ ...r, pct: total > 0 ? Math.round(r.count / total * 1000) / 10 : 0 }))
        .sort((a, b) => b.count - a.count)
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: '不支援的 view' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'sales-returns.analysis.GET')
  }
}
