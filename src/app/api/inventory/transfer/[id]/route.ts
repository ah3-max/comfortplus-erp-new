import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action } = body  // 'confirm' | 'complete' | 'cancel'

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      items: true,
      fromWarehouse: true,
      toWarehouse:   true,
    },
  })
  if (!transfer) return NextResponse.json({ error: '找不到調撥單' }, { status: 404 })

  if (action === 'cancel') {
    if (transfer.status === 'COMPLETED') {
      return NextResponse.json({ error: '已完成的調撥單無法取消' }, { status: 400 })
    }
    const updated = await prisma.stockTransfer.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
    return NextResponse.json(updated)
  }

  if (action === 'complete') {
    if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'PENDING') {
      return NextResponse.json({ error: '調撥單狀態不允許此操作' }, { status: 400 })
    }

    const fromCode = transfer.fromWarehouse.code
    const toCode   = transfer.toWarehouse.code

    await prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        // Deduct from source warehouse
        await tx.inventory.updateMany({
          where: { productId: item.productId, warehouse: fromCode },
          data:  { quantity: { decrement: item.quantity } },
        })
        // Add to target warehouse
        await tx.inventory.upsert({
          where: { productId_warehouse_category: {
            productId: item.productId,
            warehouse: toCode,
            category:  'FINISHED_GOODS',
          }},
          update: { quantity: { increment: item.quantity } },
          create: {
            productId:  item.productId,
            warehouse:  toCode,
            category:   'FINISHED_GOODS',
            quantity:   item.quantity,
            safetyStock: 0,
          },
        })
        // Transactions
        await tx.inventoryTransaction.create({
          data: {
            productId: item.productId, warehouse: fromCode,
            type: 'TRANSFER_OUT', quantity: item.quantity,
            referenceType: 'TRANSFER', referenceId: transfer.transferNo,
            notes: `調撥出庫 → ${toCode}`, createdById: session.user.id,
          },
        })
        await tx.inventoryTransaction.create({
          data: {
            productId: item.productId, warehouse: toCode,
            type: 'TRANSFER_IN', quantity: item.quantity,
            referenceType: 'TRANSFER', referenceId: transfer.transferNo,
            notes: `調撥入庫 ← ${fromCode}`, createdById: session.user.id,
          },
        })
      }
      await tx.stockTransfer.update({
        where: { id },
        data:  { status: 'COMPLETED', transferDate: new Date() },
      })
    })

    return NextResponse.json({ success: true })
  }

  if (action === 'confirm') {
    if (transfer.status !== 'PENDING') {
      return NextResponse.json({ error: '只有待出庫狀態可確認' }, { status: 400 })
    }
    const updated = await prisma.stockTransfer.update({
      where: { id },
      data:  { status: 'IN_TRANSIT' },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: '無效操作' }, { status: 400 })
  } catch (error) { return handleApiError(error, 'inventory.transfer.update') }
}
