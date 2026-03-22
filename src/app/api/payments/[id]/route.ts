import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

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

  return NextResponse.json(payment)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  return NextResponse.json({ ok: true })
}
