import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/dispatch — 一鍵派車出貨
 *
 * 自動完成：
 *   1. 建立出貨單 (Shipment)
 *   2. 扣庫存 + 建 InventoryTransaction
 *   3. 更新訂單狀態 → ALLOCATING
 *   4. (可選) 建配送趟次 (DeliveryTrip) 並綁定出貨單
 *
 * body: {
 *   orderId: string,
 *   vehicleNo?: string,    // 車牌（選填，有就自動建趟次）
 *   driverName?: string,
 *   driverPhone?: string,
 *   notes?: string,
 * }
 */
export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { orderId } = body

  if (!orderId) return NextResponse.json({ error: '缺少 orderId' }, { status: 400 })

  // Load order with items
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      customer: { select: { name: true, address: true } },
    },
  })

  if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
  if (!['CONFIRMED', 'ALLOCATING', 'READY_TO_SHIP'].includes(order.status)) {
    return NextResponse.json({ error: `訂單狀態 ${order.status} 無法出貨` }, { status: 400 })
  }

  // Items to ship (unshipped quantities)
  const shipItems = order.items
    .filter(i => i.quantity > i.shippedQty)
    .map(i => ({ productId: i.productId, quantity: i.quantity - i.shippedQty }))

  if (shipItems.length === 0) {
    return NextResponse.json({ error: '沒有待出貨品項' }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Check inventory
    for (const item of shipItems) {
      const inv = await tx.inventory.findFirst({
        where: { productId: item.productId, warehouse: 'MAIN', category: 'FINISHED_GOODS' },
      })
      if (!inv || inv.quantity < item.quantity) {
        const product = order.items.find(i => i.productId === item.productId)
        throw new Error(`庫存不足：${product?.product.name ?? item.productId}（需要 ${item.quantity}，庫存 ${inv?.quantity ?? 0}）`)
      }
    }

    // 2. Create shipment
    const shipmentNo = await generateSequenceNo('SHIPMENT')
    const shipment = await tx.shipment.create({
      data: {
        shipmentNo,
        orderId,
        createdById: session.user.id,
        status: 'PREPARING',
        deliveryMethod: 'OWN_FLEET',
        carrier: body.vehicleNo ? `自有車 ${body.vehicleNo}` : '自行配送',
        address: order.customer?.address ?? null,
        warehouse: 'MAIN',
        notes: body.notes ?? null,
        items: {
          create: shipItems.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
      },
    })

    // 3. Deduct inventory
    for (const item of shipItems) {
      const inv = await tx.inventory.findFirst({
        where: { productId: item.productId, warehouse: 'MAIN', category: 'FINISHED_GOODS' },
      })
      if (inv) {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: { decrement: item.quantity } },
        })
        await tx.inventoryTransaction.create({
          data: {
            productId: item.productId,
            warehouse: 'MAIN',
            category: 'FINISHED_GOODS',
            type: 'OUT',
            quantity: item.quantity,
            beforeQty: inv.quantity,
            afterQty: inv.quantity - item.quantity,
            referenceType: 'SHIPMENT',
            referenceId: shipment.id,
            notes: `一鍵出貨 ${shipmentNo}`,
          },
        })
      }

      // Update order item shippedQty
      const orderItem = order.items.find(i => i.productId === item.productId)
      if (orderItem) {
        await tx.salesOrderItem.update({
          where: { id: orderItem.id },
          data: { shippedQty: { increment: item.quantity } },
        })
      }
    }

    // 4. Update order status
    await tx.salesOrder.update({
      where: { id: orderId },
      data: { status: 'ALLOCATING' },
    })

    // 5. Auto-create delivery trip if vehicle info provided
    let trip = null
    if (body.vehicleNo || body.driverName) {
      const tripNo = await generateSequenceNo('TRIP')
      trip = await tx.deliveryTrip.create({
        data: {
          tripNo,
          vehicleNo: body.vehicleNo ?? null,
          driverName: body.driverName ?? null,
          driverPhone: body.driverPhone ?? null,
          tripDate: new Date(),
          status: 'PLANNED',
        },
      })
      // Bind shipment to trip
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { tripId: trip.id },
      })
    }

    return { shipment, trip }
  })

  return NextResponse.json({
    success: true,
    shipmentNo: result.shipment.shipmentNo,
    tripNo: result.trip?.tripNo ?? null,
    message: result.trip
      ? `出貨單 ${result.shipment.shipmentNo} 已建立，配送趟次 ${result.trip.tripNo} 已排定`
      : `出貨單 ${result.shipment.shipmentNo} 已建立`,
  })
  } catch (error) {
    return handleApiError(error, 'dispatch.POST')
  }
}
