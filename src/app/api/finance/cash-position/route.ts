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
    const asOf = searchParams.get('asOf')
    const asOfDate = asOf ? new Date(asOf) : new Date()
    asOfDate.setHours(23, 59, 59, 999)

    const records = await prisma.paymentRecord.findMany({
      where: { paymentDate: { lte: asOfDate } },
      select: { direction: true, amount: true, bankAccount: true, paymentMethod: true, paymentDate: true },
    })

    // Group by bankAccount
    const accountMap: Record<string, { incoming: number; outgoing: number; lastTx: string }> = {}
    const TOTAL_KEY = '__TOTAL__'
    accountMap[TOTAL_KEY] = { incoming: 0, outgoing: 0, lastTx: '' }

    for (const r of records) {
      const key = r.bankAccount || r.paymentMethod || '未分類'
      if (!accountMap[key]) accountMap[key] = { incoming: 0, outgoing: 0, lastTx: '' }
      const amt = Number(r.amount)
      if (r.direction === 'INCOMING') {
        accountMap[key].incoming += amt
        accountMap[TOTAL_KEY].incoming += amt
      } else {
        accountMap[key].outgoing += amt
        accountMap[TOTAL_KEY].outgoing += amt
      }
      const txDate = r.paymentDate.toISOString().slice(0, 10)
      if (!accountMap[key].lastTx || txDate > accountMap[key].lastTx) accountMap[key].lastTx = txDate
    }

    const accounts = Object.entries(accountMap)
      .filter(([k]) => k !== TOTAL_KEY)
      .map(([account, v]) => ({
        account,
        incoming: Math.round(v.incoming * 100) / 100,
        outgoing: Math.round(v.outgoing * 100) / 100,
        balance: Math.round((v.incoming - v.outgoing) * 100) / 100,
        lastTx: v.lastTx,
      }))
      .sort((a, b) => b.balance - a.balance)

    const total = accountMap[TOTAL_KEY]
    return NextResponse.json({
      asOf: asOfDate.toISOString().slice(0, 10),
      totalIncoming: Math.round(total.incoming * 100) / 100,
      totalOutgoing: Math.round(total.outgoing * 100) / 100,
      totalBalance: Math.round((total.incoming - total.outgoing) * 100) / 100,
      accounts,
    })
  } catch (error) {
    return handleApiError(error, 'finance.cash-position.GET')
  }
}
