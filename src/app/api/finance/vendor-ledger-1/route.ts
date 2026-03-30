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
    const customerId = searchParams.get('customerId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const where: Record<string, unknown> = {
      createdAt: { gte: periodStart, lte: periodEnd },
    }
    if (customerId) where.customerId = customerId
    if (status) where.status = status

    const records = await prisma.accountsReceivable.findMany({
      where,
      include: { customer: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'asc' },
    })

    // Aggregate by customer
    const customerMap: Record<string, {
      customerId: string; customerName: string; customerCode: string
      invoiceCount: number; totalAmount: number; paidAmount: number
      overdueAmount: number; oldestDueDate: string | null
    }> = {}

    for (const r of records) {
      const cid = r.customerId
      if (!customerMap[cid]) {
        customerMap[cid] = {
          customerId: cid,
          customerName: r.customer.name,
          customerCode: r.customer.code ?? '',
          invoiceCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          overdueAmount: 0,
          oldestDueDate: null,
        }
      }
      const entry = customerMap[cid]
      entry.invoiceCount++
      entry.totalAmount += Number(r.amount)
      entry.paidAmount += Number(r.paidAmount)
      if (r.status === 'DUE') entry.overdueAmount += Number(r.amount) - Number(r.paidAmount)
      if (r.dueDate) {
        const dd = r.dueDate.toISOString().slice(0, 10)
        if (!entry.oldestDueDate || dd < entry.oldestDueDate) entry.oldestDueDate = dd
      }
    }

    const rows = Object.values(customerMap)
      .map(r => ({ ...r, balance: Math.round((r.totalAmount - r.paidAmount) * 100) / 100, totalAmount: Math.round(r.totalAmount * 100) / 100, paidAmount: Math.round(r.paidAmount * 100) / 100, overdueAmount: Math.round(r.overdueAmount * 100) / 100 }))
      .sort((a, b) => b.balance - a.balance)

    const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0)
    const totalOverdue = rows.reduce((s, r) => s + r.overdueAmount, 0)
    const totalPaid = rows.reduce((s, r) => s + r.paidAmount, 0)

    return NextResponse.json({
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      summary: {
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        customerCount: rows.length,
      },
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.vendor-ledger-1.GET')
  }
}
