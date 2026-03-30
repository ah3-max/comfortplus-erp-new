import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!po) return NextResponse.json({ error: '找不到採購單' }, { status: 404 })
  if (!['CONFIRMED', 'PARTIAL'].includes(po.status)) {
    return NextResponse.json({ error: '採購單須為已確認或部分到貨狀態才能驗收' }, { status: 400 })
  }

  const receiveItems: Array<{ productId: string; quantity: number }> = body.items.filter(
    (i: { productId: string; quantity: number }) => i.quantity > 0
  )
  if (receiveItems.length === 0) {
    return NextResponse.json({ error: '請設定至少一項到貨數量' }, { status: 400 })
  }

  // 驗證到貨數量不超過未到量
  for (const ri of receiveItems) {
    const poi = po.items.find((i) => i.productId === ri.productId)
    if (!poi) return NextResponse.json({ error: '商品不在採購單中' }, { status: 400 })
    const remaining = poi.quantity - poi.receivedQty
    if (ri.quantity > remaining) {
      return NextResponse.json({ error: `到貨數量超過未到量（最多 ${remaining}）` }, { status: 400 })
    }
  }

  // 產生驗收單號
  const count = await prisma.purchaseReceipt.count()
  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const receiptNo = `GR${dateStr}${String(count + 1).padStart(4, '0')}`

  await prisma.$transaction(async (tx) => {
    // 建立驗收單
    await tx.purchaseReceipt.create({
      data: {
        receiptNo,
        orderId: id,
        createdById: session.user.id,
        notes: body.notes || null,
        items: {
          create: receiveItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
      },
    })

    // 更新採購明細已到貨數量
    for (const ri of receiveItems) {
      const poi = po.items.find((i) => i.productId === ri.productId)!
      await tx.purchaseOrderItem.update({
        where: { id: poi.id },
        data: { receivedQty: { increment: ri.quantity } },
      })
    }

    // 入庫（Inventory + InventoryTransaction）
    const receiveWarehouse = po.warehouse ?? 'MAIN'
    for (const ri of receiveItems) {
      const inv = await tx.inventory.upsert({
        where: { productId_warehouse_category: { productId: ri.productId, warehouse: receiveWarehouse, category: 'FINISHED_GOODS' } },
        update: { quantity: { increment: ri.quantity } },
        create: { productId: ri.productId, warehouse: receiveWarehouse, category: 'FINISHED_GOODS', quantity: ri.quantity, safetyStock: 0 },
      })

      await tx.inventoryTransaction.create({
        data: {
          productId: ri.productId,
          warehouse: receiveWarehouse,
          category: 'FINISHED_GOODS',
          type: 'IN',
          quantity: ri.quantity,
          beforeQty: inv.quantity - ri.quantity,
          afterQty: inv.quantity,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: receiptNo,
          notes: `進貨驗收 ${receiptNo}`,
          createdById: session.user.id,
        },
      })
    }

    // 更新採購單狀態（全部到齊 → RECEIVED，部分 → PARTIAL）
    const updatedItems = await tx.purchaseOrderItem.findMany({ where: { orderId: id } })
    const allReceived = updatedItems.every((i) => i.receivedQty >= i.quantity)
    await tx.purchaseOrder.update({
      where: { id },
      data: { status: allReceived ? 'RECEIVED' : 'PARTIAL' },
    })
  })

  return NextResponse.json({ success: true, receiptNo })
  } catch (error) { return handleApiError(error, 'purchases.receive') }
}
