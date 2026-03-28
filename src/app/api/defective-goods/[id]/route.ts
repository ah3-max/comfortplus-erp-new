import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const record = await prisma.defectiveGoods.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      lot: { select: { id: true, lotNo: true } },
      createdBy: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
      qc: { select: { id: true, qcNo: true } },
    },
  })

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(record)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const current = await prisma.defectiveGoods.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const role = (session.user as { role?: string }).role ?? ''

    // Resolve with disposition
    if (body.action === 'RESOLVE') {
      if (!['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER', 'QC'].includes(role)) {
        return NextResponse.json({ error: '權限不足' }, { status: 403 })
      }
      if (current.status === 'RESOLVED') {
        return NextResponse.json({ error: '已處置完畢' }, { status: 400 })
      }

      const { disposition, dispositionNote } = body
      if (!disposition) return NextResponse.json({ error: '請選擇處置方式' }, { status: 400 })

      await prisma.$transaction(async (tx) => {
        await tx.defectiveGoods.update({
          where: { id },
          data: {
            disposition,
            dispositionNote: dispositionNote || null,
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedById: session.user.id,
          },
        })

        // Adjust inventory based on disposition
        if (disposition === 'SCRAP') {
          // Remove from inventory entirely
          await tx.inventory.updateMany({
            where: { productId: current.productId, warehouse: current.warehouseId },
            data: {
              quantity: { decrement: current.quantity },
              damagedQty: { decrement: current.quantity },
            },
          })
        } else if (disposition === 'REWORK') {
          // Move back to available (will be reworked)
          await tx.inventory.updateMany({
            where: { productId: current.productId, warehouse: current.warehouseId },
            data: {
              damagedQty: { decrement: current.quantity },
              availableQty: { increment: current.quantity },
            },
          })
        } else if (disposition === 'RETURN_SUPPLIER') {
          // Remove from inventory
          await tx.inventory.updateMany({
            where: { productId: current.productId, warehouse: current.warehouseId },
            data: {
              quantity: { decrement: current.quantity },
              damagedQty: { decrement: current.quantity },
            },
          })
        }
        // DISCOUNT_SALE and QUARANTINE: no inventory change (handled separately)
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: role,
        module: 'defective-goods',
        action: 'RESOLVE',
        entityType: 'DefectiveGoods',
        entityId: id,
        entityLabel: current.defectNo,
        changes: { disposition: { before: current.disposition ?? '', after: disposition } },
      }).catch(() => {})

      return NextResponse.json({ success: true })
    }

    // Update details (PENDING / PROCESSING only)
    if (['PENDING', 'PROCESSING'].includes(current.status)) {
      const updated = await prisma.defectiveGoods.update({
        where: { id },
        data: {
          status: body.status ?? current.status,
          defectType: body.defectType ?? undefined,
          severity: body.severity ?? undefined,
          description: body.description ?? undefined,
          disposition: body.disposition ?? undefined,
          dispositionNote: body.dispositionNote ?? undefined,
        },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: '無法修改已處置的紀錄' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'defective-goods.PUT')
  }
}
