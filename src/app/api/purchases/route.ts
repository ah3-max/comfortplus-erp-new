import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search    = searchParams.get('search')    ?? ''
  const status    = searchParams.get('status')    ?? ''
  const orderType = searchParams.get('orderType') ?? ''

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      ...(search && {
        OR: [
          { poNo:     { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } },
          { projectNo: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status    && { status:    status    as never }),
      ...(orderType && { orderType: orderType as never }),
    },
    include: {
      supplier:  { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
      _count: { select: { receipts: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.supplierId || !body.items?.length) {
    return NextResponse.json({ error: '請選擇供應商並至少新增一項商品' }, { status: 400 })
  }

  const poNo = await generateSequenceNo('PURCHASE_ORDER')

  const itemsTotal = body.items.reduce(
    (sum: number, item: { quantity: number; unitCost: number }) => sum + item.quantity * item.unitCost, 0
  )
  const taxAmount   = body.taxAmount   ? Number(body.taxAmount)   : null
  const freightCost = body.freightCost ? Number(body.freightCost) : 0
  const otherCost   = body.otherCost   ? Number(body.otherCost)   : 0
  const totalAmount = itemsTotal + (taxAmount ?? 0) + freightCost + otherCost

  const order = await prisma.purchaseOrder.create({
    data: {
      poNo,
      supplierId:  body.supplierId,
      createdById: session.user.id,
      applicantId: body.applicantId || null,
      purchaserId: body.purchaserId || null,
      status:      'DRAFT',
      orderType:   body.orderType ?? 'FINISHED_GOODS',
      currency:            body.currency            ?? 'TWD',
      exchangeRate:        body.exchangeRate         ? Number(body.exchangeRate) : null,
      deliveryTerm:        body.deliveryTerm         || null,
      paymentTerm:         body.paymentTerm          || null,
      subtotal:            itemsTotal,
      taxRate:             body.taxRate              ? Number(body.taxRate)      : null,
      taxAmount,
      freightCost,
      otherCost,
      specVersion:         body.specVersion          || null,
      inspectionCriteria:  body.inspectionCriteria   || null,
      warehouse:           body.warehouse            || null,
      projectNo:           body.projectNo            || null,
      expectedDate:        body.expectedDate         ? new Date(body.expectedDate) : null,
      // OEM 基本資訊
      oemProjectNo:             body.oemProjectNo             || null,
      factory:                  body.factory                  || null,
      sampleVersion:            body.sampleVersion            || null,
      packagingVersion:         body.packagingVersion         || null,
      productionBatch:          body.productionBatch          || null,
      inspectionRequirements:   body.inspectionRequirements   || null,
      shippingLabelRequirements: body.shippingLabelRequirements || null,
      customNotes:              body.customNotes              || null,
      // OEM 排程
      plannedStartDate:        body.plannedStartDate        ? new Date(body.plannedStartDate)        : null,
      plannedEndDate:          body.plannedEndDate          ? new Date(body.plannedEndDate)          : null,
      packagingReadyDate:      body.packagingReadyDate      ? new Date(body.packagingReadyDate)      : null,
      productionConfirmedDate: body.productionConfirmedDate ? new Date(body.productionConfirmedDate) : null,
      factoryShipDate:         body.factoryShipDate         ? new Date(body.factoryShipDate)         : null,
      inspectionDate:          body.inspectionDate          ? new Date(body.inspectionDate)          : null,
      defectRate:              body.defectRate              ? Number(body.defectRate)     : null,
      defectResponsibility:    body.defectResponsibility    || null,
      lossRate:                body.lossRate                ? Number(body.lossRate)       : null,
      finalUnitCost:           body.finalUnitCost           ? Number(body.finalUnitCost)  : null,
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
    include: { supplier: true, items: true },
  })

  return NextResponse.json(order, { status: 201 })
}
