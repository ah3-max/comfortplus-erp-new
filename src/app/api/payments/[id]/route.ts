import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
      return NextResponse.json({ error: '無權限修改付款記錄' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const before = await prisma.paymentRecord.findUnique({
      where: { id },
      select: { paymentNo: true, paymentType: true, paymentMethod: true, amount: true, referenceNo: true },
    })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const payment = await prisma.paymentRecord.update({
      where: { id },
      data: {
        paymentType:   body.paymentType   ?? undefined,
        paymentMethod: body.paymentMethod ?? undefined,
        bankAccount:   body.bankAccount   ?? undefined,
        referenceNo:   body.referenceNo   ?? undefined,
        invoiceNo:     body.invoiceNo     ?? undefined,
        notes:         body.notes         ?? undefined,
      },
      include: {
        salesOrder:    { select: { id: true, orderNo: true } },
        purchaseOrder: { select: { id: true, poNo: true } },
        customer:      { select: { id: true, name: true } },
        supplier:      { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'payments',
      action: 'UPDATE',
      entityType: 'PaymentRecord',
      entityId: id,
      entityLabel: before.paymentNo,
      changes: {
        paymentType: { before: before.paymentType, after: payment.paymentType },
        paymentMethod: { before: before.paymentMethod, after: payment.paymentMethod },
        referenceNo: { before: before.referenceNo, after: payment.referenceNo },
      },
    }).catch(() => {})

    return NextResponse.json(payment)
  } catch (error) {
    return handleApiError(error, 'payments.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
      return NextResponse.json({ error: '無權限刪除付款記錄' }, { status: 403 })
    }

    const { id } = await params
    const record = await prisma.paymentRecord.findUnique({ where: { id } })
    if (!record) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      await tx.paymentRecord.delete({ where: { id } })

      // Recalculate linked order paidAmount
      if (record.salesOrderId) {
        const remaining = await tx.paymentRecord.findMany({
          where: { salesOrderId: record.salesOrderId, direction: 'INCOMING' },
        })
        await tx.salesOrder.update({
          where: { id: record.salesOrderId },
          data: { paidAmount: remaining.reduce((s, p) => s + Number(p.amount), 0) },
        })
      }
      if (record.purchaseOrderId) {
        const remaining = await tx.paymentRecord.findMany({
          where: { purchaseOrderId: record.purchaseOrderId, direction: 'OUTGOING' },
        })
        await tx.purchaseOrder.update({
          where: { id: record.purchaseOrderId },
          data: { paidAmount: remaining.reduce((s, p) => s + Number(p.amount), 0) },
        })
      }
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'payments',
      action: 'DELETE',
      entityType: 'PaymentRecord',
      entityId: id,
      entityLabel: `${record.paymentNo} (${record.direction})`,
      changes: { amount: { before: Number(record.amount), after: null } },
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, 'payments.delete')
  }
}
