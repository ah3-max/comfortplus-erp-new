import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/settlement/ar?customerId=X
 * Returns all unpaid/partial AR for a customer (balance > 0).
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const customerId = new URL(req.url).searchParams.get('customerId')
    if (!customerId) {
      return NextResponse.json({ error: '缺少 customerId' }, { status: 400 })
    }

    const records = await prisma.accountsReceivable.findMany({
      where: {
        customerId,
        status: { notIn: ['PAID', 'BAD_DEBT'] },
      },
      include: {
        order: { select: { id: true, orderNo: true } },
        customer: { select: { id: true, name: true, code: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    // Only return records with remaining balance
    const data = records
      .map(r => ({
        id: r.id,
        invoiceNo: r.invoiceNo,
        invoiceDate: r.invoiceDate,
        dueDate: r.dueDate,
        amount: Number(r.amount),
        paidAmount: Number(r.paidAmount),
        balance: Number(r.amount) - Number(r.paidAmount),
        agingDays: r.agingDays,
        status: r.status,
        orderNo: r.order?.orderNo ?? null,
        orderId: r.order?.id ?? null,
      }))
      .filter(r => r.balance > 0)

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, 'finance.settlement.ar')
  }
}
