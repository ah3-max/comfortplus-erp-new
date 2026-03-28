import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const pickingOrder = await prisma.pickingOrder.findUnique({
    where: { id },
    include: {
      salesInvoice: { select: { id: true, invoiceNumber: true, status: true } },
      customer: true,
      handler: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { sku: true, name: true, unit: true } } },
      },
      dispatchOrder: { select: { id: true, dispatchNumber: true, status: true } },
    },
  })

  if (!pickingOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(pickingOrder)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    // Status-only update
    if (body.statusOnly) {
      const current = await prisma.pickingOrder.findUnique({
        where: { id },
        include: {
          items: { include: { product: { select: { name: true } } } },
          customer: { select: { id: true, name: true } },
        },
      })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const oldStatus = current.status
      const newStatus = body.status as string

      // Validate status flow: PENDING → PICKING → PICKED
      const validTransitions: Record<string, string[]> = {
        PENDING: ['PICKING', 'CANCELLED'],
        PICKING: ['PICKED', 'CANCELLED'],
      }
      if (!validTransitions[oldStatus]?.includes(newStatus)) {
        return NextResponse.json({ error: `無法從 ${oldStatus} 轉換為 ${newStatus}` }, { status: 400 })
      }

      const pickingOrder = await prisma.pickingOrder.update({
        where: { id },
        data: { status: body.status },
      })

      // When PICKED, auto-create dispatch order
      if (newStatus === 'PICKED') {
        const dispatchNumber = await generateSequenceNo('DISPATCH_ORDER')
        await prisma.dispatchOrder.create({
          data: {
            dispatchNumber,
            date: new Date(),
            pickingOrderId: id,
            customerId: current.customerId,
            handlerId: current.handlerId,
            warehouseId: current.warehouseId,
            scheduledDate: current.scheduledDate,
            contactInfo: current.contactInfo,
            shippingAddress: current.shippingAddress,
            status: 'PENDING',
            createdById: session.user.id,
            items: {
              create: current.items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                specification: item.specification || null,
                quantity: Number(item.pickedQuantity) > 0 ? Number(item.pickedQuantity) : Number(item.quantity),
                memo: item.memo || null,
              })),
            },
          },
        })

        logAudit({
          userId: session.user.id,
          userName: session.user.name ?? '',
          userRole: (session.user as { role?: string }).role ?? '',
          module: 'dispatch-orders',
          action: 'CREATE',
          entityType: 'DispatchOrder',
          entityId: id,
          entityLabel: dispatchNumber,
          changes: { autoCreatedFrom: { before: '', after: current.pickingNumber } },
        }).catch(() => {})
      }

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'picking-orders',
        action: 'STATUS_CHANGE',
        entityType: 'PickingOrder',
        entityId: id,
        entityLabel: current.pickingNumber,
        changes: { status: { before: oldStatus, after: newStatus } },
      }).catch(() => {})

      return NextResponse.json(pickingOrder)
    }

    // Full update (PENDING only)
    const existing = await prisma.pickingOrder.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: '只能編輯待理貨狀態的理貨單' }, { status: 400 })
    }

    // Update picked quantities if in PICKING status or update items
    if (body.items) {
      await prisma.pickingOrderItem.deleteMany({ where: { pickingOrderId: id } })
    }

    const pickingOrder = await prisma.pickingOrder.update({
      where: { id },
      data: {
        handlerId: body.handlerId ?? undefined,
        warehouseId: body.warehouseId ?? undefined,
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
        contactInfo: body.contactInfo !== undefined ? body.contactInfo : undefined,
        shippingAddress: body.shippingAddress !== undefined ? body.shippingAddress : undefined,
        ...(body.items && {
          items: {
            create: body.items.map((item: {
              productId: string; productName: string; specification?: string
              quantity: number; pickedQuantity?: number; memo?: string
            }) => ({
              productId: item.productId,
              productName: item.productName,
              specification: item.specification || null,
              quantity: item.quantity,
              pickedQuantity: item.pickedQuantity ?? 0,
              memo: item.memo || null,
            })),
          },
        }),
      },
      include: { items: true },
    })

    return NextResponse.json(pickingOrder)
  } catch (error) {
    return handleApiError(error, 'picking-orders.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const pickingOrder = await prisma.pickingOrder.findUnique({ where: { id } })
    if (!pickingOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['PENDING', 'CANCELLED'].includes(pickingOrder.status)) {
      return NextResponse.json({ error: '只能取消待理貨或已取消的理貨單' }, { status: 400 })
    }

    await prisma.pickingOrder.update({ where: { id }, data: { status: 'CANCELLED' } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'picking-orders',
      action: 'CANCEL',
      entityType: 'PickingOrder',
      entityId: id,
      entityLabel: pickingOrder.pickingNumber,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'picking-orders.DELETE')
  }
}
