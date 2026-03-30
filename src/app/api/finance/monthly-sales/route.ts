import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

    const orders = await prisma.salesOrder.findMany({
      where: { orderDate: { gte: yearStart, lte: yearEnd } },
      select: { orderDate: true, totalAmount: true, status: true },
    })

    const monthly: Record<number, { count: number; totalAmount: number }> = {}
    for (let m = 1; m <= 12; m++) monthly[m] = { count: 0, totalAmount: 0 }

    for (const o of orders) {
      const m = o.orderDate.getMonth() + 1
      monthly[m].count++
      monthly[m].totalAmount += Number(o.totalAmount)
    }

    const rows = Object.entries(monthly).map(([m, v]) => ({
      month: Number(m),
      count: v.count,
      totalAmount: Math.round(v.totalAmount * 100) / 100,
      avgAmount: v.count > 0 ? Math.round(v.totalAmount / v.count * 100) / 100 : 0,
    }))

    return NextResponse.json({
      year,
      grandTotal: Math.round(rows.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100,
      totalOrders: rows.reduce((s, r) => s + r.count, 0),
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.monthly-sales.GET')
  }
}
