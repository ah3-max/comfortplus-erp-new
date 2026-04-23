import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE', 'PROCUREMENT']

/**
 * GET /api/finance/accounts-payable/[id]
 *
 * 單筆應付帳款詳情 + 付款歷史 + 沖帳歷史
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const ap = await prisma.accountsPayable.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, code: true, taxId: true } },
        purchaseOrder: { select: { id: true, poNo: true, totalAmount: true, status: true } },
        disbursements: {
          select: {
            id: true,
            paymentDate: true,
            paymentMethod: true,
            amount: true,
            currency: true,
            exchangeRate: true,
            bankInfo: true,
            notes: true,
            createdAt: true,
          },
          orderBy: { paymentDate: 'desc' },
        },
        settlementItems: {
          select: {
            id: true,
            amount: true,
            lineNo: true,
            batch: {
              select: {
                id: true,
                batchNo: true,
                paymentDate: true,
                paymentMethod: true,
                totalAmount: true,
                status: true,
                createdBy: { select: { name: true } },
              },
            },
          },
          orderBy: { batch: { paymentDate: 'desc' } },
        },
      },
    })

    if (!ap) return NextResponse.json({ error: '找不到應付帳款' }, { status: 404 })

    return NextResponse.json({
      ...ap,
      amount: Number(ap.amount),
      paidAmount: Number(ap.paidAmount),
      balance: Number(ap.amount) - Number(ap.paidAmount),
      exchangeRate: ap.exchangeRate ? Number(ap.exchangeRate) : null,
      amountForeign: ap.amountForeign ? Number(ap.amountForeign) : null,
      fxGainLoss: ap.fxGainLoss ? Number(ap.fxGainLoss) : null,
      disbursements: ap.disbursements.map(d => ({
        ...d,
        amount: Number(d.amount),
        exchangeRate: d.exchangeRate ? Number(d.exchangeRate) : null,
      })),
      settlementItems: ap.settlementItems.map(s => ({
        ...s,
        amount: Number(s.amount),
        batch: { ...s.batch, totalAmount: Number(s.batch.totalAmount) },
      })),
    })
  } catch (error) {
    return handleApiError(error, 'accounts-payable.GET[id]')
  }
}

/**
 * PATCH /api/finance/accounts-payable/[id]
 *
 * 更新應付帳款（備註、到期日）
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()

    const ap = await prisma.accountsPayable.findUnique({ where: { id } })
    if (!ap) return NextResponse.json({ error: '找不到應付帳款' }, { status: 404 })

    const updateData: Record<string, unknown> = {}
    const changes: Record<string, { before: unknown; after: unknown }> = {}

    if (body.notes !== undefined) {
      changes.notes = { before: ap.notes, after: body.notes }
      updateData.notes = body.notes
    }
    if (body.dueDate !== undefined) {
      changes.dueDate = { before: ap.dueDate, after: body.dueDate }
      updateData.dueDate = new Date(body.dueDate)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '無可更新的欄位' }, { status: 400 })
    }

    const updated = await prisma.accountsPayable.update({
      where: { id },
      data: updateData,
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: session.user.role ?? '',
      module: 'accounts-payable',
      action: 'UPDATE',
      entityType: 'AccountsPayable',
      entityId: id,
      entityLabel: ap.invoiceNo ?? id,
      changes,
    }).catch(() => {})

    return NextResponse.json({
      ...updated,
      amount: Number(updated.amount),
      paidAmount: Number(updated.paidAmount),
      balance: Number(updated.amount) - Number(updated.paidAmount),
    })
  } catch (error) {
    return handleApiError(error, 'accounts-payable.PATCH')
  }
}
