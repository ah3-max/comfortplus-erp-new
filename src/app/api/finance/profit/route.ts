import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const ACTIVE_STATUSES = ['CONFIRMED', 'PARTIAL_SHIPPED', 'SHIPPED', 'COMPLETED']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') ?? 'monthly'  // monthly | customer | salesperson | product
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())
    const month = searchParams.get('month') ? Number(searchParams.get('month')) : undefined

    const periodStart = new Date(year, 0, 1)
    const periodEnd = new Date(year + 1, 0, 1)

    const baseWhere = {
      status: { in: ACTIVE_STATUSES as never[] },
      orderDate: { gte: periodStart, lt: periodEnd },
    }

    if (view === 'monthly') {
      // Monthly trend: aggregate by month
      const orders = await prisma.salesOrder.findMany({
        where: baseWhere,
        select: {
          orderDate: true,
          totalAmount: true,
          costOfGoods: true,
          grossProfit: true,
          grossMarginPct: true,
          netProfit: true,
          discountAmount: true,
        },
      })

      // Group by month
      const byMonth: Record<number, {
        month: number
        revenue: number
        cost: number
        grossProfit: number
        netProfit: number
        orderCount: number
      }> = {}

      for (let m = 1; m <= 12; m++) {
        byMonth[m] = { month: m, revenue: 0, cost: 0, grossProfit: 0, netProfit: 0, orderCount: 0 }
      }

      for (const o of orders) {
        const m = new Date(o.orderDate).getMonth() + 1
        byMonth[m].revenue += Number(o.totalAmount)
        byMonth[m].cost += Number(o.costOfGoods ?? 0)
        byMonth[m].grossProfit += Number(o.grossProfit ?? 0)
        byMonth[m].netProfit += Number(o.netProfit ?? 0)
        byMonth[m].orderCount++
      }

      const rows = Object.values(byMonth).map(r => ({
        ...r,
        grossMarginPct: r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : 0,
      }))

      const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
      const totalGrossProfit = rows.reduce((s, r) => s + r.grossProfit, 0)
      const totalNetProfit = rows.reduce((s, r) => s + r.netProfit, 0)
      const totalCost = rows.reduce((s, r) => s + r.cost, 0)

      return NextResponse.json({
        rows,
        summary: {
          totalRevenue,
          totalCost,
          totalGrossProfit,
          totalNetProfit,
          avgGrossMarginPct: totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0,
        },
      })
    }

    if (view === 'customer') {
      const orders = await prisma.salesOrder.findMany({
        where: baseWhere,
        select: {
          customerId: true,
          customer: { select: { id: true, name: true, code: true, type: true } },
          totalAmount: true,
          costOfGoods: true,
          grossProfit: true,
          netProfit: true,
          discountAmount: true,
        },
      })

      const byCustomer: Record<string, {
        customerId: string
        customerName: string
        customerCode: string
        customerType: string
        revenue: number
        cost: number
        grossProfit: number
        netProfit: number
        orderCount: number
      }> = {}

      for (const o of orders) {
        if (!o.customerId) continue
        if (!byCustomer[o.customerId]) {
          byCustomer[o.customerId] = {
            customerId: o.customerId,
            customerName: o.customer?.name ?? '未知',
            customerCode: o.customer?.code ?? '',
            customerType: o.customer?.type ?? '',
            revenue: 0, cost: 0, grossProfit: 0, netProfit: 0, orderCount: 0,
          }
        }
        byCustomer[o.customerId].revenue += Number(o.totalAmount)
        byCustomer[o.customerId].cost += Number(o.costOfGoods ?? 0)
        byCustomer[o.customerId].grossProfit += Number(o.grossProfit ?? 0)
        byCustomer[o.customerId].netProfit += Number(o.netProfit ?? 0)
        byCustomer[o.customerId].orderCount++
      }

      const rows = Object.values(byCustomer)
        .map(r => ({
          ...r,
          grossMarginPct: r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : 0,
        }))
        .sort((a, b) => b.grossProfit - a.grossProfit)

      return NextResponse.json({ rows })
    }

    if (view === 'salesperson') {
      const orders = await prisma.salesOrder.findMany({
        where: baseWhere,
        select: {
          createdById: true,
          createdBy: { select: { id: true, name: true } },
          totalAmount: true,
          costOfGoods: true,
          grossProfit: true,
          netProfit: true,
        },
      })

      const bySales: Record<string, {
        salesId: string
        salesName: string
        revenue: number
        cost: number
        grossProfit: number
        netProfit: number
        orderCount: number
      }> = {}

      for (const o of orders) {
        const sid = o.createdById
        if (!bySales[sid]) {
          bySales[sid] = {
            salesId: sid,
            salesName: o.createdBy?.name ?? '未知',
            revenue: 0, cost: 0, grossProfit: 0, netProfit: 0, orderCount: 0,
          }
        }
        bySales[sid].revenue += Number(o.totalAmount)
        bySales[sid].cost += Number(o.costOfGoods ?? 0)
        bySales[sid].grossProfit += Number(o.grossProfit ?? 0)
        bySales[sid].netProfit += Number(o.netProfit ?? 0)
        bySales[sid].orderCount++
      }

      const rows = Object.values(bySales)
        .map(r => ({
          ...r,
          grossMarginPct: r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : 0,
        }))
        .sort((a, b) => b.grossProfit - a.grossProfit)

      return NextResponse.json({ rows })
    }

    if (view === 'product') {
      // Use SalesOrderItem + Product.costPrice for product-level analysis
      const itemWhere = {
        order: {
          status: { in: ACTIVE_STATUSES as never[] },
          orderDate: {
            gte: month ? new Date(year, month - 1, 1) : periodStart,
            lt: month ? new Date(year, month, 1) : periodEnd,
          },
        },
      }

      const items = await prisma.salesOrderItem.findMany({
        where: itemWhere,
        select: {
          productId: true,
          product: { select: { id: true, name: true, sku: true, unit: true, costPrice: true } },
          quantity: true,
          unitPrice: true,
          subtotal: true,
        },
      })

      const byProduct: Record<string, {
        productId: string
        productName: string
        sku: string
        unit: string
        revenue: number
        estimatedCost: number
        estimatedGrossProfit: number
        quantity: number
        orderCount: number
      }> = {}

      for (const item of items) {
        const pid = item.productId
        if (!byProduct[pid]) {
          byProduct[pid] = {
            productId: pid,
            productName: item.product?.name ?? '未知',
            sku: item.product?.sku ?? '',
            unit: item.product?.unit ?? '',
            revenue: 0, estimatedCost: 0, estimatedGrossProfit: 0,
            quantity: 0, orderCount: 0,
          }
        }
        const costPrice = Number(item.product?.costPrice ?? 0)
        const rev = Number(item.subtotal)
        const cost = costPrice * item.quantity
        byProduct[pid].revenue += rev
        byProduct[pid].estimatedCost += cost
        byProduct[pid].estimatedGrossProfit += rev - cost
        byProduct[pid].quantity += item.quantity
        byProduct[pid].orderCount++
      }

      const rows = Object.values(byProduct)
        .map(r => ({
          ...r,
          grossMarginPct: r.revenue > 0 ? (r.estimatedGrossProfit / r.revenue) * 100 : 0,
        }))
        .sort((a, b) => b.estimatedGrossProfit - a.estimatedGrossProfit)

      return NextResponse.json({ rows })
    }

    return NextResponse.json({ error: '無效的 view 參數' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'finance.profit.GET')
  }
}
