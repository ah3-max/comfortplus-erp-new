import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier:  true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      receipts: {
        include: {
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // 僅更新狀態
  if (body.statusOnly) {
    const order = await prisma.purchaseOrder.update({ where: { id }, data: { status: body.status } })
    return NextResponse.json(order)
  }

  // 付款登錄
  if (body.paymentOnly) {
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { paidAmount: Number(body.paidAmount) },
    })
    return NextResponse.json(order)
  }

  // OEM 進度更新（排程 + 品質結算）
  if (body.oemUpdate) {
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        // OEM 基本
        oemProjectNo:              body.oemProjectNo             || null,
        factory:                   body.factory                  || null,
        sampleVersion:             body.sampleVersion            || null,
        packagingVersion:          body.packagingVersion         || null,
        productionBatch:           body.productionBatch          || null,
        inspectionRequirements:    body.inspectionRequirements   || null,
        shippingLabelRequirements: body.shippingLabelRequirements || null,
        customNotes:               body.customNotes              || null,
        // OEM 排程
        plannedStartDate:          body.plannedStartDate          ? new Date(body.plannedStartDate)          : null,
        plannedEndDate:            body.plannedEndDate            ? new Date(body.plannedEndDate)            : null,
        packagingReadyDate:        body.packagingReadyDate        ? new Date(body.packagingReadyDate)        : null,
        productionConfirmedDate:   body.productionConfirmedDate   ? new Date(body.productionConfirmedDate)   : null,
        factoryShipDate:           body.factoryShipDate           ? new Date(body.factoryShipDate)           : null,
        inspectionDate:            body.inspectionDate            ? new Date(body.inspectionDate)            : null,
        defectRate:                body.defectRate                ? Number(body.defectRate)    : null,
        defectResponsibility:      body.defectResponsibility      || null,
        lossRate:                  body.lossRate                  ? Number(body.lossRate)      : null,
        finalUnitCost:             body.finalUnitCost             ? Number(body.finalUnitCost) : null,
      },
    })
    return NextResponse.json(order)
  }

  // 完整編輯（DRAFT 或 PENDING_APPROVAL 狀態）
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['DRAFT', 'PENDING_APPROVAL', 'SOURCING'].includes(existing.status)) {
    return NextResponse.json({ error: '只能編輯草稿/審核/詢價階段的採購單' }, { status: 400 })
  }

  const itemsTotal = body.items.reduce(
    (sum: number, item: { quantity: number; unitCost: number }) => sum + item.quantity * item.unitCost, 0
  )
  const taxAmount  = body.taxAmount ? Number(body.taxAmount) : null
  const totalAmount = itemsTotal + (taxAmount ?? 0)

  await prisma.purchaseOrderItem.deleteMany({ where: { orderId: id } })

  const order = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      supplierId:          body.supplierId,
      orderType:           body.orderType           ?? existing.orderType,
      specVersion:         body.specVersion         || null,
      taxRate:             body.taxRate             ? Number(body.taxRate)  : null,
      taxAmount,
      inspectionCriteria:  body.inspectionCriteria  || null,
      warehouse:           body.warehouse           || null,
      projectNo:           body.projectNo           || null,
      expectedDate:        body.expectedDate        ? new Date(body.expectedDate) : null,
      // OEM 基本（在草稿階段可直接編輯）
      oemProjectNo:              body.oemProjectNo             || null,
      factory:                   body.factory                  || null,
      sampleVersion:             body.sampleVersion            || null,
      packagingVersion:          body.packagingVersion         || null,
      productionBatch:           body.productionBatch          || null,
      inspectionRequirements:    body.inspectionRequirements   || null,
      shippingLabelRequirements: body.shippingLabelRequirements || null,
      customNotes:               body.customNotes              || null,
      totalAmount,
      notes: body.notes || null,
      items: {
        create: body.items.map((item: { productId: string; quantity: number; unitCost: number }) => ({
          productId: item.productId,
          quantity:  item.quantity,
          unitCost:  item.unitCost,
          subtotal:  item.quantity * item.unitCost,
        })),
      },
    },
    include: { items: true },
  })

  return NextResponse.json(order)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const order = await prisma.purchaseOrder.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 'DRAFT') {
    return NextResponse.json({ error: '只能刪除草稿狀態的採購單' }, { status: 400 })
  }

  await prisma.purchaseOrder.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
