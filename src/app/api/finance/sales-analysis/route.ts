import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/finance/sales-analysis
 * Query: view=monthly|customer|product   startDate   endDate
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
      orderDate: { gte: start, lte: end },
      status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
    }

    // ── Monthly trend ──────────────────────────────────────────────────────
    if (view === 'monthly') {
      const orders = await prisma.salesOrder.findMany({
        where: baseWhere,
        select: {
          orderDate: true,
          totalAmount: true,
          subtotal: true,
          taxAmount: true,
          discountAmount: true,
        },
        orderBy: { orderDate: 'asc' },
      })

      const byMonth = new Map<string, {
        month: string; count: number; totalAmount: number
        subtotal: number; tax: number; discount: number
      }>()
      for (const o of orders) {
        const month = o.orderDate.toISOString().slice(0, 7)
        const ex = byMonth.get(month)
        if (ex) {
          ex.count++
          ex.totalAmount += Number(o.totalAmount)
          ex.subtotal += Number(o.subtotal)
          ex.tax += Number(o.taxAmount ?? 0)
          ex.discount += Number(o.discountAmount ?? 0)
        } else {
          byMonth.set(month, {
            month, count: 1,
            totalAmount: Number(o.totalAmount),
            subtotal: Number(o.subtotal),
            tax: Number(o.taxAmount ?? 0),
            discount: Number(o.discountAmount ?? 0),
          })
        }
      }
      return NextResponse.json({ data: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)) })
    }

    // ── Customer breakdown ─────────────────────────────────────────────────
    if (view === 'customer') {
      const orders = await prisma.salesOrder.findMany({
        where: baseWhere,
        select: {
          customerId: true,
          totalAmount: true,
          orderType: true,
          customer: { select: { name: true, shortName: true, type: true } },
        },
      })

      const byCustomer = new Map<string, {
        customerId: string; name: string; type: string; count: number; totalAmount: number
      }>()
      for (const o of orders) {
        const ex = byCustomer.get(o.customerId)
        if (ex) { ex.count++; ex.totalAmount += Number(o.totalAmount) }
        else byCustomer.set(o.customerId, {
          customerId: o.customerId,
          name: o.customer.shortName ?? o.customer.name,
          type: String(o.customer.type),
          count: 1,
          totalAmount: Number(o.totalAmount),
        })
      }
      const total = [...byCustomer.values()].reduce((s, v) => s + v.totalAmount, 0)
      const data = [...byCustomer.values()]
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .map(v => ({ ...v, sharePct: total > 0 ? Math.round(v.totalAmount / total * 1000) / 10 : 0 }))
      return NextResponse.json({ data, total })
    }

    // ── Product breakdown ──────────────────────────────────────────────────
    if (view === 'product') {
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
          unitPrice: true,
          subtotal: true,
          product: { select: { name: true, sku: true } },
        },
      })

      const byProduct = new Map<string, {
        productId: string; name: string; sku: string
        qty: number; subtotal: number; avgPrice: number; orderCount: number
      }>()
      for (const item of items) {
        const ex = byProduct.get(item.productId)
        if (ex) {
          ex.qty += item.quantity
          ex.subtotal += Number(item.subtotal)
          ex.orderCount++
        } else {
          byProduct.set(item.productId, {
            productId: item.productId,
            name: item.product.name,
            sku: item.product.sku,
            qty: item.quantity,
            subtotal: Number(item.subtotal),
            avgPrice: Number(item.unitPrice),
            orderCount: 1,
          })
        }
      }
      const data = [...byProduct.values()].map(p => ({
        ...p,
        avgPrice: p.qty > 0 ? Math.round(p.subtotal / p.qty * 100) / 100 : 0,
      })).sort((a, b) => b.subtotal - a.subtotal)

      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: '不支援的 view' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'finance.sales-analysis.GET')
  }
}
