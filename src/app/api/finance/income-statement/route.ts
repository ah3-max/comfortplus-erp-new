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
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    // Date range
    let startDate: Date, endDate: Date
    if (month) {
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0, 23, 59, 59)
    } else {
      startDate = new Date(year, 0, 1)
      endDate = new Date(year, 11, 31, 23, 59, 59)
    }

    // Revenue: from SalesInvoice (CONFIRMED + SHIPPED)
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        status: { in: ['CONFIRMED', 'SHIPPED'] },
        date: { gte: startDate, lte: endDate },
      },
      select: {
        totalAmount: true,
        taxAmount: true,
        subtotal: true,
      },
    })

    const grossRevenue = invoices.reduce((s, inv) => s + Number(inv.totalAmount), 0)
    const revenueExcludeTax = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? inv.totalAmount), 0)
    const taxCollected = invoices.reduce((s, inv) => s + Number(inv.taxAmount ?? 0), 0)
    const invoiceCount = invoices.length

    // AP disbursements (paid costs) by category
    const disbursements = await prisma.disbursementRecord.findMany({
      where: {
        paymentDate: { gte: startDate, lte: endDate },
      },
      include: {
        ap: { select: { apCategory: true, amount: true } },
      },
    })

    const cogsDisbursements = disbursements.filter(d => d.ap.apCategory === 'PRODUCT')
    const freightDisbursements = disbursements.filter(d => d.ap.apCategory === 'FREIGHT')
    const otherDisbursements = disbursements.filter(d => !['PRODUCT', 'FREIGHT'].includes(d.ap.apCategory ?? ''))

    const cogs = cogsDisbursements.reduce((s, d) => s + Number(d.amount), 0)
    const freightCost = freightDisbursements.reduce((s, d) => s + Number(d.amount), 0)
    const otherExpenses = otherDisbursements.reduce((s, d) => s + Number(d.amount), 0)

    // AR receipts (actual cash collected)
    const receipts = await prisma.receiptRecord.findMany({
      where: { receiptDate: { gte: startDate, lte: endDate } },
      select: { amount: true },
    })
    const cashReceived = receipts.reduce((s, r) => s + Number(r.amount), 0)

    const grossProfit = revenueExcludeTax - cogs
    const grossMargin = revenueExcludeTax > 0 ? (grossProfit / revenueExcludeTax) * 100 : 0
    const operatingProfit = grossProfit - freightCost - otherExpenses
    const netProfit = operatingProfit // simplified (no tax/depreciation model yet)

    // Month-by-month breakdown for chart
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const monthlyData = await Promise.all(
      months.map(async (m) => {
        const mStart = new Date(year, m - 1, 1)
        const mEnd = new Date(year, m, 0, 23, 59, 59)
        const [mInvoices, mReceipts] = await Promise.all([
          prisma.salesInvoice.aggregate({
            where: { status: { in: ['CONFIRMED', 'SHIPPED'] }, date: { gte: mStart, lte: mEnd } },
            _sum: { subtotal: true, totalAmount: true },
            _count: true,
          }),
          prisma.receiptRecord.aggregate({
            where: { receiptDate: { gte: mStart, lte: mEnd } },
            _sum: { amount: true },
          }),
        ])
        return {
          month: m,
          revenue: Number(mInvoices._sum?.subtotal ?? mInvoices._sum?.totalAmount ?? 0),
          cashReceived: Number(mReceipts._sum?.amount ?? 0),
          invoiceCount: mInvoices._count,
        }
      })
    )

    return NextResponse.json({
      period: { year, month, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      revenue: {
        gross: grossRevenue,
        excludeTax: revenueExcludeTax,
        taxCollected,
        invoiceCount,
        cashReceived,
        outstandingAR: grossRevenue - cashReceived,
      },
      cogs,
      grossProfit,
      grossMarginPct: Math.round(grossMargin * 10) / 10,
      expenses: {
        freight: freightCost,
        other: otherExpenses,
        total: freightCost + otherExpenses,
      },
      operatingProfit,
      netProfit,
      monthlyData: month ? [] : monthlyData,
    })
  } catch (error) {
    return handleApiError(error, 'finance.income-statement.GET')
  }
}
