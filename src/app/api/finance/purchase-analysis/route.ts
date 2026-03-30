import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/finance/purchase-analysis
 * Query: view=monthly|supplier|product   startDate   endDate
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'PROCUREMENT', 'SALES_MANAGER'].includes(role)) {
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
      purchaseDate: { gte: start, lte: end },
      status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
    }

    if (view === 'monthly') {
      // Monthly trend
      const orders = await prisma.purchaseOrder.findMany({
        where: baseWhere,
        select: { purchaseDate: true, totalAmount: true, subtotal: true, taxAmount: true, status: true },
        orderBy: { purchaseDate: 'asc' },
      })

      const byMonth = new Map<string, { month: string; count: number; totalAmount: number; subtotal: number; tax: number }>()
      for (const o of orders) {
        const month = o.purchaseDate.toISOString().slice(0, 7)
        const existing = byMonth.get(month)
        if (existing) {
          existing.count++
          existing.totalAmount += Number(o.totalAmount)
          existing.subtotal += Number(o.subtotal)
          existing.tax += Number(o.taxAmount ?? 0)
        } else {
          byMonth.set(month, { month, count: 1, totalAmount: Number(o.totalAmount), subtotal: Number(o.subtotal), tax: Number(o.taxAmount ?? 0) })
        }
      }
      return NextResponse.json({ data: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)) })
    }

    if (view === 'supplier') {
      const orders = await prisma.purchaseOrder.findMany({
        where: baseWhere,
        select: {
          supplierId: true,
          totalAmount: true,
          supplier: { select: { name: true, country: true } },
        },
      })

      const bySupplier = new Map<string, { supplierId: string; name: string; country: string | null; count: number; totalAmount: number }>()
      for (const o of orders) {
        const existing = bySupplier.get(o.supplierId)
        if (existing) { existing.count++; existing.totalAmount += Number(o.totalAmount) }
        else bySupplier.set(o.supplierId, { supplierId: o.supplierId, name: o.supplier.name, country: o.supplier.country ?? null, count: 1, totalAmount: Number(o.totalAmount) })
      }
      const total = [...bySupplier.values()].reduce((s, v) => s + v.totalAmount, 0)
      const data = [...bySupplier.values()]
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .map(v => ({ ...v, sharePct: total > 0 ? Math.round(v.totalAmount / total * 1000) / 10 : 0 }))
      return NextResponse.json({ data, total })
    }

    if (view === 'product') {
      const items = await prisma.purchaseOrderItem.findMany({
        where: {
          order: {
            purchaseDate: { gte: start, lte: end },
            status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
          },
          product: { isActive: true },
        },
        select: {
          productId: true,
          quantity: true,
          unitCost: true,
          subtotal: true,
          product: { select: { name: true, sku: true } },
        },
      })

      const byProduct = new Map<string, { productId: string; name: string; sku: string; qty: number; subtotal: number; avgCost: number; orderCount: number }>()
      for (const item of items) {
        if (!item.productId || !item.product) continue
        const existing = byProduct.get(item.productId)
        if (existing) {
          existing.qty += item.quantity
          existing.subtotal += Number(item.subtotal)
          existing.orderCount++
        } else {
          byProduct.set(item.productId, {
            productId: item.productId,
            name: item.product.name,
            sku: item.product.sku,
            qty: item.quantity,
            subtotal: Number(item.subtotal),
            avgCost: Number(item.unitCost),
            orderCount: 1,
          })
        }
      }
      const data = [...byProduct.values()].map(p => ({
        ...p,
        avgCost: p.qty > 0 ? Math.round(p.subtotal / p.qty * 100) / 100 : 0,
      })).sort((a, b) => b.subtotal - a.subtotal)

      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: '不支援的 view' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'finance.purchase-analysis.GET')
  }
}
