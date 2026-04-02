import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const outbound = await prisma.wmsOutbound.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { select: { sku: true, name: true, unit: true } } },
      },
    },
  })

  if (!outbound) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(outbound)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER', 'WAREHOUSE'].includes(role)) {
    return NextResponse.json({ error: '無權限修改出庫單' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()

    // Status-only update
    if (body.statusOnly) {
      const current = await prisma.wmsOutbound.findUnique({
        where: { id },
        include: { items: true },
      })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const oldStatus = current.status
      const newStatus = body.status as string

      // Validate status flow: EXPECTED → PICKING → SHIPPED
      const validTransitions: Record<string, string[]> = {
        EXPECTED: ['PICKING', 'CANCELLED'],
        PICKING: ['SHIPPED', 'CANCELLED'],
      }
      if (!validTransitions[oldStatus]?.includes(newStatus)) {
        return NextResponse.json({ error: `無法從 ${oldStatus} 轉換為 ${newStatus}` }, { status: 400 })
      }

      // Update picked quantities if provided
      if (body.items && newStatus === 'SHIPPED') {
        for (const item of body.items as { id: string; pickedQty: number }[]) {
          await prisma.wmsOutboundItem.update({
            where: { id: item.id },
            data: { pickedQty: item.pickedQty },
          })
        }
      }

      const outbound = await prisma.wmsOutbound.update({
        where: { id },
        data: { status: body.status },
      })

      // 2-5: When SHIPPED — deduct core inventory
      if (newStatus === 'SHIPPED') {
        const wh = 'MAIN'
        for (const item of current.items) {
          const qty = Number(item.pickedQty) > 0 ? Number(item.pickedQty) : Number(item.quantity)
          if (qty <= 0) continue
          const inv = await prisma.inventory.findFirst({
            where: { productId: item.productId, warehouse: wh, category: 'FINISHED_GOODS' },
          })
          if (inv) {
            await prisma.inventory.update({
              where: { id: inv.id },
              data: { quantity: { decrement: qty }, availableQty: { decrement: qty } },
            })
            await prisma.inventoryTransaction.create({
              data: {
                productId: item.productId, warehouse: wh, category: 'FINISHED_GOODS',
                type: 'OUT', quantity: qty,
                beforeQty: inv.quantity, afterQty: inv.quantity - qty,
                referenceType: 'WMS_OUTBOUND', referenceId: current.outboundNumber,
                notes: `WMS 出庫 ${current.outboundNumber}`,
                createdById: session.user.id,
              },
            })
          }
        }
      }

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'wms',
        action: 'STATUS_CHANGE',
        entityType: 'WmsOutbound',
        entityId: id,
        entityLabel: current.outboundNumber,
        changes: { status: { before: oldStatus, after: newStatus } },
      }).catch(() => {})

      return NextResponse.json(outbound)
    }

    // Full update (EXPECTED only)
    const existing = await prisma.wmsOutbound.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'EXPECTED') {
      return NextResponse.json({ error: '只能編輯預計出庫狀態的出庫單' }, { status: 400 })
    }

    if (body.items) {
      await prisma.wmsOutboundItem.deleteMany({ where: { outboundId: id } })
    }

    const outbound = await prisma.wmsOutbound.update({
      where: { id },
      data: {
        type: body.type ?? undefined,
        handlerId: body.handlerId ?? undefined,
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        ...(body.items && {
          items: {
            create: body.items.map((item: {
              productId: string; quantity: number; locationId?: string
            }) => ({
              productId: item.productId,
              quantity: item.quantity,
              pickedQty: 0,
              locationId: item.locationId || null,
            })),
          },
        }),
      },
      include: { items: true },
    })

    return NextResponse.json(outbound)
  } catch (error) {
    return handleApiError(error, 'wms.outbound.PUT')
  }
}
