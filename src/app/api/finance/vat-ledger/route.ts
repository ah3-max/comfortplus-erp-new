import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// 進項/銷項帳簿
// 銷項：SalesInvoice（客戶開立發票）
// 進項：AccountsPayable.invoiceNo（供應商進貨發票）
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'OUTPUT' // OUTPUT=銷項 / INPUT=進項
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    if (type === 'OUTPUT') {
      // 銷項：SalesInvoice（已確認以上狀態）
      const invoices = await prisma.salesInvoice.findMany({
        where: {
          date: { gte: periodStart, lte: periodEnd },
          status: { in: ['CONFIRMED', 'SHIPPED'] },
        },
        select: {
          id: true, invoiceNumber: true, date: true, currency: true,
          subtotal: true, taxAmount: true, totalAmount: true, status: true,
          customerId: true,
          customer: { select: { id: true, name: true, code: true } },
        },
        orderBy: { date: 'asc' },
      })

      const rows = invoices.map(inv => ({
        id: inv.id,
        date: inv.date.toISOString().slice(0, 10),
        invoiceNo: inv.invoiceNumber,
        partyName: inv.customer.name,
        partyCode: inv.customer.code,
        currency: inv.currency,
        subtotal: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        totalAmount: Number(inv.totalAmount),
        status: inv.status,
      }))

      const summary = {
        count: rows.length,
        subtotalSum: Math.round(rows.reduce((s, r) => s + r.subtotal, 0)),
        taxSum: Math.round(rows.reduce((s, r) => s + r.taxAmount, 0)),
        totalSum: Math.round(rows.reduce((s, r) => s + r.totalAmount, 0)),
      }

      return NextResponse.json({ type: 'OUTPUT', rows, summary, period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) } })
    } else {
      // 進項：AccountsPayable with invoiceNo
      const aps = await prisma.accountsPayable.findMany({
        where: {
          invoiceDate: { gte: periodStart, lte: periodEnd },
          invoiceNo: { not: null },
        },
        include: {
          supplier: { select: { id: true, name: true, code: true } },
        },
        orderBy: { invoiceDate: 'asc' },
      })

      const rows = aps.map(ap => {
        const total = Number(ap.amount)
        // Estimate: if currency TWD, assume 5% tax included
        const taxRate = ap.currency === 'TWD' ? 0.05 : 0
        const subtotal = taxRate > 0 ? Math.round(total / (1 + taxRate)) : total
        const taxAmount = total - subtotal
        return {
          id: ap.id,
          date: ap.invoiceDate?.toISOString().slice(0, 10) ?? '',
          invoiceNo: ap.invoiceNo ?? '',
          partyName: ap.supplier.name,
          partyCode: ap.supplier.code ?? '',
          currency: ap.currency,
          subtotal,
          taxAmount,
          totalAmount: total,
          status: ap.status,
        }
      })

      const summary = {
        count: rows.length,
        subtotalSum: Math.round(rows.reduce((s, r) => s + r.subtotal, 0)),
        taxSum: Math.round(rows.reduce((s, r) => s + r.taxAmount, 0)),
        totalSum: Math.round(rows.reduce((s, r) => s + r.totalAmount, 0)),
      }

      return NextResponse.json({ type: 'INPUT', rows, summary, period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) } })
    }
  } catch (error) {
    return handleApiError(error, 'finance.vat-ledger.GET')
  }
}
