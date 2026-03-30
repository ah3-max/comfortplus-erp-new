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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') ?? 'method' // method / type / month

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const records = await prisma.paymentRecord.findMany({
      where: { paymentDate: { gte: periodStart, lte: periodEnd } },
      select: { direction: true, amount: true, paymentMethod: true, paymentType: true, paymentDate: true },
    })

    const inMap: Record<string, number> = {}
    const outMap: Record<string, number> = {}

    for (const r of records) {
      let key: string
      if (groupBy === 'type') key = r.paymentType
      else if (groupBy === 'month') key = r.paymentDate.toISOString().slice(0, 7)
      else key = r.paymentMethod || '未指定'

      if (r.direction === 'INCOMING') inMap[key] = (inMap[key] ?? 0) + Number(r.amount)
      else outMap[key] = (outMap[key] ?? 0) + Number(r.amount)
    }

    const allKeys = [...new Set([...Object.keys(inMap), ...Object.keys(outMap)])]
    const rows = allKeys
      .map(key => ({
        key,
        incoming: Math.round((inMap[key] ?? 0) * 100) / 100,
        outgoing: Math.round((outMap[key] ?? 0) * 100) / 100,
        net: Math.round(((inMap[key] ?? 0) - (outMap[key] ?? 0)) * 100) / 100,
      }))
      .sort((a, b) => (b.incoming + b.outgoing) - (a.incoming + a.outgoing))

    const totalIncoming = rows.reduce((s, r) => s + r.incoming, 0)
    const totalOutgoing = rows.reduce((s, r) => s + r.outgoing, 0)

    return NextResponse.json({
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      groupBy,
      summary: {
        totalIncoming: Math.round(totalIncoming * 100) / 100,
        totalOutgoing: Math.round(totalOutgoing * 100) / 100,
        netFlow: Math.round((totalIncoming - totalOutgoing) * 100) / 100,
      },
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.cash-inout-detail.GET')
  }
}
