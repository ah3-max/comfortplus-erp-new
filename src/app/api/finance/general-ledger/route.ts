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
    const accountId = searchParams.get('accountId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!accountId) return NextResponse.json({ error: '請選擇科目' }, { status: 400 })

    const account = await prisma.accountingAccount.findUnique({
      where: { id: accountId },
      select: { id: true, code: true, name: true, type: true, normalBalance: true },
    })
    if (!account) return NextResponse.json({ error: '科目不存在' }, { status: 404 })

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    // Opening balance: sum all POSTED lines before periodStart
    const openingAgg = await prisma.journalEntryLine.aggregate({
      where: {
        accountId,
        entry: { status: 'POSTED', entryDate: { lt: periodStart } },
      },
      _sum: { debit: true, credit: true },
    })
    const openingDebit = Number(openingAgg._sum.debit ?? 0)
    const openingCredit = Number(openingAgg._sum.credit ?? 0)

    // Period lines
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId,
        entry: {
          status: 'POSTED',
          entryDate: { gte: periodStart, lte: periodEnd },
        },
      },
      include: {
        entry: {
          select: {
            id: true, entryNo: true, entryDate: true, description: true,
            referenceType: true, referenceId: true, entryType: true,
          },
        },
      },
      orderBy: [{ entry: { entryDate: 'asc' } }, { lineNo: 'asc' }],
    })

    // Build rows with running balance
    let runningDebit = openingDebit
    let runningCredit = openingCredit

    const rows = lines.map(line => {
      const debit = Number(line.debit)
      const credit = Number(line.credit)
      runningDebit += debit
      runningCredit += credit

      // Net balance: for DEBIT-normal accounts, balance = debit - credit
      const balance = account.normalBalance === 'DEBIT'
        ? runningDebit - runningCredit
        : runningCredit - runningDebit

      return {
        id: line.id,
        entryId: line.entry.id,
        entryNo: line.entry.entryNo,
        entryDate: line.entry.entryDate.toISOString().slice(0, 10),
        description: line.description ?? line.entry.description,
        entryType: line.entry.entryType,
        referenceType: line.entry.referenceType,
        referenceId: line.entry.referenceId,
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
        balance: Math.round(balance * 100) / 100,
      }
    })

    const openingBalance = account.normalBalance === 'DEBIT'
      ? openingDebit - openingCredit
      : openingCredit - openingDebit

    const periodDebitTotal = lines.reduce((s, l) => s + Number(l.debit), 0)
    const periodCreditTotal = lines.reduce((s, l) => s + Number(l.credit), 0)
    const closingBalance = account.normalBalance === 'DEBIT'
      ? runningDebit - runningCredit
      : runningCredit - runningDebit

    return NextResponse.json({
      account,
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      openingBalance: Math.round(openingBalance * 100) / 100,
      periodDebitTotal: Math.round(periodDebitTotal * 100) / 100,
      periodCreditTotal: Math.round(periodCreditTotal * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.general-ledger.GET')
  }
}
