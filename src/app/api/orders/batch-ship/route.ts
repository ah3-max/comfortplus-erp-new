import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { generateSequenceNo } from '@/lib/sequence'

/**
 * POST /api/orders/batch-ship
 * Create shipments for multiple confirmed sales orders
 * Body: { orderIds: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'WAREHOUSE_MANAGER', 'WAREHOUSE'].includes(role)) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const body = await req.json() as { orderIds: string[] }
    if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
      return NextResponse.json({ error: '請提供訂單 ID 清單' }, { status: 400 })
    }

    const results: { orderId: string; orderNo: string; status: 'created' | 'skipped'; shipmentId?: string; reason?: string }[] = []

    for (const orderId of body.orderIds) {
      const order = await prisma.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          items: { select: { productId: true, quantity: true } },
          customer: { select: { name: true, address: true } },
        },
      })

      if (!order) {
        results.push({ orderId, orderNo: '', status: 'skipped', reason: '找不到訂單' })
        continue
      }
      if (!['CONFIRMED', 'ALLOCATING', 'READY_TO_SHIP'].includes(order.status)) {
        results.push({ orderId, orderNo: order.orderNo, status: 'skipped', reason: `狀態 ${order.status} 無法建立出貨` })
        continue
      }

      // Check if shipment already exists
      const existingShipment = await prisma.shipment.findFirst({
        where: { orderId, status: { notIn: ['FAILED'] } },
      })
      if (existingShipment) {
        results.push({ orderId, orderNo: order.orderNo, status: 'skipped', reason: '已有出貨單', shipmentId: existingShipment.id })
        continue
      }

      const shipmentNo = await generateSequenceNo('SHIPMENT')

      // Resolve warehouse code
      let warehouseCode = 'MAIN'
      if (order.warehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: order.warehouseId }, select: { code: true } })
        if (wh?.code) warehouseCode = wh.code
      }

      let shipmentId: string
      try {
        shipmentId = await prisma.$transaction(async (tx) => {
          const shipment = await tx.shipment.create({
            data: {
              shipmentNo,
              orderId,
              address: order.customer?.address ?? '',
              status: 'PREPARING',
              createdById: session.user.id,
              items: {
                create: order.items.map(item => ({
                  productId: item.productId!,
                  quantity: Number(item.quantity),
                })),
              },
            },
          })

          // Deduct inventory (SELECT FOR UPDATE row-level lock)
          for (const item of order.items) {
            const rows = await tx.$queryRaw<Array<{ id: string; quantity: number }>>`
              SELECT id, quantity FROM "Inventory"
              WHERE "productId" = ${item.productId}
                AND warehouse = ${warehouseCode}
                AND category = 'FINISHED_GOODS'
              FOR UPDATE
            `
            const inv = rows[0]
            if (!inv || inv.quantity < item.quantity) {
              throw new Error(`庫存不足：${item.productId}（需要 ${item.quantity}，現有 ${inv?.quantity ?? 0}）`)
            }
            await tx.inventory.update({
              where: { id: inv.id },
              data: {
                quantity:    { decrement: item.quantity },
                reservedQty: { decrement: item.quantity },
              },
            })
            await tx.inventoryTransaction.create({
              data: {
                productId: item.productId!,
                warehouse: warehouseCode,
                category: 'FINISHED_GOODS',
                type: 'OUT',
                quantity: item.quantity,
                beforeQty: inv.quantity,
                afterQty: inv.quantity - item.quantity,
                referenceType: 'SHIPMENT',
                referenceId: shipment.id,
                notes: `批次出貨 ${shipmentNo}`,
              },
            })
            // Update shippedQty on order items
            await tx.salesOrderItem.updateMany({
              where: { orderId: orderId, productId: item.productId! },
              data: { shippedQty: { increment: item.quantity } },
            })
          }

          // Advance order to READY_TO_SHIP
          if (order.status !== 'READY_TO_SHIP') {
            await tx.salesOrder.update({
              where: { id: orderId },
              data: { status: 'READY_TO_SHIP' },
            })
          }

          return shipment.id
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : '庫存操作失敗'
        results.push({ orderId, orderNo: order.orderNo, status: 'skipped', reason: msg })
        continue
      }

      results.push({ orderId, orderNo: order.orderNo, status: 'created', shipmentId })
    }

    const created = results.filter(r => r.status === 'created')
    const skipped = results.filter(r => r.status === 'skipped')

    return NextResponse.json({
      message: `批次建立出貨完成：${created.length} 筆建立，${skipped.length} 筆略過`,
      created: created.length,
      skipped: skipped.length,
      results,
    })
  } catch (error) {
    return handleApiError(error, 'orders.batchShip')
  }
}
