import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId') ?? ''
  const type = searchParams.get('type') ?? ''
  const limit = Number(searchParams.get('limit') ?? '50')

  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      ...(productId && { productId }),
      ...(type && { type: type as never }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // 批次撈出 productId 清單對應的商品資訊
  const productIds = [...new Set(transactions.map((t) => t.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true, unit: true },
  })
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))

  const result = transactions.map((t) => ({
    ...t,
    product: productMap[t.productId] ?? null,
  }))

  return NextResponse.json(result)
}
