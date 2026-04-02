import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'
import { buildScopeContext, isOwnDataOnly } from '@/lib/scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const direction       = searchParams.get('direction')       ?? ''
    const customerId      = searchParams.get('customerId')      ?? ''
    const supplierId      = searchParams.get('supplierId')      ?? ''
    const salesOrderId    = searchParams.get('salesOrderId')    ?? ''
    const purchaseOrderId = searchParams.get('purchaseOrderId') ?? ''

    // 5-2: scope — SALES/CS only see payments they created
    const ctx = buildScopeContext(session as { user: { id: string; role: string } })

    const payments = await prisma.paymentRecord.findMany({
      where: {
        ...(direction       && { direction: direction as never }),
        ...(customerId      && { customerId }),
        ...(supplierId      && { supplierId }),
        ...(salesOrderId    && { salesOrderId }),
        ...(purchaseOrderId && { purchaseOrderId }),
        ...(isOwnDataOnly(ctx.role) && { createdById: ctx.userId }),
      },
      include: {
        salesOrder:    { select: { id: true, orderNo: true } },
        purchaseOrder: { select: { id: true, poNo: true } },
        customer:      { select: { id: true, name: true, code: true } },
        supplier:      { select: { id: true, name: true, code: true } },
        createdBy:     { select: { id: true, name: true } },
      },
      orderBy: { paymentDate: 'desc' },
    })

    return NextResponse.json(payments)
  } catch (error) {
    return handleApiError(error, 'payments.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body.direction || !body.paymentType || !body.amount || !body.paymentDate) {
      return NextResponse.json({ error: '請填寫收/付方向、類型、金額與日期' }, { status: 400 })
    }

    const paymentNo = await generateSequenceNo('PAYMENT')

    const payment = await prisma.$transaction(async (tx) => {
      const record = await tx.paymentRecord.create({
        data: {
          paymentNo,
          direction:       body.direction,
          paymentType:     body.paymentType,
          salesOrderId:    body.salesOrderId    || null,
          purchaseOrderId: body.purchaseOrderId || null,
          customerId:      body.customerId      || null,
          supplierId:      body.supplierId      || null,
          amount:          Number(body.amount),
          paymentDate:     new Date(body.paymentDate),
          paymentMethod:   body.paymentMethod   || null,
          bankAccount:     body.bankAccount     || null,
          referenceNo:     body.referenceNo     || null,
          invoiceNo:       body.invoiceNo       || null,
          notes:           body.notes           || null,
          createdById:     session.user.id,
        },
        include: {
          salesOrder:    { select: { id: true, orderNo: true } },
          purchaseOrder: { select: { id: true, poNo: true } },
          customer:      { select: { id: true, name: true } },
          supplier:      { select: { id: true, name: true } },
        },
      })

      // 1-4: Sync with AR/AP system
      if (body.direction === 'INCOMING' && body.salesOrderId) {
        const ar = await tx.accountsReceivable.findFirst({ where: { orderId: body.salesOrderId } })
        if (ar && ar.status !== 'PAID') {
          const newArPaid = Number(ar.paidAmount) + Number(body.amount)
          const newArStatus = newArPaid >= Number(ar.amount) ? 'PAID' : 'PARTIAL_PAID'
          await tx.receiptRecord.create({
            data: {
              arId: ar.id,
              customerId: ar.customerId,
              receiptDate: new Date(body.paymentDate),
              receiptMethod: body.paymentMethod ?? null,
              amount: Number(body.amount),
              bankLast5: body.bankAccount ? String(body.bankAccount).slice(-5) : null,
              notes: body.notes ?? null,
              createdById: session.user.id,
            },
          })
          await tx.accountsReceivable.update({
            where: { id: ar.id },
            data: { paidAmount: newArPaid, status: newArStatus as never },
          })
        }
      }
      if (body.direction === 'OUTGOING' && body.purchaseOrderId) {
        const ap = await tx.accountsPayable.findFirst({ where: { purchaseOrderId: body.purchaseOrderId } })
        if (ap && ap.status !== 'PAID') {
          const newApPaid = Number(ap.paidAmount) + Number(body.amount)
          const newApStatus = newApPaid >= Number(ap.amount) ? 'PAID' : 'PARTIAL_PAID'
          await tx.disbursementRecord.create({
            data: {
              apId: ap.id,
              payee: body.payee ?? null,
              paymentDate: new Date(body.paymentDate),
              paymentMethod: body.paymentMethod ?? null,
              currency: body.currency ?? 'TWD',
              exchangeRate: body.exchangeRate ? Number(body.exchangeRate) : null,
              amount: Number(body.amount),
              bankInfo: body.bankAccount ?? null,
              notes: body.notes ?? null,
              createdById: session.user.id,
            },
          })
          await tx.accountsPayable.update({
            where: { id: ap.id },
            data: { paidAmount: newApPaid, status: newApStatus as never },
          })
        }
      }

      // Auto-update paidAmount on linked order
      if (body.salesOrderId && body.direction === 'INCOMING') {
        const allPayments = await tx.paymentRecord.findMany({
          where: { salesOrderId: body.salesOrderId, direction: 'INCOMING' },
        })
        const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0)
        await tx.salesOrder.update({
          where: { id: body.salesOrderId },
          data: { paidAmount: totalPaid },
        })
      }
      if (body.purchaseOrderId && body.direction === 'OUTGOING') {
        const allPayments = await tx.paymentRecord.findMany({
          where: { purchaseOrderId: body.purchaseOrderId, direction: 'OUTGOING' },
        })
        const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0)
        await tx.purchaseOrder.update({
          where: { id: body.purchaseOrderId },
          data: { paidAmount: totalPaid },
        })
      }

      return record
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'payments.create')
  }
}
