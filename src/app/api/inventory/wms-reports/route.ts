import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now  = new Date()
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const dormantDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const [lowStock, expiryLots, dormantItems, totalValue, byCategory, byWarehouse] = await Promise.all([
    // 低庫存清單
    prisma.inventory.findMany({
      where: { safetyStock: { gt: 0 } },
      include: { product: { select: { sku: true, name: true, unit: true, category: true } } },
      orderBy: { quantity: 'asc' },
    }).then(items => items.filter(i => i.quantity <= i.safetyStock)),

    // 近效期批號 (30天內)
    prisma.inventoryLot.findMany({
      where: {
        expiryDate: { lte: soon },
        status:     { not: 'SCRAPPED' },
        quantity:   { gt: 0 },
      },
      include: {
        product:   { select: { sku: true, name: true, unit: true } },
        warehouse: { select: { code: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
    }),

    // 呆滯庫存 (90天無異動)
    prisma.inventory.findMany({
      where: { quantity: { gt: 0 } },
      include: { product: { select: { sku: true, name: true, unit: true, category: true } } },
    }).then(async (items) => {
      const dormant = []
      for (const inv of items) {
        const lastTx = await prisma.inventoryTransaction.findFirst({
          where: { productId: inv.productId, warehouse: inv.warehouse },
          orderBy: { createdAt: 'desc' },
        })
        if (!lastTx || lastTx.createdAt < dormantDate) {
          dormant.push({ ...inv, lastMovement: lastTx?.createdAt ?? null })
        }
      }
      return dormant
    }),

    // 庫存總值
    prisma.inventory.findMany({
      include: { product: { select: { costPrice: true } } },
    }).then(items =>
      items.reduce((sum, i) => sum + i.quantity * Number(i.product.costPrice), 0)
    ),

    // 分類庫存統計
    prisma.inventory.groupBy({
      by: ['category'],
      _sum: { quantity: true },
    }),

    // 倉庫庫存統計
    prisma.inventory.groupBy({
      by: ['warehouse'],
      _sum: { quantity: true },
    }),
  ])

  return NextResponse.json({
    lowStock,
    expiryLots,
    dormantItems,
    totalValue,
    byCategory,
    byWarehouse,
  })
}
