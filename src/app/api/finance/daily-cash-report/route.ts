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

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    // Opening balance: all payments before period
    const openingIn = await prisma.paymentRecord.aggregate({
      where: { direction: 'INCOMING', paymentDate: { lt: periodStart } },
      _sum: { amount: true },
    })
    const openingOut = await prisma.paymentRecord.aggregate({
      where: { direction: 'OUTGOING', paymentDate: { lt: periodStart } },
      _sum: { amount: true },
    })
    const openingBalance = Number(openingIn._sum.amount ?? 0) - Number(openingOut._sum.amount ?? 0)

    // Period records
    const records = await prisma.paymentRecord.findMany({
      where: { paymentDate: { gte: periodStart, lte: periodEnd } },
      orderBy: { paymentDate: 'asc' },
      select: { paymentDate: true, direction: true, amount: true, bankAccount: true },
    })

    // Group by date
    const dayMap: Record<string, { incoming: number; outgoing: number; accounts: Set<string> }> = {}
    for (const r of records) {
      const day = r.paymentDate.toISOString().slice(0, 10)
      if (!dayMap[day]) dayMap[day] = { incoming: 0, outgoing: 0, accounts: new Set() }
      if (r.direction === 'INCOMING') dayMap[day].incoming += Number(r.amount)
      else dayMap[day].outgoing += Number(r.amount)
      if (r.bankAccount) dayMap[day].accounts.add(r.bankAccount)
    }

    let running = openingBalance
    const rows = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => {
        running += v.incoming - v.outgoing
        return {
          date,
          incoming: Math.round(v.incoming * 100) / 100,
          outgoing: Math.round(v.outgoing * 100) / 100,
          net: Math.round((v.incoming - v.outgoing) * 100) / 100,
          closingBalance: Math.round(running * 100) / 100,
          accounts: [...v.accounts].join(', '),
        }
      })

    const periodIncoming = rows.reduce((s, r) => s + r.incoming, 0)
    const periodOutgoing = rows.reduce((s, r) => s + r.outgoing, 0)

    return NextResponse.json({
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      openingBalance: Math.round(openingBalance * 100) / 100,
      periodIncoming: Math.round(periodIncoming * 100) / 100,
      periodOutgoing: Math.round(periodOutgoing * 100) / 100,
      closingBalance: Math.round(running * 100) / 100,
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.daily-cash-report.GET')
  }
}
