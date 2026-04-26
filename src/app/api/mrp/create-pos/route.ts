import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'PROCUREMENT']

interface CreatePosItem {
  productId: string
  supplierId: string
  qty: number
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { skus }: { skus: CreatePosItem[] } = await req.json()
    if (!Array.isArray(skus) || skus.length === 0) {
      return NextResponse.json({ error: '無可建立的 SKU' }, { status: 400 })
    }

    // Get product cost prices
    const productIds = [...new Set(skus.map(s => s.productId))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, costPrice: true, sku: true, name: true },
    })
    const productMap = new Map(products.map(p => [p.id, p]))

    // Get last purchase unit cost as fallback
    const lastCosts = await prisma.purchaseOrderItem.findMany({
      where: { productId: { in: productIds } },
      orderBy: { order: { purchaseDate: 'desc' } },
      distinct: ['productId'],
      select: { productId: true, unitCost: true },
    })
    const lastCostMap = new Map(lastCosts.map(c => [c.productId, Number(c.unitCost)]))

    // Group by supplierId
    const bySupplier = new Map<string, CreatePosItem[]>()
    for (const sku of skus) {
      if (!bySupplier.has(sku.supplierId)) bySupplier.set(sku.supplierId, [])
      bySupplier.get(sku.supplierId)!.push(sku)
    }

    const created: string[] = []

    for (const [supplierId, items] of bySupplier) {
      const poItems = items.map(item => {
        const product = productMap.get(item.productId)
        const unitCost = lastCostMap.get(item.productId) ?? Number(product?.costPrice ?? 0)
        return { productId: item.productId, quantity: item.qty, unitCost, subtotal: item.qty * unitCost }
      })

      const subtotal = poItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)
      const poNo = await generateSequenceNo('PURCHASE_ORDER')

      const po = await prisma.purchaseOrder.create({
        data: {
          poNo,
          supplierId,
          createdById: session.user.id,
          status: 'DRAFT',
          orderType: 'FINISHED_GOODS',
          subtotal,
          totalAmount: subtotal,
          items: {
            create: poItems,
          },
        },
        select: { poNo: true },
      })
      created.push(po.poNo)
    }

    return NextResponse.json({ created: created.length, poNos: created })
  } catch (error) {
    return handleApiError(error, 'mrp.create-pos')
  }
}
