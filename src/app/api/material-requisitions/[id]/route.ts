import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessRequisition, buildScopeContext } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { notifyByRole } from '@/lib/notify'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const requisition = await prisma.materialRequisition.findUnique({
    where: { id },
    include: {
      productionOrder: { select: { id: true, productionNo: true, status: true } },
      fromWarehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
      handler: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { sku: true, name: true, unit: true } },
        },
      },
    },
  })

  if (!requisition) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ctx = buildScopeContext(session as { user: { id: string; role: string } })
  if (!canAccessRequisition(ctx, requisition)) {
    return NextResponse.json({ error: '無權限查看此領料單' }, { status: 403 })
  }

  return NextResponse.json(requisition)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await req.json()

    // Status-only update
    if (body.statusOnly) {
      const current = await prisma.materialRequisition.findUnique({
        where: { id },
        include: {
          items: { include: { product: { select: { name: true } } } },
          productionOrder: { select: { productionNo: true } },
        },
      })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const oldStatus = current.status
      const newStatus = body.status as string

      const requisition = await prisma.materialRequisition.update({
        where: { id },
        data: { status: body.status },
      })

      // Notify warehouse when confirmed
      if (newStatus === 'CONFIRMED') {
        const itemSummary = current.items.map(i => `${i.product?.name ?? i.productName}×${i.quantity}`).join('、')
        notifyByRole(['WAREHOUSE_MANAGER', 'WAREHOUSE'], {
          title: `領料單已確認：${current.requisitionNumber}`,
          message: `生產工單 ${current.productionOrder?.productionNo ?? ''} — ${itemSummary}`,
          linkUrl: `/material-requisitions/${id}`,
          category: 'REQUISITION_CONFIRMED',
          priority: 'HIGH',
        }).catch(() => {})
      }

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'material-requisitions',
        action: 'STATUS_CHANGE',
        entityType: 'MaterialRequisition',
        entityId: id,
        entityLabel: current.requisitionNumber,
        changes: { status: { before: oldStatus, after: newStatus } },
      }).catch(() => {})

      return NextResponse.json(requisition)
    }

    // Full update (only DRAFT)
    const existing = await prisma.materialRequisition.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: '只能編輯草稿狀態的領料單' }, { status: 400 })
    }

    const items = body.items.map((item: {
      productId: string; productName?: string; specification?: string
      quantity: number; bomVersion?: string; unit?: string; serialNumber?: string; memo?: string
    }) => ({
      productId: item.productId,
      productName: item.productName || '',
      specification: item.specification || null,
      quantity: Number(item.quantity),
      bomVersion: item.bomVersion || null,
      unit: item.unit || null,
      serialNumber: item.serialNumber || null,
      memo: item.memo || null,
    }))

    await prisma.materialRequisitionItem.deleteMany({ where: { requisitionId: id } })

    const requisition = await prisma.materialRequisition.update({
      where: { id },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        productionOrderId: body.productionOrderId,
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        handlerId: body.handlerId,
        notes: body.notes || null,
        items: { create: items },
      },
      include: { items: true },
    })

    return NextResponse.json(requisition)
  } catch (error) {
    return handleApiError(error, 'material-requisitions.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const requisition = await prisma.materialRequisition.findUnique({ where: { id } })
    if (!requisition) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['DRAFT', 'CANCELLED'].includes(requisition.status)) {
      return NextResponse.json({ error: '只能刪除草稿或已取消的領料單' }, { status: 400 })
    }

    await prisma.materialRequisition.update({ where: { id }, data: { status: 'CANCELLED' } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'material-requisitions',
      action: 'CANCEL',
      entityType: 'MaterialRequisition',
      entityId: id,
      entityLabel: requisition.requisitionNumber,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'material-requisitions.DELETE')
  }
}
