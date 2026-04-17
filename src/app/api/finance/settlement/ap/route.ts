import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/settlement/ap?supplierId=X
 * Returns all unpaid/partial AP for a supplier (balance > 0).
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const supplierId = new URL(req.url).searchParams.get('supplierId')
    if (!supplierId) {
      return NextResponse.json({ error: '缺少 supplierId' }, { status: 400 })
    }

    const records = await prisma.accountsPayable.findMany({
      where: {
        supplierId,
        status: { notIn: ['PAID'] },
      },
      include: {
        purchaseOrder: { select: { id: true, poNo: true } },
        supplier: { select: { id: true, name: true, code: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    const data = records
      .map(r => ({
        id: r.id,
        invoiceNo: r.invoiceNo,
        invoiceDate: r.invoiceDate,
        dueDate: r.dueDate,
        amount: Number(r.amount),
        paidAmount: Number(r.paidAmount),
        balance: Number(r.amount) - Number(r.paidAmount),
        status: r.status,
        currency: r.currency,
        poNo: r.purchaseOrder?.poNo ?? null,
        purchaseOrderId: r.purchaseOrder?.id ?? null,
      }))
      .filter(r => r.balance > 0)

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, 'finance.settlement.ap')
  }
}
