import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { createAutoJournal } from '@/lib/auto-journal'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!FINANCE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'))
    const arId = searchParams.get('arId') ?? undefined

    const where = arId ? { arId } : {}

    const [total, records] = await Promise.all([
      prisma.receiptRecord.count({ where }),
      prisma.receiptRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { receiptDate: 'desc' },
        include: {
          ar: {
            select: {
              invoiceNo: true,
              amount: true,
              paidAmount: true,
              status: true,
              customer: { select: { name: true, code: true } },
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'finance.receipts.list')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!FINANCE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { arId, amount, receiptDate, receiptMethod, bankLast5, notes } = body

    // Period guard
    if (receiptDate) {
      const { assertPeriodOpen } = await import('@/lib/period-guard')
      await assertPeriodOpen(new Date(receiptDate))
    }

    if (!arId) return NextResponse.json({ error: '請選擇應收帳款' }, { status: 400 })
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: '請填寫收款金額' }, { status: 400 })
    if (!receiptDate) return NextResponse.json({ error: '請填寫收款日期' }, { status: 400 })

    const ar = await prisma.accountsReceivable.findUnique({
      where: { id: arId },
      include: { customer: { select: { name: true } } },
    })
    if (!ar) return NextResponse.json({ error: '找不到應收帳款' }, { status: 404 })
    if (ar.status === 'PAID') return NextResponse.json({ error: '該應收帳款已收清' }, { status: 400 })

    const balance = Number(ar.amount) - Number(ar.paidAmount)
    if (Number(amount) > balance) {
      return NextResponse.json(
        { error: `收款金額 (${Number(amount)}) 不可超過未收餘額 (${balance.toFixed(0)})` },
        { status: 400 },
      )
    }

    const newPaid = Number(ar.paidAmount) + Number(amount)
    const newStatus = newPaid >= Number(ar.amount) ? 'PAID' : 'PARTIAL_PAID'

    const [receipt] = await prisma.$transaction([
      prisma.receiptRecord.create({
        data: {
          arId,
          customerId: ar.customerId,
          receiptDate: new Date(receiptDate),
          receiptMethod: receiptMethod ?? null,
          amount: Number(amount),
          bankLast5: bankLast5 ?? null,
          notes: notes ?? null,
          createdById: session.user.id,
        },
      }),
      prisma.accountsReceivable.update({
        where: { id: arId },
        data: {
          paidAmount: newPaid,
          status: newStatus,
        },
      }),
    ])

    // 1-5: Sync SalesOrder.paidAmount
    if (ar.orderId) {
      await prisma.salesOrder.update({
        where: { id: ar.orderId },
        data: { paidAmount: newPaid },
      })
    }

    // 1-3: Auto journal — PAYMENT_IN
    createAutoJournal({
      type: 'PAYMENT_IN',
      referenceType: 'RECEIPT_RECORD',
      referenceId: receipt.id,
      entryDate: new Date(receiptDate),
      description: `收款 ${ar.customer.name}`,
      amount: Number(amount),
      createdById: session.user.id,
    }).catch(() => {})

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'finance',
      action: 'RECEIPT_CREATE',
      entityType: 'ReceiptRecord',
      entityId: receipt.id,
      entityLabel: `${ar.customer.name} 收款 ${Number(amount)}`,
      changes: {
        paidAmount: { before: Number(ar.paidAmount), after: newPaid },
        status: { before: ar.status, after: newStatus },
      },
    }).catch(() => {})

    return NextResponse.json(receipt, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'finance.receipts.create')
  }
}
