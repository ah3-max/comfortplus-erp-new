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
    const prevYearEnd = new Date(year - 1, 11, 31, 23, 59, 59, 999)

    // 1. Opening retained earnings: EQUITY account balance at end of prior year
    const equityPrev = await prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        account: { type: 'EQUITY' },
        entry: { status: 'POSTED', entryDate: { lte: prevYearEnd } },
      },
      _sum: { debit: true, credit: true },
    })

    // Get account details for equity
    const equityAccountIds = equityPrev.map(e => e.accountId)
    const equityAccounts = await prisma.accountingAccount.findMany({
      where: { id: { in: equityAccountIds } },
      select: { id: true, code: true, name: true, normalBalance: true },
    })
    const accMap = Object.fromEntries(equityAccounts.map(a => [a.id, a]))

    const openingBalance = equityPrev.reduce((sum, e) => {
      const acc = accMap[e.accountId]
      const debit = Number(e._sum.debit ?? 0)
      const credit = Number(e._sum.credit ?? 0)
      const bal = acc?.normalBalance === 'CREDIT' ? credit - debit : debit - credit
      return sum + bal
    }, 0)

    // 2. Net income for the year
    const revenueAgg = await prisma.journalEntryLine.aggregate({
      where: {
        account: { type: 'REVENUE' },
        entry: { status: 'POSTED', entryDate: { gte: yearStart, lte: yearEnd } },
      },
      _sum: { credit: true, debit: true },
    })
    const expenseAgg = await prisma.journalEntryLine.aggregate({
      where: {
        account: { type: 'EXPENSE' },
        entry: { status: 'POSTED', entryDate: { gte: yearStart, lte: yearEnd } },
      },
      _sum: { debit: true, credit: true },
    })
    const netIncome = (Number(revenueAgg._sum.credit ?? 0) - Number(revenueAgg._sum.debit ?? 0))
      - (Number(expenseAgg._sum.debit ?? 0) - Number(expenseAgg._sum.credit ?? 0))

    // 3. Dividends paid
    const dividendAgg = await prisma.paymentRecord.aggregate({
      where: {
        direction: 'OUTGOING',
        paymentDate: { gte: yearStart, lte: yearEnd },
        OR: [
          { notes: { contains: '股利' } },
          { notes: { contains: '分配' } },
          { notes: { contains: 'dividend' } },
        ],
      },
      _sum: { amount: true },
    })
    const dividendsPaid = Number(dividendAgg._sum.amount ?? 0)

    // 4. Equity breakdown for current year
    const equityCurrent = await prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        account: { type: 'EQUITY' },
        entry: { status: 'POSTED', entryDate: { lte: yearEnd } },
      },
      _sum: { debit: true, credit: true },
    })

    const allEquityIds = [...new Set([...equityAccountIds, ...equityCurrent.map(e => e.accountId)])]
    const allEquityAccounts = await prisma.accountingAccount.findMany({
      where: { id: { in: allEquityIds } },
      select: { id: true, code: true, name: true, normalBalance: true },
      orderBy: { code: 'asc' },
    })

    const currentBalMap = Object.fromEntries(equityCurrent.map(e => [e.accountId, e]))
    const equityBreakdown = allEquityAccounts.map(acc => {
      const b = currentBalMap[acc.id]
      const debit = Number(b?._sum.debit ?? 0)
      const credit = Number(b?._sum.credit ?? 0)
      const balance = acc.normalBalance === 'CREDIT' ? credit - debit : debit - credit
      return {
        accountCode: acc.code,
        accountName: acc.name,
        debitTotal: Math.round(debit * 100) / 100,
        creditTotal: Math.round(credit * 100) / 100,
        balance: Math.round(balance * 100) / 100,
      }
    })

    const r = (n: number) => Math.round(n * 100) / 100
    const closingBalance = openingBalance + netIncome - dividendsPaid

    return NextResponse.json({
      year,
      openingBalance: r(openingBalance),
      netIncome: r(netIncome),
      dividendsPaid: r(dividendsPaid),
      closingBalance: r(closingBalance),
      equityBreakdown,
    })
  } catch (error) {
    return handleApiError(error, 'finance.retained-earnings.GET')
  }
}
