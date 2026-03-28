import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Check if status is changing to RECEIVED (到倉)
  const isArrivingAtWarehouse = body.status === 'RECEIVED'

  // If arriving, fetch current status first to avoid duplicate inbound
  let previousStatus: string | null = null
  if (isArrivingAtWarehouse) {
    const current = await prisma.seaFreight.findUnique({ where: { id }, select: { status: true } })
    previousStatus = current?.status ?? null
  }

  const freight = await prisma.seaFreight.update({
    where: { id },
    data: {
      status:           body.status           ?? undefined,
      customsStatus:    body.customsStatus    ?? undefined,
      containerNo:      body.containerNo      ?? undefined,
      vesselName:       body.vesselName       ?? undefined,
      voyageNo:         body.voyageNo         ?? undefined,
      bookingNo:        body.bookingNo        ?? undefined,
      blNo:             body.blNo             ?? undefined,
      portOfLoading:    body.portOfLoading    ?? undefined,
      portOfDischarge:  body.portOfDischarge  ?? undefined,
      etd:              body.etd              ? new Date(body.etd) : undefined,
      eta:              body.eta              ? new Date(body.eta) : undefined,
      actualDeparture:  body.actualDeparture  ? new Date(body.actualDeparture) : undefined,
      actualArrival:    body.actualArrival    ? new Date(body.actualArrival)   : undefined,
      warehouseInDate:  isArrivingAtWarehouse ? new Date() : undefined,
      palletCount:      body.palletCount      !== undefined ? body.palletCount : undefined,
      boxCount:         body.boxCount         !== undefined ? body.boxCount    : undefined,
      weight:           body.weight           !== undefined ? body.weight      : undefined,
      volume:           body.volume           ?? undefined,
      oceanFreight:     body.oceanFreight     !== undefined ? body.oceanFreight : undefined,
      notes:            body.notes            ?? undefined,
    },
    include: {
      productionOrder: { select: { id: true, productionNo: true } },
      purchaseOrder:   {
        select: {
          id: true,
          poNo: true,
          supplierId: true,
          warehouse: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              receivedQty: true,
              nameSnap: true,
            },
          },
        },
      },
    },
  })

  // ── 到倉自動建立入庫單 ──────────────────────────────────
  if (isArrivingAtWarehouse && previousStatus !== 'RECEIVED' && freight.purchaseOrder) {
    const po = freight.purchaseOrder
    const warehouseCode = po.warehouse ?? 'MAIN'

    // Find warehouse by code
    const warehouse = await prisma.warehouse.findFirst({
      where: { code: warehouseCode },
    })

    if (warehouse) {
      // Check if inbound already exists for this sea freight
      const existingInbound = await prisma.inboundRecord.findFirst({
        where: { seaFreightId: id },
      })

      if (!existingInbound) {
        const inboundNo = await generateSequenceNo('INBOUND')

        // Create InboundRecord with items from PO
        const pendingItems = po.items
          .filter(item => item.productId && item.quantity > item.receivedQty)
          .map(item => ({
            productId: item.productId!,
            quantity: item.quantity - item.receivedQty,
            expectedQty: item.quantity - item.receivedQty,
          }))

        if (pendingItems.length > 0) {
          await prisma.inboundRecord.create({
            data: {
              inboundNo,
              warehouseId: warehouse.id,
              sourceType: 'SEA_FREIGHT',
              sourceId: po.id,
              seaFreightId: id,
              arrivalDate: new Date(),
              putawayStatus: 'PENDING',
              notes: `海運到倉自動建立 — ${freight.freightNo} / ${po.poNo}`,
              items: {
                create: pendingItems,
              },
            },
          })
        }
      }
    }
  }

  return NextResponse.json(freight)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const current = await prisma.seaFreight.findUnique({ where: { id }, select: { id: true, status: true, freightNo: true } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (current.status !== 'PENDING') {
      return NextResponse.json({ error: '只能刪除待處理狀態的海運記錄' }, { status: 400 })
    }

    await prisma.seaFreight.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'sea-freight.DELETE')
  }
}
