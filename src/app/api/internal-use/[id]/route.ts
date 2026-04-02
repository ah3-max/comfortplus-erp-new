import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const record = await prisma.internalUse.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      requestedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, sku: true, name: true, unit: true } },
          lot: { select: { id: true, lotNo: true } },
        },
      },
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
    const current = await prisma.internalUse.findUnique({
      where: { id },
      include: { items: true, warehouse: { select: { code: true } } },
    })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const role = (session.user as { role?: string }).role ?? ''

    // Approve
    if (body.action === 'APPROVE') {
      if (!['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER'].includes(role)) {
        return NextResponse.json({ error: '權限不足' }, { status: 403 })
      }
      if (current.status !== 'PENDING_APPROVAL') {
        return NextResponse.json({ error: '只能審核待審核的單據' }, { status: 400 })
      }
      const updated = await prisma.internalUse.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: session.user.id, approvedAt: new Date() },
      })
      logAudit({ userId: session.user.id, userName: session.user.name ?? '', userRole: role, module: 'internal-use', action: 'APPROVE', entityType: 'InternalUse', entityId: id, entityLabel: current.useNo }).catch(() => {})
      return NextResponse.json(updated)
    }

    // Issue (deduct inventory)
    if (body.action === 'ISSUE') {
      if (!['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER', 'WAREHOUSE'].includes(role)) {
        return NextResponse.json({ error: '權限不足' }, { status: 403 })
      }
      if (current.status !== 'APPROVED') {
        return NextResponse.json({ error: '只能出庫已審核的單據' }, { status: 400 })
      }

      const whCode = current.warehouse?.code ?? current.warehouseId
      await prisma.$transaction(async (tx) => {
        // Deduct inventory + create InventoryTransaction
        for (const item of current.items) {
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
                referenceType: 'INTERNAL_USE', referenceId: id,
                notes: `內部領用 ${current.useNo}`,
                createdById: session.user.id,
              },
            })
          }
        }
        await tx.internalUse.update({
          where: { id },
          data: { status: 'ISSUED', issuedAt: new Date() },
        })
      })

      logAudit({ userId: session.user.id, userName: session.user.name ?? '', userRole: role, module: 'internal-use', action: 'ISSUE', entityType: 'InternalUse', entityId: id, entityLabel: current.useNo }).catch(() => {})
      return NextResponse.json({ success: true })
    }

    // Cancel
    if (body.action === 'CANCEL') {
      if (['ISSUED'].includes(current.status)) {
        return NextResponse.json({ error: '已出庫的單據不能取消' }, { status: 400 })
      }
      await prisma.internalUse.update({ where: { id }, data: { status: 'CANCELLED' } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'internal-use.PUT')
  }
}
