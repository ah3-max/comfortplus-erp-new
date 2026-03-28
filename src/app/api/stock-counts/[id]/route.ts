import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const stockCount = await prisma.stockCount.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, sku: true, name: true, unit: true, category: true } },
          lot: { select: { id: true, lotNo: true } },
        },
        orderBy: [{ product: { category: 'asc' } }, { product: { sku: 'asc' } }],
      },
    },
  })

  if (!stockCount) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(stockCount)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    const current = await prisma.stockCount.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ── Status change ──
    if (body.statusOnly) {
      const oldStatus = current.status
      const newStatus = body.status as string

      const validTransitions: Record<string, string[]> = {
        DRAFT:     ['COUNTING', 'CANCELLED'],
        COUNTING:  ['REVIEWING', 'CANCELLED'],
        REVIEWING: ['COMPLETED', 'COUNTING'],
      }
      if (!validTransitions[oldStatus]?.includes(newStatus)) {
        return NextResponse.json({ error: `無法從 ${oldStatus} 轉換為 ${newStatus}` }, { status: 400 })
      }

      const updateData: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'COUNTING') updateData.countDate = new Date()
      if (newStatus === 'REVIEWING') updateData.reviewedById = session.user.id
      if (newStatus === 'COMPLETED') {
        updateData.completedAt = new Date()
        updateData.reviewedAt = new Date()

        // Calculate totals
        const totalVariance = current.items.reduce((s, item) => s + item.variance, 0)
        updateData.totalVariance = Math.abs(totalVariance)
        updateData.varianceRate = current.items.length > 0
          ? (current.items.filter(i => i.variance !== 0).length / current.items.length) * 100
          : 0
      }

      const updated = await prisma.stockCount.update({ where: { id }, data: updateData })

      // When COMPLETED: adjust inventory for all items with variance
      if (newStatus === 'COMPLETED') {
        const itemsWithVariance = current.items.filter(i => i.variance !== 0)
        if (itemsWithVariance.length > 0) {
          await prisma.$transaction(
            itemsWithVariance.map(item =>
              prisma.inventory.updateMany({
                where: { productId: item.productId, warehouse: current.warehouseId },
                data: { quantity: { increment: item.variance }, lastCountDate: new Date() },
              })
            )
          )
        }
      }

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'stock-counts',
        action: 'STATUS_CHANGE',
        entityType: 'StockCount',
        entityId: id,
        entityLabel: current.countNo,
        changes: { status: { before: oldStatus, after: newStatus } },
      }).catch(() => {})

      return NextResponse.json(updated)
    }

    // ── Update counted quantities ──
    if (body.items) {
      const itemUpdates: Array<{ id: string; countedQty: number; varianceReason?: string; notes?: string }> = body.items

      await prisma.$transaction(
        itemUpdates.map(itemUpdate => {
          const existing = current.items.find(i => i.id === itemUpdate.id)
          const variance = itemUpdate.countedQty - (existing?.systemQty ?? 0)
          return prisma.stockCountItem.update({
            where: { id: itemUpdate.id },
            data: {
              countedQty: itemUpdate.countedQty,
              variance,
              varianceReason: itemUpdate.varianceReason ?? null,
              notes: itemUpdate.notes ?? null,
            },
          })
        })
      )

      return NextResponse.json({ success: true })
    }

    // ── General update (DRAFT only) ──
    if (current.status !== 'DRAFT') {
      return NextResponse.json({ error: '只能修改草稿狀態的盤點單' }, { status: 400 })
    }

    const updated = await prisma.stockCount.update({
      where: { id },
      data: {
        plannedDate: body.plannedDate ? new Date(body.plannedDate) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        assignedToId: body.assignedToId ?? undefined,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'stock-counts.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const stockCount = await prisma.stockCount.findUnique({ where: { id } })
    if (!stockCount) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['DRAFT', 'CANCELLED'].includes(stockCount.status)) {
      return NextResponse.json({ error: '只能取消草稿或已取消的盤點單' }, { status: 400 })
    }

    await prisma.stockCount.update({ where: { id }, data: { status: 'CANCELLED' } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'stock-counts',
      action: 'CANCEL',
      entityType: 'StockCount',
      entityId: id,
      entityLabel: stockCount.countNo,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'stock-counts.DELETE')
  }
}
