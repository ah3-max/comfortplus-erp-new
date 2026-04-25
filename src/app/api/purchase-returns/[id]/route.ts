import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { createAutoJournal } from '@/lib/auto-journal'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const record = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        purchase: { select: { id: true, poNo: true } },
        items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
      },
    })
    if (!record) return NextResponse.json({ error: '找不到退貨單' }, { status: 404 })
    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'purchase-returns.[id].GET')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const { status, reason, debitNoteNo, deductAmount, deductStatus,
      approvedAt, shippedDate, notes } = body

    // 2-3: When APPROVED — deduct inventory + create PURCHASE_RETURN journal
    if (status === 'APPROVED') {
      const existing = await prisma.purchaseReturn.findUnique({
        where: { id },
        include: {
          items: true,
          purchase: { select: { warehouse: true, totalAmount: true } },
          supplier: { select: { name: true } },
        },
      })
      if (existing && existing.status === 'PENDING' && existing.items.length > 0) {
        const whCode = existing.purchase?.warehouse ?? 'MAIN'
        await prisma.$transaction(async (tx) => {
          for (const item of existing.items) {
            const inv = await tx.inventory.findFirst({
              where: { productId: item.productId, warehouse: whCode, category: 'FINISHED_GOODS' },
            })
            if (inv) {
              await tx.inventory.update({
                where: { id: inv.id },
                data: { quantity: { decrement: item.quantity }, availableQty: { decrement: item.quantity } },
              })
              await tx.inventoryTransaction.create({
                data: {
                  productId: item.productId, warehouse: whCode, category: 'FINISHED_GOODS',
                  type: 'OUT', quantity: item.quantity,
                  beforeQty: inv.quantity, afterQty: inv.quantity - item.quantity,
                  referenceType: 'PURCHASE_RETURN', referenceId: existing.returnNo,
                  notes: `採購退貨出庫 ${existing.returnNo}`,
                  createdById: session.user.id,
                },
              })
            }
          }
        })

        // Auto journal: PURCHASE_RETURN — Dr 應付帳款 / Cr 存貨 + Cr 進項稅額
        const returnTotal = existing.items.reduce((s, i) => s + Number(i.unitCost ?? 0) * Number(i.quantity), 0)
        if (returnTotal > 0) {
          const amtExTax = Math.round(returnTotal / 1.05 * 100) / 100
          const taxAmt = returnTotal - amtExTax
          createAutoJournal({
            type: 'PURCHASE_RETURN',
            referenceType: 'PURCHASE_RETURN',
            referenceId: id,
            entryDate: new Date(),
            description: `採購退貨 ${existing.returnNo}`,
            amount: amtExTax,
            taxAmount: taxAmt,
            createdById: session.user.id,
          }).catch(() => {})
        }
      }
    }

    const record = await prisma.purchaseReturn.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(reason !== undefined && { reason }),
        ...(debitNoteNo !== undefined && { debitNoteNo }),
        ...(deductAmount !== undefined && { deductAmount: deductAmount ? Number(deductAmount) : null }),
        ...(deductStatus !== undefined && { deductStatus }),
        ...(approvedAt !== undefined && { approvedAt: approvedAt ? new Date(approvedAt) : null }),
        ...(approvedAt !== undefined && { approvedById: session.user.id }),
        ...(shippedDate !== undefined && { shippedDate: shippedDate ? new Date(shippedDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'purchase-returns',
      action: 'UPDATE',
      entityType: 'PurchaseReturn',
      entityId: id,
      entityLabel: record.returnNo,
    }).catch(() => {})

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'purchase-returns.[id].PUT')
  }
}
