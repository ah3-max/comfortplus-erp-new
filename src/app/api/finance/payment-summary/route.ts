import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
    const type = searchParams.get('type') ?? 'OUTGOING' // OUTGOING=付款, INCOMING=收款, ADVANCE=暫付

    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

    const where: Record<string, unknown> = {
      paymentDate: { gte: yearStart, lte: yearEnd },
    }
    if (type === 'ADVANCE') {
      where.direction = 'OUTGOING'
      where.notes = { contains: '暫付' }
    } else {
      where.direction = type
    }

    const records = await prisma.paymentRecord.findMany({
      where,
      select: { paymentDate: true, amount: true, paymentType: true },
    })

    const monthly: Record<number, { count: number; totalAmount: number }> = {}
    for (let m = 1; m <= 12; m++) monthly[m] = { count: 0, totalAmount: 0 }

    for (const r of records) {
      const m = r.paymentDate.getMonth() + 1
      monthly[m].count++
      monthly[m].totalAmount += Number(r.amount)
    }

    const rows = Object.entries(monthly).map(([m, v]) => ({
      month: Number(m),
      count: v.count,
      totalAmount: Math.round(v.totalAmount * 100) / 100,
      avgAmount: v.count > 0 ? Math.round(v.totalAmount / v.count * 100) / 100 : 0,
    }))

    return NextResponse.json({
      year, type,
      grandTotal: Math.round(rows.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100,
      totalCount: rows.reduce((s, r) => s + r.count, 0),
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.payment-summary.GET')
  }
}
