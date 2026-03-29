import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const inbound = await prisma.wmsInbound.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { select: { sku: true, name: true, unit: true } } },
      },
    },
  })

  if (!inbound) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(inbound)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER', 'WAREHOUSE'].includes(role)) {
    return NextResponse.json({ error: '無權限修改入庫單' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()

    // Status-only update
    if (body.statusOnly) {
      const current = await prisma.wmsInbound.findUnique({
        where: { id },
        include: { items: true },
      })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const oldStatus = current.status
      const newStatus = body.status as string

      // Validate status flow: EXPECTED → RECEIVING → RECEIVED
      const validTransitions: Record<string, string[]> = {
        EXPECTED: ['RECEIVING', 'CANCELLED'],
        RECEIVING: ['RECEIVED', 'CANCELLED'],
      }
      if (!validTransitions[oldStatus]?.includes(newStatus)) {
        return NextResponse.json({ error: `無法從 ${oldStatus} 轉換為 ${newStatus}` }, { status: 400 })
      }

      // When transitioning to RECEIVED, update received quantities and inventory in a transaction
      if (newStatus === 'RECEIVED') {
        // Update received quantities if provided
        if (body.items) {
          for (const item of body.items as { id: string; receivedQty: number }[]) {
            await prisma.wmsInboundItem.update({
              where: { id: item.id },
              data: { receivedQty: item.receivedQty },
            })
          }
        }

        // Re-fetch items with location chain to resolve warehouse
        const freshItems = await prisma.wmsInboundItem.findMany({
          where: { inboundId: id },
          include: {
            product: { select: { id: true, sku: true } },
          },
        })

        // Resolve warehouse for each item via locationId -> WmsLocation -> WmsZone -> Warehouse
        // Fall back to default "MAIN" warehouse if no locationId
        const defaultWarehouse = await prisma.warehouse.findFirst({
          where: { code: 'MAIN' },
        })

        await prisma.$transaction(async (tx) => {
          // Update inbound status
          await tx.wmsInbound.update({
            where: { id },
            data: { status: 'RECEIVED' },
          })

          for (const item of freshItems) {
            const receivedQty = Number(item.receivedQty)
            if (receivedQty <= 0) continue

            // Determine warehouse from item's locationId
            let warehouseId = defaultWarehouse?.id ?? ''
            let warehouseCode = defaultWarehouse?.code ?? 'MAIN'

            if (item.locationId) {
              const wmsLocation = await tx.wmsLocation.findUnique({
                where: { id: item.locationId },
                include: { zone: { include: { warehouse: true } } },
              })
              if (wmsLocation?.zone?.warehouse) {
                warehouseId = wmsLocation.zone.warehouse.id
                warehouseCode = wmsLocation.zone.warehouse.code
              }
            }

            // 1. Upsert Inventory aggregate record
            const inv = await tx.inventory.upsert({
              where: {
                productId_warehouse_category: {
                  productId: item.productId,
                  warehouse: warehouseCode,
                  category: 'FINISHED_GOODS',
                },
              },
              update: {
                quantity: { increment: receivedQty },
                availableQty: { increment: receivedQty },
              },
              create: {
                productId: item.productId,
                warehouse: warehouseCode,
                category: 'FINISHED_GOODS',
                quantity: receivedQty,
                availableQty: receivedQty,
                safetyStock: 0,
              },
            })

            // 2. Find or create InventoryLot
            const lotNo = `WMS-${current.inboundNumber}-${item.product.sku ?? item.productId.slice(0, 8)}`
            await tx.inventoryLot.upsert({
              where: { lotNo },
              update: {
                quantity: { increment: receivedQty },
              },
              create: {
                lotNo,
                productId: item.productId,
                warehouseId,
                category: 'FINISHED_GOODS',
                status: 'AVAILABLE',
                quantity: receivedQty,
                inboundDate: new Date(),
                notes: `WMS 入庫 ${current.inboundNumber}`,
              },
            })

            // 3. Create InventoryTransaction
            await tx.inventoryTransaction.create({
              data: {
                productId: item.productId,
                warehouse: warehouseCode,
                category: 'FINISHED_GOODS',
                type: 'IN',
                quantity: receivedQty,
                beforeQty: inv.quantity - receivedQty,
                afterQty: inv.quantity,
                referenceType: 'WMS_INBOUND',
                referenceId: current.inboundNumber,
                notes: `WMS 入庫完成 ${current.inboundNumber}`,
                createdById: session.user.id,
              },
            })
          }
        })
      } else {
        // Non-RECEIVED status transitions (e.g., RECEIVING, CANCELLED)
        await prisma.wmsInbound.update({
          where: { id },
          data: { status: body.status },
        })
      }

      const inbound = await prisma.wmsInbound.findUnique({
        where: { id },
        include: { items: true },
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'wms',
        action: 'STATUS_CHANGE',
        entityType: 'WmsInbound',
        entityId: id,
        entityLabel: current.inboundNumber,
        changes: { status: { before: oldStatus, after: newStatus } },
      }).catch(() => {})

      return NextResponse.json(inbound)
    }

    // Full update (EXPECTED only)
    const existing = await prisma.wmsInbound.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'EXPECTED') {
      return NextResponse.json({ error: '只能編輯預計入庫狀態的入庫單' }, { status: 400 })
    }

    if (body.items) {
      await prisma.wmsInboundItem.deleteMany({ where: { inboundId: id } })
    }

    const inbound = await prisma.wmsInbound.update({
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
              receivedQty: 0,
              locationId: item.locationId || null,
            })),
          },
        }),
      },
      include: { items: true },
    })

    return NextResponse.json(inbound)
  } catch (error) {
    return handleApiError(error, 'wms.inbound.PUT')
  }
}
