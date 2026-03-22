import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

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
      palletCount:      body.palletCount      !== undefined ? body.palletCount : undefined,
      boxCount:         body.boxCount         !== undefined ? body.boxCount    : undefined,
      weight:           body.weight           !== undefined ? body.weight      : undefined,
      volume:           body.volume           ?? undefined,
      oceanFreight:      body.oceanFreight      !== undefined ? body.oceanFreight : undefined,
      notes:            body.notes            ?? undefined,
    },
    include: {
      productionOrder: { select: { id: true, productionNo: true } },
      purchaseOrder:   { select: { id: true, poNo: true } },
    },
  })

  return NextResponse.json(freight)
}
