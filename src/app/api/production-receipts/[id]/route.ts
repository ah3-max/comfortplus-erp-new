import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessReceipt, buildScopeContext } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { notifyByRole } from '@/lib/notify'
import { createAutoJournal } from '@/lib/auto-journal'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const receipt = await prisma.productionReceipt.findUnique({
    where: { id },
    include: {
      factory: { select: { id: true, name: true, code: true } },
      receivingWarehouse: { select: { id: true, name: true, code: true } },
      handler: { select: { id: true, name: true } },
      productionOrder: { select: { id: true, productionNo: true, status: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { sku: true, name: true, unit: true } },
        },
      },
    },
  })

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ctx = buildScopeContext(session as { user: { id: string; role: string } })
  if (!canAccessReceipt(ctx, receipt)) {
    return NextResponse.json({ error: '無權限查看此入庫單' }, { status: 403 })
  }

  return NextResponse.json(receipt)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await req.json()

    // Status-only update
    if (body.statusOnly) {
      const current = await prisma.productionReceipt.findUnique({
        where: { id },
        include: {
          items: { include: { product: { select: { name: true, costPrice: true } } } },
          factory: { select: { name: true } },
          productionOrder: { select: { productionNo: true } },
          receivingWarehouse: { select: { code: true } },
        },
      })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const oldStatus = current.status
      const newStatus = body.status as string

      const receipt = await prisma.productionReceipt.update({
        where: { id },
        data: { status: body.status },
      })

      // When CONFIRMED: add inventory using warehouse CODE (not ID)
      if (newStatus === 'CONFIRMED' && current.receivingWarehouseId && current.items.length > 0) {
        const whCode = current.receivingWarehouse?.code ?? current.receivingWarehouseId
        await prisma.$transaction(
          current.items.map(item =>
            prisma.inventory.upsert({
              where: {
                productId_warehouse_category: {
                  productId: item.productId,
                  warehouse: whCode,
                  category: 'FINISHED_GOODS',
                },
              },
              create: {
                productId: item.productId,
                warehouse: whCode,
                category: 'FINISHED_GOODS',
                quantity: Number(item.quantity),
                availableQty: Number(item.quantity),
              },
              update: {
                quantity:     { increment: Number(item.quantity) },
                availableQty: { increment: Number(item.quantity) },
              },
            })
          )
        )
      }

      // Notify warehouse when confirmed
      if (newStatus === 'CONFIRMED') {
        const itemSummary = current.items.map(i => `${i.product?.name ?? i.productName}×${i.quantity}`).join('、')
        notifyByRole(['WAREHOUSE_MANAGER', 'WAREHOUSE'], {
          title: `生產入庫單已確認：${current.receiptNumber}`,
          message: `${current.factory?.name ?? ''} — ${itemSummary}`,
          linkUrl: `/production-receipts/${id}`,
          category: 'RECEIPT_CONFIRMED',
          priority: 'HIGH',
        }).catch(() => {})

        // AutoJournal: Dr 存貨 + Dr 進項稅額 / Cr 應付帳款
        const totalCost = current.items.reduce(
          (s, i) => s + Number(i.quantity) * Number(i.product?.costPrice ?? 0), 0
        )
        if (totalCost > 0) {
          createAutoJournal({
            type: 'PURCHASE_RECEIVE',
            referenceType: 'PRODUCTION_RECEIPT',
            referenceId: id,
            entryDate: new Date(),
            description: `生產入庫 ${current.receiptNumber}`,
            amount: totalCost,
            createdById: session.user.id,
          }).catch(() => {})
        }
      }

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'production-receipts',
        action: 'STATUS_CHANGE',
        entityType: 'ProductionReceipt',
        entityId: id,
        entityLabel: current.receiptNumber,
        changes: { status: { before: oldStatus, after: newStatus } },
      }).catch(() => {})

      return NextResponse.json(receipt)
    }

    // Full update (only DRAFT)
    const existing = await prisma.productionReceipt.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: '只能編輯草稿狀態的入庫單' }, { status: 400 })
    }

    const items = body.items.map((item: {
      productId: string; productName?: string; specification?: string
      quantity: number; bomVersion?: string; manufacturedItemId?: string
      resourceInput?: string; productionTime?: number; unit?: string; memo?: string
    }) => ({
      productId: item.productId,
      productName: item.productName || '',
      specification: item.specification || null,
      quantity: Number(item.quantity),
      bomVersion: item.bomVersion || null,
      manufacturedItemId: item.manufacturedItemId || null,
      resourceInput: item.resourceInput || null,
      productionTime: item.productionTime ? Number(item.productionTime) : null,
      unit: item.unit || null,
      memo: item.memo || null,
    }))

    await prisma.productionReceiptItem.deleteMany({ where: { receiptId: id } })

    const receipt = await prisma.productionReceipt.update({
      where: { id },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        factoryId: body.factoryId,
        receivingWarehouseId: body.receivingWarehouseId,
        handlerId: body.handlerId,
        productionOrderId: body.productionOrderId || null,
        notes: body.notes || null,
        items: { create: items },
      },
      include: { items: true },
    })

    return NextResponse.json(receipt)
  } catch (error) {
    return handleApiError(error, 'production-receipts.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const receipt = await prisma.productionReceipt.findUnique({ where: { id } })
    if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['DRAFT', 'CANCELLED'].includes(receipt.status)) {
      return NextResponse.json({ error: '只能刪除草稿或已取消的入庫單' }, { status: 400 })
    }

    await prisma.productionReceipt.update({ where: { id }, data: { status: 'CANCELLED' } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'production-receipts',
      action: 'CANCEL',
      entityType: 'ProductionReceipt',
      entityId: id,
      entityLabel: receipt.receiptNumber,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'production-receipts.DELETE')
  }
}
