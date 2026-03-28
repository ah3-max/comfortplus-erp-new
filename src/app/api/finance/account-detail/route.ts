import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// 科目/客戶/供應商明細帳
// Shows journal lines for one or more accounts, optionally filtered by referenceType
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const accountIds = searchParams.getAll('accountId')
    const referenceType = searchParams.get('referenceType') || undefined
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!accountIds.length) return NextResponse.json({ error: '請選擇至少一個科目' }, { status: 400 })

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const accounts = await prisma.accountingAccount.findMany({
      where: { id: { in: accountIds } },
      orderBy: { code: 'asc' },
    })

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: accountIds },
        entry: {
          status: 'POSTED',
          entryDate: { gte: periodStart, lte: periodEnd },
          ...(referenceType && { referenceType }),
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true, normalBalance: true } },
        entry: {
          select: {
            id: true, entryNo: true, entryDate: true, description: true,
            referenceType: true, referenceId: true, entryType: true,
          },
        },
      },
      orderBy: [{ account: { code: 'asc' } }, { entry: { entryDate: 'asc' } }, { lineNo: 'asc' }],
    })

    // Group by accountId with running balance
    type AccountGroup = {
      accountId: string; code: string; name: string; normalBalance: string
      periodDebit: number; periodCredit: number
      rows: Array<{
        id: string; entryNo: string; entryDate: string; description: string
        referenceType: string | null; referenceId: string | null; entryType: string
        debit: number; credit: number; runningBalance: number
      }>
    }
    const grouped = new Map<string, AccountGroup>()

    for (const acc of accounts) {
      // Compute opening balance
      const openingAgg = await prisma.journalEntryLine.aggregate({
        where: {
          accountId: acc.id,
          entry: { status: 'POSTED', entryDate: { lt: periodStart } },
        },
        _sum: { debit: true, credit: true },
      })
      const openD = Number(openingAgg._sum.debit ?? 0)
      const openC = Number(openingAgg._sum.credit ?? 0)
      const openingBal = acc.normalBalance === 'DEBIT' ? openD - openC : openC - openD

      grouped.set(acc.id, {
        accountId: acc.id, code: acc.code, name: acc.name, normalBalance: acc.normalBalance,
        periodDebit: 0, periodCredit: 0,
        rows: [{ id: 'opening', entryNo: '', entryDate: periodStart.toISOString().slice(0, 10), description: '期初餘額', referenceType: null, referenceId: null, entryType: '', debit: 0, credit: 0, runningBalance: openingBal }],
      })
    }

    for (const line of lines) {
      const g = grouped.get(line.accountId)
      if (!g) continue
      const debit = Number(line.debit)
      const credit = Number(line.credit)
      g.periodDebit += debit
      g.periodCredit += credit
      const prev = g.rows[g.rows.length - 1].runningBalance
      const runningBalance = g.normalBalance === 'DEBIT'
        ? prev + debit - credit
        : prev + credit - debit
      g.rows.push({
        id: line.id, entryNo: line.entry.entryNo,
        entryDate: line.entry.entryDate.toISOString().slice(0, 10),
        description: line.description ?? line.entry.description,
        referenceType: line.entry.referenceType, referenceId: line.entry.referenceId,
        entryType: line.entry.entryType,
        debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100,
        runningBalance: Math.round(runningBalance * 100) / 100,
      })
    }

    return NextResponse.json({
      groups: Array.from(grouped.values()),
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
    })
  } catch (error) {
    return handleApiError(error, 'finance.account-detail.GET')
  }
}
