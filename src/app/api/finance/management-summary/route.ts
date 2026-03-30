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
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

    const periodStart = new Date(year, month - 1, 1)
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999)
    const prevStart = new Date(year, month - 2, 1)
    const prevEnd = new Date(year, month - 1, 0, 23, 59, 59, 999)

    const [revCur, revPrev, expCur, expPrev] = await Promise.all([
      prisma.journalEntryLine.aggregate({ where: { account: { type: 'REVENUE' }, entry: { status: 'POSTED', entryDate: { gte: periodStart, lte: periodEnd } } }, _sum: { credit: true, debit: true } }),
      prisma.journalEntryLine.aggregate({ where: { account: { type: 'REVENUE' }, entry: { status: 'POSTED', entryDate: { gte: prevStart, lte: prevEnd } } }, _sum: { credit: true, debit: true } }),
      prisma.journalEntryLine.aggregate({ where: { account: { type: 'EXPENSE' }, entry: { status: 'POSTED', entryDate: { gte: periodStart, lte: periodEnd } } }, _sum: { debit: true, credit: true } }),
      prisma.journalEntryLine.aggregate({ where: { account: { type: 'EXPENSE' }, entry: { status: 'POSTED', entryDate: { gte: prevStart, lte: prevEnd } } }, _sum: { debit: true, credit: true } }),
    ])

    const revenue = Number(revCur._sum.credit ?? 0) - Number(revCur._sum.debit ?? 0)
    const revenuePrev = Number(revPrev._sum.credit ?? 0) - Number(revPrev._sum.debit ?? 0)
    const expense = Number(expCur._sum.debit ?? 0) - Number(expCur._sum.credit ?? 0)
    const expensePrev = Number(expPrev._sum.debit ?? 0) - Number(expPrev._sum.credit ?? 0)

    const [arAgg, apAgg, orderAgg, payAgg] = await Promise.all([
      prisma.accountsReceivable.aggregate({ where: { status: { not: 'PAID' } }, _sum: { amount: true, paidAmount: true }, _count: true }),
      prisma.accountsPayable.aggregate({ where: { status: { not: 'PAID' } }, _sum: { amount: true, paidAmount: true }, _count: true }),
      prisma.salesOrder.aggregate({ where: { orderDate: { gte: periodStart, lte: periodEnd } }, _sum: { totalAmount: true }, _count: true }),
      prisma.paymentRecord.aggregate({ where: { direction: 'INCOMING', paymentDate: { gte: periodStart, lte: periodEnd } }, _sum: { amount: true }, _count: true }),
    ])

    const arBalance = Number(arAgg._sum.amount ?? 0) - Number(arAgg._sum.paidAmount ?? 0)
    const apBalance = Number(apAgg._sum.amount ?? 0) - Number(apAgg._sum.paidAmount ?? 0)

    function pctChange(cur: number, prev: number) {
      if (prev === 0) return null
      return Math.round((cur - prev) / prev * 1000) / 10
    }
    const r = (n: number) => Math.round(n * 100) / 100

    return NextResponse.json({
      period: { year, month },
      kpis: [
        { key: 'revenue', label: '本月收入', value: r(revenue), prev: r(revenuePrev), change: pctChange(revenue, revenuePrev), unit: 'TWD' },
        { key: 'expense', label: '本月費用', value: r(expense), prev: r(expensePrev), change: pctChange(expense, expensePrev), unit: 'TWD' },
        { key: 'netIncome', label: '本月淨利', value: r(revenue - expense), prev: r(revenuePrev - expensePrev), change: pctChange(revenue - expense, revenuePrev - expensePrev), unit: 'TWD' },
        { key: 'grossMargin', label: '毛利率', value: revenue > 0 ? r((revenue - expense) / revenue * 100) : 0, prev: null, change: null, unit: '%' },
        { key: 'arBalance', label: '應收帳款', value: r(arBalance), prev: null, change: null, unit: 'TWD', sub: `${arAgg._count} 筆` },
        { key: 'apBalance', label: '應付帳款', value: r(apBalance), prev: null, change: null, unit: 'TWD', sub: `${apAgg._count} 筆` },
        { key: 'orderAmount', label: '本月訂單', value: r(Number(orderAgg._sum.totalAmount ?? 0)), prev: null, change: null, unit: 'TWD', sub: `${orderAgg._count} 單` },
        { key: 'cashReceived', label: '本月收款', value: r(Number(payAgg._sum.amount ?? 0)), prev: null, change: null, unit: 'TWD', sub: `${payAgg._count} 筆` },
      ],
    })
  } catch (error) {
    return handleApiError(error, 'finance.management-summary.GET')
  }
}
