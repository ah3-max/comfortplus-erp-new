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
      where: {
        account: { type: { in: ['REVENUE', 'EXPENSE'] } },
        entry: { status: 'POSTED', entryDate: { gte: periodStart, lte: periodEnd } },
      },
      include: {
        account: { select: { code: true, name: true, type: true } },
        entry: { select: { entryNo: true, entryDate: true, description: true } },
      },
      orderBy: { entry: { entryDate: 'asc' } },
    })

    const revenueRows = lines
      .filter(l => l.account.type === 'REVENUE')
      .map(l => ({
        date: l.entry.entryDate.toISOString().slice(0, 10),
        entryNo: l.entry.entryNo,
        description: l.description ?? l.entry.description,
        accountCode: l.account.code,
        accountName: l.account.name,
        amount: Math.round((Number(l.credit) - Number(l.debit)) * 100) / 100,
      }))

    const expenseRows = lines
      .filter(l => l.account.type === 'EXPENSE')
      .map(l => ({
        date: l.entry.entryDate.toISOString().slice(0, 10),
        entryNo: l.entry.entryNo,
        description: l.description ?? l.entry.description,
        accountCode: l.account.code,
        accountName: l.account.name,
        amount: Math.round((Number(l.debit) - Number(l.credit)) * 100) / 100,
      }))

    const totalRevenue = revenueRows.reduce((s, r) => s + r.amount, 0)
    const totalExpense = expenseRows.reduce((s, r) => s + r.amount, 0)

    return NextResponse.json({
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        netIncome: Math.round((totalRevenue - totalExpense) * 100) / 100,
        revenueCount: revenueRows.length,
        expenseCount: expenseRows.length,
      },
      revenueRows,
      expenseRows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.income-expense-detail.GET')
  }
}
