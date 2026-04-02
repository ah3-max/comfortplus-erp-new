import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { buildScopeContext, isOwnDataOnly } from '@/lib/scope'
import { createAutoJournal } from '@/lib/auto-journal'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const record = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, code: true } },
        order: { select: { id: true, orderNo: true, createdById: true } },
        items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
      },
    })
    if (!record) return NextResponse.json({ error: '找不到退貨單' }, { status: 404 })

    // 5-3: scope check — SALES/CS can only view returns for their own orders
    const ctx = buildScopeContext(session as { user: { id: string; role: string } })
    if (isOwnDataOnly(ctx.role) && record.order?.createdById !== ctx.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'sales-returns.[id].GET')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const { status, reason, disposalMethod, responsibility, refundAmount, refundStatus,
      approvedAt, receivedDate, warehouseId, notes } = body

    // 5-3: scope check for PUT — only owner or privileged roles
    const putCtx = buildScopeContext(session as { user: { id: string; role: string } })
    if (isOwnDataOnly(putCtx.role)) {
      const ro = await prisma.returnOrder.findUnique({ where: { id }, select: { order: { select: { createdById: true } } } })
      if (ro?.order?.createdById !== putCtx.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // 2-2: When RECEIVED — restore inventory + update AR
    if (status === 'RECEIVED') {
      const existing = await prisma.returnOrder.findUnique({
        where: { id },
        include: { items: true },
      })
      if (existing && existing.warehouseId && existing.items.length > 0) {
        const wh = await prisma.warehouse.findFirst({
          where: { OR: [{ id: existing.warehouseId }, { code: existing.warehouseId }] },
          select: { code: true },
        })
        const whCode = wh?.code ?? 'MAIN'
        await prisma.$transaction(async (tx) => {
          for (const item of existing.items) {
            const inv = await tx.inventory.upsert({
              where: { productId_warehouse_category: { productId: item.productId, warehouse: whCode, category: 'FINISHED_GOODS' } },
              update: { quantity: { increment: item.quantity }, availableQty: { increment: item.quantity } },
              create: { productId: item.productId, warehouse: whCode, category: 'FINISHED_GOODS', quantity: item.quantity, safetyStock: 0 },
            })
            await tx.inventoryTransaction.create({
              data: {
                productId: item.productId, warehouse: whCode, category: 'FINISHED_GOODS',
                type: 'IN', quantity: item.quantity,
                beforeQty: inv.quantity - item.quantity, afterQty: inv.quantity,
                referenceType: 'SALES_RETURN', referenceId: existing.returnNo,
                notes: `銷售退貨入庫 ${existing.returnNo}`,
                createdById: session.user.id,
              },
            })
          }
        })
      }

      // Update AR: reduce amount owed when goods are received back
      if (existing?.orderId && existing.refundAmount) {
        const returnAmt = Number(existing.refundAmount)
        if (returnAmt > 0) {
          const ar = await prisma.accountsReceivable.findFirst({ where: { orderId: existing.orderId } })
          if (ar) {
            const newAmount = Math.max(0, Number(ar.amount) - returnAmt)
            const newPaid = Number(ar.paidAmount)
            const newStatus = newPaid >= newAmount ? 'PAID' : newAmount <= 0 ? 'PAID' : ar.status
            await prisma.accountsReceivable.update({
              where: { id: ar.id },
              data: { amount: newAmount, ...(newStatus !== ar.status && { status: newStatus }) },
            })
          }
        }
      }
    }

    // S-17: Auto-generate CreditNote + SALES_RETURN journal when return is COMPLETED
    if (status === 'COMPLETED') {
      const existing = await prisma.returnOrder.findUnique({
        where: { id },
        include: { order: { select: { orderNo: true } } },
      })
      if (existing && !existing.creditNoteId && (existing.refundAmount || refundAmount)) {
        const amount = Number(refundAmount ?? existing.refundAmount ?? 0)
        if (amount > 0) {
          const count = await prisma.creditDebitNote.count()
          const today = new Date()
          const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
          const noteNo = `CDN${dateStr}${String(count + 1).padStart(4, '0')}`
          const note = await prisma.creditDebitNote.create({
            data: {
              noteNo,
              noteType: 'CREDIT',
              direction: 'RECEIVABLE',
              customerId: existing.customerId,
              salesOrderId: existing.orderId,
              amount,
              totalAmount: amount,
              reason: `退貨折讓 ${existing.returnNo}`,
              status: 'APPROVED',
              createdById: session.user.id,
            },
          })
          await prisma.returnOrder.update({ where: { id }, data: { creditNoteId: note.id } })

          // Auto journal: SALES_RETURN — Dr 銷貨退回 + Dr 進項稅額 / Cr 應收帳款
          const amtExTax = Math.round(amount / 1.05 * 100) / 100
          const taxAmt = amount - amtExTax
          createAutoJournal({
            type: 'SALES_RETURN',
            referenceType: 'SALES_RETURN',
            referenceId: id,
            entryDate: new Date(),
            description: `銷貨退回 ${existing.returnNo}`,
            amount: amtExTax,
            taxAmount: taxAmt,
            createdById: session.user.id,
          }).catch(() => {})
        }
      }
    }

    const record = await prisma.returnOrder.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(reason !== undefined && { reason }),
        ...(disposalMethod !== undefined && { disposalMethod }),
        ...(responsibility !== undefined && { responsibility }),
        ...(refundAmount !== undefined && { refundAmount: refundAmount ? Number(refundAmount) : null }),
        ...(refundStatus !== undefined && { refundStatus }),
        ...(approvedAt !== undefined && { approvedAt: approvedAt ? new Date(approvedAt) : null }),
        ...(approvedAt !== undefined && { approvedById: session.user.id }),
        ...(receivedDate !== undefined && { receivedDate: receivedDate ? new Date(receivedDate) : null }),
        ...(warehouseId !== undefined && { warehouseId }),
        ...(notes !== undefined && { notes }),
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'sales-returns',
      action: 'UPDATE',
      entityType: 'ReturnOrder',
      entityId: id,
      entityLabel: record.returnNo,
    }).catch(() => {})

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'sales-returns.[id].PUT')
  }
}
