import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') ?? 'monthly'
    const from = searchParams.get('from') ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
    const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10)

    const fromDate = new Date(from)
    const toDate = new Date(to + 'T23:59:59')

    if (view === 'monthly') {
      const orders = await prisma.salesOrder.findMany({
        where: {
          orderDate: { gte: fromDate, lte: toDate },
          status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
        },
        select: {
          orderDate: true,
          items: { select: { quantity: true, shippedQty: true } },
        },
      })

      const byMonth: Record<string, { ordered: number; shipped: number }> = {}
      for (const o of orders) {
        const month = o.orderDate.toISOString().slice(0, 7)
        if (!byMonth[month]) byMonth[month] = { ordered: 0, shipped: 0 }
        for (const item of o.items) {
          byMonth[month].ordered += item.quantity
          byMonth[month].shipped += item.shippedQty
        }
      }

      const result = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, { ordered, shipped }]) => ({
          month,
          ordered,
          shipped,
          rate: ordered > 0 ? Math.round((shipped / ordered) * 1000) / 10 : 0,
        }))

      return NextResponse.json(result)
    }

    if (view === 'product') {
      const items = await prisma.salesOrderItem.findMany({
        where: {
          order: {
            orderDate: { gte: fromDate, lte: toDate },
            status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
          },
        },
        select: {
          productId: true,
          productNameSnap: true,
          skuSnap: true,
          quantity: true,
          shippedQty: true,
        },
      })

      const byProduct: Record<string, { name: string; sku: string; ordered: number; shipped: number }> = {}
      for (const item of items) {
        if (!byProduct[item.productId]) {
          byProduct[item.productId] = {
            name: item.productNameSnap ?? item.productId,
            sku: item.skuSnap ?? '',
            ordered: 0,
            shipped: 0,
          }
        }
        byProduct[item.productId].ordered += item.quantity
        byProduct[item.productId].shipped += item.shippedQty
      }

      const result = Object.entries(byProduct)
        .map(([productId, { name, sku, ordered, shipped }]) => ({
          productId,
          name,
          sku,
          ordered,
          shipped,
          rate: ordered > 0 ? Math.round((shipped / ordered) * 1000) / 10 : 0,
        }))
        .sort((a, b) => a.rate - b.rate)

      return NextResponse.json(result)
    }

    if (view === 'customer') {
      const orders = await prisma.salesOrder.findMany({
        where: {
          orderDate: { gte: fromDate, lte: toDate },
          status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
        },
        select: {
          customerId: true,
          customer: { select: { name: true } },
          items: { select: { quantity: true, shippedQty: true } },
        },
      })

      const byCustomer: Record<string, { name: string; ordered: number; shipped: number; orders: number }> = {}
      for (const o of orders) {
        if (!byCustomer[o.customerId]) {
          byCustomer[o.customerId] = { name: o.customer.name, ordered: 0, shipped: 0, orders: 0 }
        }
        byCustomer[o.customerId].orders += 1
        for (const item of o.items) {
          byCustomer[o.customerId].ordered += item.quantity
          byCustomer[o.customerId].shipped += item.shippedQty
        }
      }

      const result = Object.entries(byCustomer)
        .map(([customerId, { name, ordered, shipped, orders }]) => ({
          customerId,
          name,
          ordered,
          shipped,
          orders,
          rate: ordered > 0 ? Math.round((shipped / ordered) * 1000) / 10 : 0,
        }))
        .sort((a, b) => a.rate - b.rate)

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'sales.fulfillmentRate')
  }
}
