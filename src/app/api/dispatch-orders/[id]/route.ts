import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { notifyByRole } from '@/lib/notify'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const dispatchOrder = await prisma.dispatchOrder.findUnique({
    where: { id },
    include: {
      pickingOrder: {
        select: { id: true, pickingNumber: true, status: true },
      },
      customer: true,
      handler: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { sku: true, name: true, unit: true } } },
      },
    },
  })

  if (!dispatchOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(dispatchOrder)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    // Status-only update
    if (body.statusOnly) {
      const current = await prisma.dispatchOrder.findUnique({
        where: { id },
        include: { customer: { select: { name: true } } },
      })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const oldStatus = current.status
      const newStatus = body.status as string

      // Validate status flow: PENDING → DISPATCHED → DELIVERED
      const validTransitions: Record<string, string[]> = {
        PENDING: ['DISPATCHED', 'CANCELLED'],
        DISPATCHED: ['DELIVERED', 'CANCELLED'],
      }
      if (!validTransitions[oldStatus]?.includes(newStatus)) {
        return NextResponse.json({ error: `無法從 ${oldStatus} 轉換為 ${newStatus}` }, { status: 400 })
      }

      const dispatchOrder = await prisma.dispatchOrder.update({
        where: { id },
        data: { status: body.status },
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'dispatch-orders',
        action: 'STATUS_CHANGE',
        entityType: 'DispatchOrder',
        entityId: id,
        entityLabel: current.dispatchNumber,
        changes: { status: { before: oldStatus, after: newStatus } },
      }).catch(() => {})

      // L-9: Notify internal roles when dispatched
      if (newStatus === 'DISPATCHED') {
        notifyByRole(['SALES', 'CS'], {
          title: `已出車：${current.dispatchNumber}`,
          message: `${current.customer?.name ?? ''} 訂單已出車，預計送達`,
          linkUrl: `/dispatch`,
          category: 'SHIPMENT_DISPATCHED',
          priority: 'NORMAL',
        }).catch(() => {})
      }

      // L-11: Anomaly escalation — notify manager if CANCELLED unexpectedly
      if (newStatus === 'CANCELLED' && oldStatus === 'DISPATCHED') {
        notifyByRole(['WAREHOUSE_MANAGER', 'GM'], {
          title: `配送異常：${current.dispatchNumber}`,
          message: `${current.customer?.name ?? ''} 的派車單已在配送途中取消`,
          linkUrl: `/dispatch`,
          category: 'DISPATCH_ANOMALY',
          priority: 'HIGH',
        }).catch(() => {})
      }

      return NextResponse.json(dispatchOrder)
    }

    // Vehicle/driver assignment (allowed in PENDING and DISPATCHED)
    if (body.assignVehicle) {
      const existing = await prisma.dispatchOrder.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const updated = await prisma.dispatchOrder.update({
        where: { id },
        data: {
          vehicleNo:   body.vehicleNo   !== undefined ? (body.vehicleNo   || null) : undefined,
          driverName:  body.driverName  !== undefined ? (body.driverName  || null) : undefined,
          driverPhone: body.driverPhone !== undefined ? (body.driverPhone || null) : undefined,
        },
      })
      return NextResponse.json(updated)
    }

    // Full update (PENDING only)
    const existing = await prisma.dispatchOrder.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: '只能編輯待派貨狀態的派貨單' }, { status: 400 })
    }

    if (body.items) {
      await prisma.dispatchOrderItem.deleteMany({ where: { dispatchOrderId: id } })
    }

    const dispatchOrder = await prisma.dispatchOrder.update({
      where: { id },
      data: {
        handlerId: body.handlerId ?? undefined,
        warehouseId: body.warehouseId ?? undefined,
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
        contactInfo: body.contactInfo !== undefined ? body.contactInfo : undefined,
        shippingAddress: body.shippingAddress !== undefined ? body.shippingAddress : undefined,
        vehicleNo:   body.vehicleNo   !== undefined ? (body.vehicleNo   || null) : undefined,
        driverName:  body.driverName  !== undefined ? (body.driverName  || null) : undefined,
        driverPhone: body.driverPhone !== undefined ? (body.driverPhone || null) : undefined,
        ...(body.items && {
          items: {
            create: body.items.map((item: {
              productId: string; productName: string; specification?: string
              quantity: number; memo?: string
            }) => ({
              productId: item.productId,
              productName: item.productName,
              specification: item.specification || null,
              quantity: item.quantity,
              memo: item.memo || null,
            })),
          },
        }),
      },
      include: { items: true },
    })

    return NextResponse.json(dispatchOrder)
  } catch (error) {
    return handleApiError(error, 'dispatch-orders.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const dispatchOrder = await prisma.dispatchOrder.findUnique({ where: { id } })
    if (!dispatchOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['PENDING', 'CANCELLED'].includes(dispatchOrder.status)) {
      return NextResponse.json({ error: '只能取消待派貨或已取消的派貨單' }, { status: 400 })
    }

    await prisma.dispatchOrder.update({ where: { id }, data: { status: 'CANCELLED' } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'dispatch-orders',
      action: 'CANCEL',
      entityType: 'DispatchOrder',
      entityId: id,
      entityLabel: dispatchOrder.dispatchNumber,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'dispatch-orders.DELETE')
  }
}
