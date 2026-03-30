import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// 科目摘要明細帳：按科目 + 摘要分組，顯示每個摘要的借貸合計
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

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const where = {
      entry: {
        status: 'POSTED',
        entryDate: { gte: periodStart, lte: periodEnd },
      },
      ...(accountId && { accountId }),
    }

    const lines = await prisma.journalEntryLine.findMany({
      where,
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
        entry: { select: { entryDate: true, description: true, referenceType: true } },
      },
      orderBy: [{ account: { code: 'asc' } }, { entry: { entryDate: 'asc' } }],
    })

    // Group by accountId → description
    type SummaryRow = { description: string; referenceType: string | null; count: number; debit: number; credit: number }
    type AccountGroup = {
      accountId: string; code: string; name: string; type: string
      summaries: Map<string, SummaryRow>
      totalDebit: number; totalCredit: number
    }
    const grouped = new Map<string, AccountGroup>()

    for (const line of lines) {
      const key = line.accountId
      if (!grouped.has(key)) {
        grouped.set(key, {
          accountId: line.account.id, code: line.account.code,
          name: line.account.name, type: line.account.type,
          summaries: new Map(), totalDebit: 0, totalCredit: 0,
        })
      }
      const g = grouped.get(key)!
      const desc = line.description ?? line.entry.description
      if (!g.summaries.has(desc)) {
        g.summaries.set(desc, { description: desc, referenceType: line.entry.referenceType, count: 0, debit: 0, credit: 0 })
      }
      const s = g.summaries.get(desc)!
      s.count++
      s.debit += Number(line.debit)
      s.credit += Number(line.credit)
      g.totalDebit += Number(line.debit)
      g.totalCredit += Number(line.credit)
    }

    const result = Array.from(grouped.values()).map(g => ({
      accountId: g.accountId, code: g.code, name: g.name, type: g.type,
      totalDebit: Math.round(g.totalDebit * 100) / 100,
      totalCredit: Math.round(g.totalCredit * 100) / 100,
      summaries: Array.from(g.summaries.values())
        .sort((a, b) => (b.debit + b.credit) - (a.debit + a.credit))
        .map(s => ({
          ...s,
          debit: Math.round(s.debit * 100) / 100,
          credit: Math.round(s.credit * 100) / 100,
        })),
    }))

    return NextResponse.json({
      groups: result,
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
    })
  } catch (error) {
    return handleApiError(error, 'finance.account-summary.GET')
  }
}
