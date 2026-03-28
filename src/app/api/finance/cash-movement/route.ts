import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const direction = searchParams.get('direction') // INCOMING / OUTGOING / all
    const method = searchParams.get('method')

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const where: Record<string, unknown> = { paymentDate: { gte: periodStart, lte: periodEnd } }
    if (direction && direction !== 'all') where.direction = direction
    if (method) where.paymentMethod = method

    const records = await prisma.paymentRecord.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { paymentDate: 'asc' },
    })

    const rows = records.map(r => ({
      id: r.id,
      paymentNo: r.paymentNo,
      date: r.paymentDate.toISOString().slice(0, 10),
      direction: r.direction,
      amount: Number(r.amount),
      paymentMethod: r.paymentMethod ?? '',
      bankAccount: r.bankAccount ?? '',
      referenceNo: r.referenceNo ?? '',
      partyName: r.customer?.name ?? r.supplier?.name ?? '—',
      notes: r.notes ?? '',
    }))

    const totalIncoming = rows.filter(r => r.direction === 'INCOMING').reduce((s, r) => s + r.amount, 0)
    const totalOutgoing = rows.filter(r => r.direction === 'OUTGOING').reduce((s, r) => s + r.amount, 0)

    // Group by method
    const byMethod: Record<string, { incoming: number; outgoing: number; count: number }> = {}
    for (const r of rows) {
      const m = r.paymentMethod || '未指定'
      if (!byMethod[m]) byMethod[m] = { incoming: 0, outgoing: 0, count: 0 }
      if (r.direction === 'INCOMING') byMethod[m].incoming += r.amount
      else byMethod[m].outgoing += r.amount
      byMethod[m].count++
    }

    return NextResponse.json({
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      summary: {
        totalIncoming: Math.round(totalIncoming * 100) / 100,
        totalOutgoing: Math.round(totalOutgoing * 100) / 100,
        netFlow: Math.round((totalIncoming - totalOutgoing) * 100) / 100,
        count: rows.length,
      },
      byMethod: Object.entries(byMethod).map(([m, v]) => ({ method: m, ...v })),
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.cash-movement.GET')
  }
}
