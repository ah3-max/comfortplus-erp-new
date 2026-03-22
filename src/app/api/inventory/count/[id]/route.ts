import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const count = await prisma.stockCount.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
      items: {
        include: { product: { select: { sku: true, name: true, unit: true, category: true } } },
        orderBy: { product: { name: 'asc' } },
      },
    },
  })
  if (!count) return NextResponse.json({ error: '找不到盤點單' }, { status: 404 })
  return NextResponse.json(count)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const stockCount = await prisma.stockCount.findUnique({
    where: { id },
    include: { items: true, warehouse: true },
  })
  if (!stockCount) return NextResponse.json({ error: '找不到盤點單' }, { status: 404 })

  // Update item counted quantities
  if (body.updateItems) {
    await prisma.$transaction(
      body.items.map((item: { id: string; countedQty: number; notes?: string }) =>
        prisma.stockCountItem.update({
          where: { id: item.id },
          data: {
            countedQty: item.countedQty,
            variance:   item.countedQty - (stockCount.items.find(i => i.id === item.id)?.systemQty ?? 0),
            notes:      item.notes || null,
          },
        })
      )
    )
    return NextResponse.json({ success: true })
  }

  // Status update
  if (body.status) {
    if (body.status === 'COMPLETED') {
      if (stockCount.status !== 'REVIEWING') {
        return NextResponse.json({ error: '須為複核中才能完成盤點' }, { status: 400 })
      }
      // Apply variances to inventory
      await prisma.$transaction(async (tx) => {
        for (const item of stockCount.items) {
          if (item.variance !== 0) {
            await tx.inventory.updateMany({
              where: { productId: item.productId, warehouse: stockCount.warehouse.code },
              data:  { quantity: { increment: item.variance } },
            })
            await tx.inventoryTransaction.create({
              data: {
                productId: item.productId, warehouse: stockCount.warehouse.code,
                type: 'ADJUSTMENT', quantity: Math.abs(item.variance),
                beforeQty: item.systemQty, afterQty: item.countedQty,
                referenceType: 'STOCK_COUNT', referenceId: stockCount.countNo,
                notes: `盤點調整 ${stockCount.countNo}（差異 ${item.variance > 0 ? '+' : ''}${item.variance}）`,
                createdById: session.user.id,
              },
            })
          }
        }
        await tx.stockCount.update({
          where: { id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
      })
      return NextResponse.json({ success: true })
    }

    const updated = await prisma.stockCount.update({
      where: { id },
      data: { status: body.status },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: '無效操作' }, { status: 400 })
}
