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
    const apId = searchParams.get('apId') ?? undefined

    const where = apId ? { apId } : {}

    const [total, records] = await Promise.all([
      prisma.disbursementRecord.count({ where }),
      prisma.disbursementRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { paymentDate: 'desc' },
        include: {
          ap: {
            select: {
              invoiceNo: true,
              amount: true,
              paidAmount: true,
              status: true,
              supplier: { select: { name: true, code: true } },
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
    return handleApiError(error, 'finance.disbursements.list')
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
    const { apId, amount, paymentDate, paymentMethod, currency, exchangeRate, bankInfo, payee, notes } = body

    // Period guard
    if (paymentDate) {
      const { assertPeriodOpen } = await import('@/lib/period-guard')
      await assertPeriodOpen(new Date(paymentDate))
    }

    if (!apId) return NextResponse.json({ error: '請選擇應付帳款' }, { status: 400 })
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: '請填寫付款金額' }, { status: 400 })
    if (!paymentDate) return NextResponse.json({ error: '請填寫付款日期' }, { status: 400 })

    const ap = await prisma.accountsPayable.findUnique({
      where: { id: apId },
      include: { supplier: { select: { name: true } } },
    })
    if (!ap) return NextResponse.json({ error: '找不到應付帳款' }, { status: 404 })
    if (ap.status === 'PAID') return NextResponse.json({ error: '該應付帳款已付清' }, { status: 400 })

    const balance = Number(ap.amount) - Number(ap.paidAmount)
    if (Number(amount) > balance) {
      return NextResponse.json(
        { error: `付款金額 (${Number(amount)}) 不可超過未付餘額 (${balance.toFixed(0)})` },
        { status: 400 },
      )
    }

    const newPaid = Number(ap.paidAmount) + Number(amount)
    const newStatus = newPaid >= Number(ap.amount) ? 'PAID' : 'PARTIAL_PAID'

    const [disbursement] = await prisma.$transaction([
      prisma.disbursementRecord.create({
        data: {
          apId,
          payee: payee ?? null,
          paymentDate: new Date(paymentDate),
          paymentMethod: paymentMethod ?? null,
          currency: currency ?? 'TWD',
          exchangeRate: exchangeRate ? Number(exchangeRate) : null,
          amount: Number(amount),
          bankInfo: bankInfo ?? null,
          notes: notes ?? null,
          createdById: session.user.id,
        },
      }),
      prisma.accountsPayable.update({
        where: { id: apId },
        data: {
          paidAmount: newPaid,
          status: newStatus,
        },
      }),
    ])

    // 1-6: Sync PurchaseOrder.paidAmount
    if (ap.purchaseOrderId) {
      await prisma.purchaseOrder.update({
        where: { id: ap.purchaseOrderId },
        data: { paidAmount: newPaid },
      })
    }

    // 1-3: Auto journal — PAYMENT_OUT
    createAutoJournal({
      type: 'PAYMENT_OUT',
      referenceType: 'DISBURSEMENT_RECORD',
      referenceId: disbursement.id,
      entryDate: new Date(paymentDate),
      description: `付款 ${ap.supplier.name}`,
      amount: Number(amount),
      createdById: session.user.id,
    }).catch(() => {})

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'finance',
      action: 'DISBURSEMENT_CREATE',
      entityType: 'DisbursementRecord',
      entityId: disbursement.id,
      entityLabel: `${ap.supplier.name} 付款 ${Number(amount)}`,
      changes: {
        paidAmount: { before: Number(ap.paidAmount), after: newPaid },
        status: { before: ap.status, after: newStatus },
      },
    }).catch(() => {})

    return NextResponse.json(disbursement, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'finance.disbursements.create')
  }
}
