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

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        account: { type: 'EXPENSE' },
        entry: { status: 'POSTED', entryDate: { gte: yearStart, lte: yearEnd } },
      },
      include: {
        account: { select: { code: true, name: true, subType: true } },
        entry: { select: { entryDate: true } },
      },
    })

    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const totalByMonth: number[] = Array(12).fill(0)
    const accountMonthly: Record<string, { code: string; name: string; subType: string | null; monthly: number[] }> = {}

    for (const line of lines) {
      const m = line.entry.entryDate.getMonth()
      const amt = Number(line.debit) - Number(line.credit)
      totalByMonth[m] += amt

      const key = line.account.code
      if (!accountMonthly[key]) {
        accountMonthly[key] = { code: line.account.code, name: line.account.name, subType: line.account.subType, monthly: Array(12).fill(0) }
      }
      accountMonthly[key].monthly[m] += amt
    }

    const r = (n: number) => Math.round(n * 100) / 100

    return NextResponse.json({
      year,
      months,
      totalByMonth: totalByMonth.map(r),
      grandTotal: r(totalByMonth.reduce((s, v) => s + v, 0)),
      accounts: Object.values(accountMonthly).map(a => ({
        ...a,
        monthly: a.monthly.map(r),
        total: r(a.monthly.reduce((s, v) => s + v, 0)),
      })).sort((a, b) => b.total - a.total),
    })
  } catch (error) {
    return handleApiError(error, 'finance.monthly-cost.GET')
  }
}
