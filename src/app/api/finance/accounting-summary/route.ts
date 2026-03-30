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

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const lines = await prisma.journalEntryLine.findMany({
      where: { entry: { status: 'POSTED', entryDate: { gte: periodStart, lte: periodEnd } } },
      include: { account: { select: { type: true, name: true } } },
    })

    const typeMap: Record<string, { debit: number; credit: number; count: number }> = {}
    for (const line of lines) {
      const t = line.account.type
      if (!typeMap[t]) typeMap[t] = { debit: 0, credit: 0, count: 0 }
      typeMap[t].debit += Number(line.debit)
      typeMap[t].credit += Number(line.credit)
      typeMap[t].count++
    }

    const typeLabels: Record<string, string> = { ASSET: '資產', LIABILITY: '負債', EQUITY: '權益', REVENUE: '收入', EXPENSE: '費用' }
    const rows = Object.entries(typeMap).map(([type, v]) => ({
      type, label: typeLabels[type] ?? type,
      debitTotal: Math.round(v.debit * 100) / 100,
      creditTotal: Math.round(v.credit * 100) / 100,
      net: Math.round((v.debit - v.credit) * 100) / 100,
      lineCount: v.count,
    })).sort((a, b) => b.debitTotal - a.debitTotal)

    const totalDebit = rows.reduce((s, r) => s + r.debitTotal, 0)
    const totalCredit = rows.reduce((s, r) => s + r.creditTotal, 0)

    // Entry count
    const entryCount = await prisma.journalEntry.count({
      where: { status: 'POSTED', entryDate: { gte: periodStart, lte: periodEnd } },
    })

    return NextResponse.json({
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      entryCount,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.accounting-summary.GET')
  }
}
