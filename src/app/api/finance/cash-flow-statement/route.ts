import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)
    const prevYearEnd = new Date(year - 1, 11, 31, 23, 59, 59, 999)

    // 1. Net income from journal entries
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
    const totalRevenue = Number(revenueAgg._sum.credit ?? 0) - Number(revenueAgg._sum.debit ?? 0)
    const totalExpense = Number(expenseAgg._sum.debit ?? 0) - Number(expenseAgg._sum.credit ?? 0)
    const netIncome = totalRevenue - totalExpense

    // 2. AR change: prior year AR balance vs current year
    const arCurrent = await prisma.accountsReceivable.aggregate({
      where: { createdAt: { lte: yearEnd }, status: { not: 'PAID' } },
      _sum: { amount: true, paidAmount: true },
    })
    const arPrev = await prisma.accountsReceivable.aggregate({
      where: { createdAt: { lte: prevYearEnd }, status: { not: 'PAID' } },
      _sum: { amount: true, paidAmount: true },
    })
    const arBalCurrent = Number(arCurrent._sum.amount ?? 0) - Number(arCurrent._sum.paidAmount ?? 0)
    const arBalPrev = Number(arPrev._sum.amount ?? 0) - Number(arPrev._sum.paidAmount ?? 0)
    const arChange = arBalPrev - arBalCurrent // positive = AR decreased = cash inflow

    // 3. AP change
    const apCurrent = await prisma.accountsPayable.aggregate({
      where: { createdAt: { lte: yearEnd }, status: { not: 'PAID' } },
      _sum: { amount: true, paidAmount: true },
    })
    const apPrev = await prisma.accountsPayable.aggregate({
      where: { createdAt: { lte: prevYearEnd }, status: { not: 'PAID' } },
      _sum: { amount: true, paidAmount: true },
    })
    const apBalCurrent = Number(apCurrent._sum.amount ?? 0) - Number(apCurrent._sum.paidAmount ?? 0)
    const apBalPrev = Number(apPrev._sum.amount ?? 0) - Number(apPrev._sum.paidAmount ?? 0)
    const apChange = apBalCurrent - apBalPrev // positive = AP increased = cash inflow

    const operatingTotal = netIncome + arChange + apChange

    // 4. Investing: fixed asset acquisitions this year
    const assetAgg = await prisma.fixedAsset.aggregate({
      where: { purchaseDate: { gte: yearStart, lte: yearEnd } },
      _sum: { purchaseAmount: true },
    })
    const assetAcquisitions = -(Number(assetAgg._sum.purchaseAmount ?? 0))
    const investingTotal = assetAcquisitions

    // 5. Financing: payments with keywords in notes
    const borrowAgg = await prisma.paymentRecord.aggregate({
      where: {
        direction: 'INCOMING',
        paymentDate: { gte: yearStart, lte: yearEnd },
        notes: { contains: '借款' },
      },
      _sum: { amount: true },
    })
    const repayAgg = await prisma.paymentRecord.aggregate({
      where: {
        direction: 'OUTGOING',
        paymentDate: { gte: yearStart, lte: yearEnd },
        notes: { contains: '還款' },
      },
      _sum: { amount: true },
    })
    const borrowings = Number(borrowAgg._sum.amount ?? 0)
    const repayments = -(Number(repayAgg._sum.amount ?? 0))
    const financingTotal = borrowings + repayments

    // 6. Opening cash (all incoming - outgoing before year start)
    const cashInPrev = await prisma.paymentRecord.aggregate({
      where: { direction: 'INCOMING', paymentDate: { lt: yearStart } },
      _sum: { amount: true },
    })
    const cashOutPrev = await prisma.paymentRecord.aggregate({
      where: { direction: 'OUTGOING', paymentDate: { lt: yearStart } },
      _sum: { amount: true },
    })
    const openingCash = Number(cashInPrev._sum.amount ?? 0) - Number(cashOutPrev._sum.amount ?? 0)
    const netCashChange = operatingTotal + investingTotal + financingTotal
    const closingCash = openingCash + netCashChange

    const r = (n: number) => Math.round(n * 100) / 100

    return NextResponse.json({
      year,
      operating: {
        netIncome: r(netIncome),
        arChange: r(arChange),
        apChange: r(apChange),
        total: r(operatingTotal),
      },
      investing: {
        assetAcquisitions: r(assetAcquisitions),
        total: r(investingTotal),
      },
      financing: {
        borrowings: r(borrowings),
        repayments: r(repayments),
        total: r(financingTotal),
      },
      netCashChange: r(netCashChange),
      openingCash: r(openingCash),
      closingCash: r(closingCash),
    })
  } catch (error) {
    return handleApiError(error, 'finance.cash-flow-statement.GET')
  }
}
