import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER']

/**
 * GET /api/finance/accounts-receivable/[id]
 *
 * 單筆應收帳款詳情 + 收款歷史 + 沖帳歷史 + 催收記錄
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
    const ar = await prisma.accountsReceivable.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, code: true, taxId: true } },
        order: { select: { id: true, orderNo: true, totalAmount: true, status: true } },
        receipts: {
          select: {
            id: true,
            receiptDate: true,
            receiptMethod: true,
            amount: true,
            bankLast5: true,
            reconcileStatus: true,
            notes: true,
            createdAt: true,
          },
          orderBy: { receiptDate: 'desc' },
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
        collectionLogs: {
          select: {
            id: true,
            collectionDate: true,
            method: true,
            contactPerson: true,
            result: true,
            promisedDate: true,
            promisedAmount: true,
            notes: true,
            createdBy: { select: { name: true } },
            createdAt: true,
          },
          orderBy: { collectionDate: 'desc' },
        },
      },
    })

    if (!ar) return NextResponse.json({ error: '找不到應收帳款' }, { status: 404 })

    return NextResponse.json({
      ...ar,
      amount: Number(ar.amount),
      paidAmount: Number(ar.paidAmount),
      balance: Number(ar.amount) - Number(ar.paidAmount),
      receipts: ar.receipts.map(r => ({ ...r, amount: Number(r.amount) })),
      settlementItems: ar.settlementItems.map(s => ({
        ...s,
        amount: Number(s.amount),
        batch: { ...s.batch, totalAmount: Number(s.batch.totalAmount) },
      })),
      collectionLogs: ar.collectionLogs.map(c => ({
        ...c,
        promisedAmount: c.promisedAmount ? Number(c.promisedAmount) : null,
      })),
    })
  } catch (error) {
    return handleApiError(error, 'accounts-receivable.GET[id]')
  }
}

/**
 * PATCH /api/finance/accounts-receivable/[id]
 *
 * 更新應收帳款（備註、催收狀態、標記呆帳）
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

    const ar = await prisma.accountsReceivable.findUnique({ where: { id } })
    if (!ar) return NextResponse.json({ error: '找不到應收帳款' }, { status: 404 })

    const updateData: Record<string, unknown> = {}
    const changes: Record<string, { before: unknown; after: unknown }> = {}

    if (body.notes !== undefined) {
      changes.notes = { before: ar.notes, after: body.notes }
      updateData.notes = body.notes
    }
    if (body.collectionStatus !== undefined) {
      changes.collectionStatus = { before: ar.collectionStatus, after: body.collectionStatus }
      updateData.collectionStatus = body.collectionStatus
      updateData.lastCollectionDate = new Date()
    }
    if (body.status === 'BAD_DEBT' && ar.status !== 'PAID') {
      changes.status = { before: ar.status, after: 'BAD_DEBT' }
      updateData.status = 'BAD_DEBT'
    }
    if (body.dueDate !== undefined) {
      changes.dueDate = { before: ar.dueDate, after: body.dueDate }
      updateData.dueDate = new Date(body.dueDate)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '無可更新的欄位' }, { status: 400 })
    }

    const updated = await prisma.accountsReceivable.update({
      where: { id },
      data: updateData,
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: session.user.role ?? '',
      module: 'accounts-receivable',
      action: 'UPDATE',
      entityType: 'AccountsReceivable',
      entityId: id,
      entityLabel: ar.invoiceNo ?? id,
      changes,
    }).catch(() => {})

    return NextResponse.json({
      ...updated,
      amount: Number(updated.amount),
      paidAmount: Number(updated.paidAmount),
      balance: Number(updated.amount) - Number(updated.paidAmount),
    })
  } catch (error) {
    return handleApiError(error, 'accounts-receivable.PATCH')
  }
}
