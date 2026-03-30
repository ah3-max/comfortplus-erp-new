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

    // Revenue for the year
    const revenueAgg = await prisma.journalEntryLine.aggregate({
      where: { account: { type: 'REVENUE' }, entry: { status: 'POSTED', entryDate: { gte: yearStart, lte: yearEnd } } },
      _sum: { credit: true, debit: true },
    })
    const annualRevenue = Number(revenueAgg._sum.credit ?? 0) - Number(revenueAgg._sum.debit ?? 0)

    // Purchase/expense for the year
    const expenseAgg = await prisma.journalEntryLine.aggregate({
      where: { account: { type: 'EXPENSE' }, entry: { status: 'POSTED', entryDate: { gte: yearStart, lte: yearEnd } } },
      _sum: { debit: true, credit: true },
    })
    const annualExpense = Number(expenseAgg._sum.debit ?? 0) - Number(expenseAgg._sum.credit ?? 0)

    // AR averages
    const arStart = await prisma.accountsReceivable.aggregate({
      where: { createdAt: { lt: yearStart }, status: { not: 'PAID' } },
      _sum: { amount: true, paidAmount: true },
    })
    const arEnd = await prisma.accountsReceivable.aggregate({
      where: { createdAt: { lte: yearEnd }, status: { not: 'PAID' } },
      _sum: { amount: true, paidAmount: true },
    })
    const arBalStart = Number(arStart._sum.amount ?? 0) - Number(arStart._sum.paidAmount ?? 0)
    const arBalEnd = Number(arEnd._sum.amount ?? 0) - Number(arEnd._sum.paidAmount ?? 0)
    const avgAR = (arBalStart + arBalEnd) / 2

    // AP averages
    const apStart = await prisma.accountsPayable.aggregate({
      where: { createdAt: { lt: yearStart }, status: { not: 'PAID' } },
      _sum: { amount: true, paidAmount: true },
    })
    const apEnd = await prisma.accountsPayable.aggregate({
      where: { createdAt: { lte: yearEnd }, status: { not: 'PAID' } },
      _sum: { amount: true, paidAmount: true },
    })
    const apBalStart = Number(apStart._sum.amount ?? 0) - Number(apStart._sum.paidAmount ?? 0)
    const apBalEnd = Number(apEnd._sum.amount ?? 0) - Number(apEnd._sum.paidAmount ?? 0)
    const avgAP = (apBalStart + apBalEnd) / 2

    // Turnover ratios
    const arTurnover = avgAR > 0 ? annualRevenue / avgAR : 0
    const apTurnover = avgAP > 0 ? annualExpense / avgAP : 0
    const arDays = arTurnover > 0 ? 365 / arTurnover : 0
    const apDays = apTurnover > 0 ? 365 / apTurnover : 0

    const r = (n: number) => Math.round(n * 100) / 100

    return NextResponse.json({
      year,
      revenue: r(annualRevenue),
      expense: r(annualExpense),
      ar: {
        opening: r(arBalStart), closing: r(arBalEnd), average: r(avgAR),
        turnover: r(arTurnover), dso: r(arDays),
      },
      ap: {
        opening: r(apBalStart), closing: r(apBalEnd), average: r(avgAP),
        turnover: r(apTurnover), dpo: r(apDays),
      },
      cashConversionCycle: r(arDays - apDays),
    })
  } catch (error) {
    return handleApiError(error, 'finance.ar-ap-turnover.GET')
  }
}
