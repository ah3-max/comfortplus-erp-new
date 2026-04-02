import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { shipmentScope, buildScopeContext } from '@/lib/scope'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search         = searchParams.get('search')         ?? ''
    const status         = searchParams.get('status')         ?? ''
    const deliveryMethod = searchParams.get('deliveryMethod') ?? ''
    const anomaly        = searchParams.get('anomaly') === 'true'
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

    // Data scope: SALES/CS only see shipments for their own orders
    const scope = shipmentScope(buildScopeContext(session as { user: { id: string; role: string } }))

    const where = {
      ...scope,
      ...(search && {
        OR: [
          { shipmentNo: { contains: search, mode: 'insensitive' as const } },
          { order: { customer: { name: { contains: search, mode: 'insensitive' as const } } } },
          { trackingNo: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status         && { status: status.includes(',') ? { in: status.split(',') } as never : status as never }),
      ...(deliveryMethod && { deliveryMethod: deliveryMethod as never }),
      ...(anomaly        && { anomalyStatus: { not: 'NORMAL' as never } }),
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where: where as never,
        include: {
          order: {
            include: { customer: { select: { name: true, code: true, address: true } } },
          },
          logisticsProvider: { select: { id: true, code: true, name: true } },
          trip:              { select: { id: true, tripNo: true, driverName: true } },
          createdBy:         { select: { name: true } },
          items: {
            include: { product: { select: { sku: true, name: true, unit: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.shipment.count({ where: where as never }),
    ])

    return NextResponse.json({
      data: shipments,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'shipments.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    if (!body.orderId || !body.items?.length) {
      return NextResponse.json({ error: '請選擇訂單並至少新增一項商品' }, { status: 400 })
    }

    const wh = body.warehouse ?? 'MAIN'

    // 檢查庫存是否足夠
    for (const item of body.items as { productId: string; quantity: number }[]) {
      const inv = await prisma.inventory.findFirst({
        where: { productId: item.productId, warehouse: wh, category: 'FINISHED_GOODS' },
      })
      if (!inv || inv.quantity < item.quantity) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } })
        return NextResponse.json(
          { error: `商品「${product?.name ?? item.productId}」庫存不足（現有：${inv?.quantity ?? 0}）` },
          { status: 400 }
        )
      }
    }

    const shipmentNo = await generateSequenceNo('SHIPMENT')

    // 自動帶入客戶配送注意事項（司機/倉儲專屬備注）
    const order = await prisma.salesOrder.findUnique({
      where: { id: body.orderId },
      include: { customer: { include: { deliveryProfile: true } } },
    })
    const deliveryProfile = order?.customer?.deliveryProfile
    const autoDriverNotes = [
      deliveryProfile?.driverNotes,
      deliveryProfile?.parkingNotes,
      deliveryProfile?.parkingSpot ? `停車位：${deliveryProfile.parkingSpot}` : null,
      deliveryProfile?.elevatorDimensions ? `電梯：${deliveryProfile.elevatorDimensions}` : null,
      deliveryProfile?.routeNotes,
    ].filter(Boolean).join('\n') || null

    const combinedNotes = [body.notes, autoDriverNotes].filter(Boolean).join('\n---\n') || null

    const shipment = await prisma.$transaction(async (tx) => {
      const newShipment = await tx.shipment.create({
        data: {
          shipmentNo,
          orderId:              body.orderId,
          createdById:          session.user.id,
          status:               'PREPARING',
          deliveryMethod:       body.deliveryMethod       ?? 'EXPRESS',
          logisticsProviderId:  body.logisticsProviderId  || null,
          warehouse:            wh,
          address:              body.address              || null,
          carrier:              body.carrier              || null,
          trackingNo:           body.trackingNo           || null,
          palletCount:          body.palletCount          ? Number(body.palletCount) : null,
          boxCount:             body.boxCount             ? Number(body.boxCount)    : null,
          weight:               body.weight               ? Number(body.weight)      : null,
          volume:               body.volume               || null,
          expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null,
          notes:                combinedNotes,
          items: {
            create: (body.items as { productId: string; quantity: number; boxCount?: number; notes?: string }[])
              .map(item => ({
                productId: item.productId,
                quantity:  item.quantity,
                boxCount:  item.boxCount  ?? null,
                notes:     item.notes     ?? null,
              })),
          },
        },
        include: { items: true },
      })

      // 扣減庫存並記錄交易（SELECT FOR UPDATE 行級鎖，防止並發超賣）
      for (const item of body.items as { productId: string; quantity: number }[]) {
        const rows = await tx.$queryRaw<Array<{ id: string; quantity: number }>>`
          SELECT id, quantity FROM "Inventory"
          WHERE "productId" = ${item.productId}
            AND warehouse = ${wh}
            AND category = 'FINISHED_GOODS'
          FOR UPDATE
        `
        const inv = rows[0]
        if (inv) {
          if (inv.quantity < item.quantity) {
            const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true } })
            throw new Error(`庫存不足：${product?.name ?? item.productId}（現有 ${inv.quantity}，需求 ${item.quantity}）`)
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
              productId:     item.productId,
              warehouse:     wh,
              category:      'FINISHED_GOODS',
              type:          'OUT',
              quantity:      item.quantity,
              beforeQty:     inv.quantity,
              afterQty:      inv.quantity - item.quantity,
              referenceType: 'SHIPMENT',
              referenceId:   newShipment.id,
              createdById:   session.user.id,
            },
          })
        }

        await tx.salesOrderItem.updateMany({
          where: { orderId: body.orderId, productId: item.productId },
          data: { shippedQty: { increment: item.quantity } },
        })
      }

      await tx.salesOrder.update({
        where: { id: body.orderId },
        data: { status: 'READY_TO_SHIP' },
      })

      return newShipment
    })

    return NextResponse.json(shipment, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'shipments.create')
  }
}
