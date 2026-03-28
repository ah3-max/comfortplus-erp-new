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

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    // Get all active accounts
    const accounts = await prisma.accountingAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    })

    // Get all POSTED journal entry lines with entry date info
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        entry: { status: 'POSTED' },
      },
      include: {
        entry: { select: { entryDate: true } },
      },
    })

    // Build per-account aggregates
    const accountMap = new Map<string, {
      openingDebit: number
      openingCredit: number
      periodDebit: number
      periodCredit: number
    }>()

    for (const acc of accounts) {
      accountMap.set(acc.id, { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0 })
    }

    for (const line of lines) {
      const entry = accountMap.get(line.accountId)
      if (!entry) continue
      const entryDate = new Date(line.entry.entryDate)
      const debit = Number(line.debit)
      const credit = Number(line.credit)

      if (entryDate < periodStart) {
        entry.openingDebit += debit
        entry.openingCredit += credit
      } else if (entryDate <= periodEnd) {
        entry.periodDebit += debit
        entry.periodCredit += credit
      }
    }

    // Build rows — skip accounts with zero activity
    const rows = accounts.map(acc => {
      const agg = accountMap.get(acc.id) ?? { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0 }
      const closingDebit = agg.openingDebit + agg.periodDebit
      const closingCredit = agg.openingCredit + agg.periodCredit
      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        normalBalance: acc.normalBalance,
        openingDebit: Math.round(agg.openingDebit * 100) / 100,
        openingCredit: Math.round(agg.openingCredit * 100) / 100,
        periodDebit: Math.round(agg.periodDebit * 100) / 100,
        periodCredit: Math.round(agg.periodCredit * 100) / 100,
        closingDebit: Math.round(closingDebit * 100) / 100,
        closingCredit: Math.round(closingCredit * 100) / 100,
      }
    }).filter(r =>
      r.openingDebit !== 0 || r.openingCredit !== 0 ||
      r.periodDebit !== 0 || r.periodCredit !== 0 ||
      r.closingDebit !== 0 || r.closingCredit !== 0
    )

    // Totals
    const totals = rows.reduce((s, r) => ({
      openingDebit: s.openingDebit + r.openingDebit,
      openingCredit: s.openingCredit + r.openingCredit,
      periodDebit: s.periodDebit + r.periodDebit,
      periodCredit: s.periodCredit + r.periodCredit,
      closingDebit: s.closingDebit + r.closingDebit,
      closingCredit: s.closingCredit + r.closingCredit,
    }), { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0 })

    const isBalanced = Math.abs(totals.closingDebit - totals.closingCredit) < 0.01

    return NextResponse.json({
      rows,
      totals: Object.fromEntries(
        Object.entries(totals).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
      isBalanced,
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
    })
  } catch (error) {
    return handleApiError(error, 'finance.trial-balance.GET')
  }
}
