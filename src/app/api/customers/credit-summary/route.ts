import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/customers/credit-summary
 * Returns all customers with credit limits + outstanding AR balance.
 * Query: ?status=EXCEEDED|CRITICAL|WARNING|NORMAL&search=xxx
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER', 'CS'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') // NORMAL/WARNING/CRITICAL/EXCEEDED/ALL
    const search = searchParams.get('search') ?? ''

    // Get all customers with creditLimit set
    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        creditLimit: true,
        paymentTerms: true,
        riskLevel: true,
        salesRepId: true,
        salesRep: { select: { name: true } },
        accountsReceivable: {
          where: { status: { notIn: ['PAID'] } },
          select: { amount: true, paidAmount: true, dueDate: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const now = new Date()

    const rows = customers.map(c => {
      const limit = c.creditLimit ? Number(c.creditLimit) : null
      // Outstanding = sum of (amount - paidAmount) for unpaid AR
      const outstanding = c.accountsReceivable.reduce(
        (s, ar) => s + Math.max(0, Number(ar.amount) - Number(ar.paidAmount)),
        0
      )
      // Overdue = outstanding AR where dueDate < now
      const overdue = c.accountsReceivable
        .filter(ar => ar.dueDate && new Date(ar.dueDate) < now && ar.status !== 'PAID')
        .reduce((s, ar) => s + Math.max(0, Number(ar.amount) - Number(ar.paidAmount)), 0)

      const utilizationPct = limit && limit > 0 ? (outstanding / limit) * 100 : null
      let creditStatus: 'NO_LIMIT' | 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXCEEDED' = 'NO_LIMIT'
      if (limit !== null) {
        if (outstanding > limit) creditStatus = 'EXCEEDED'
        else if (utilizationPct! >= 90) creditStatus = 'CRITICAL'
        else if (utilizationPct! >= 70) creditStatus = 'WARNING'
        else creditStatus = 'NORMAL'
      }

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        creditLimit: limit,
        creditUsed: outstanding,
        creditAvailable: limit !== null ? Math.max(0, limit - outstanding) : null,
        utilizationPct: utilizationPct !== null ? Math.round(utilizationPct * 10) / 10 : null,
        overdueAmount: overdue,
        creditStatus,
        paymentTerms: c.paymentTerms,
        riskLevel: c.riskLevel,
        salesRep: c.salesRep?.name ?? null,
        arCount: c.accountsReceivable.length,
      }
    })

    // Apply status filter
    const filtered = statusFilter && statusFilter !== 'ALL'
      ? rows.filter(r => r.creditStatus === statusFilter)
      : rows

    // Summary counts
    const summary = {
      total: rows.length,
      exceeded: rows.filter(r => r.creditStatus === 'EXCEEDED').length,
      critical: rows.filter(r => r.creditStatus === 'CRITICAL').length,
      warning: rows.filter(r => r.creditStatus === 'WARNING').length,
      normal: rows.filter(r => r.creditStatus === 'NORMAL').length,
      noLimit: rows.filter(r => r.creditStatus === 'NO_LIMIT').length,
      totalOutstanding: rows.reduce((s, r) => s + r.creditUsed, 0),
      totalOverdue: rows.reduce((s, r) => s + r.overdueAmount, 0),
    }

    return NextResponse.json({ data: filtered, summary })
  } catch (error) {
    return handleApiError(error, 'customers.credit-summary.GET')
  }
}
