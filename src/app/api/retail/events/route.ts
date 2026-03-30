import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const outletId    = searchParams.get('outletId')
  const eventStatus = searchParams.get('status')
  const eventType   = searchParams.get('type')

  const events = await prisma.retailEvent.findMany({
    where: {
      ...(outletId    && { outletId }),
      ...(eventStatus && { eventStatus }),
      ...(eventType   && { eventType }),
    },
    include: {
      outlet: { select: { id: true, outletName: true, brand: { select: { name: true } } } },
      groupBuy: true,
    },
    orderBy: { eventDate: 'desc' },
  })

  return NextResponse.json(events)
  } catch (error) {
    return handleApiError(error, 'retailEvents.get')
  }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.eventName || !body.eventType || !body.eventDate) {
    return NextResponse.json({ error: '請填寫活動名稱、類型與日期' }, { status: 400 })
  }

  const event = await prisma.retailEvent.create({
    data: {
      outletId:              body.outletId              || null,
      channelId:             body.channelId             || null,
      customerId:            body.customerId            || null,
      eventType:             body.eventType,
      eventName:             body.eventName,
      eventStatus:           body.eventStatus           || 'PLANNING',
      eventDate:             new Date(body.eventDate),
      endDate:               body.endDate               ? new Date(body.endDate) : null,
      location:              body.location              || null,
      budget:                body.budget                ? Number(body.budget) : null,
      actualCost:            body.actualCost            ? Number(body.actualCost) : null,
      staffIds:              body.staffIds              || [],
      staffNote:             body.staffNote             || null,
      setupRequirements:     body.setupRequirements     || null,
      productRequirements:   body.productRequirements   || null,
      communicationNote:     body.communicationNote     || null,
      attendeeCount:         body.attendeeCount         ? Number(body.attendeeCount) : null,
      sampleQty:             body.sampleQty             ? Number(body.sampleQty) : null,
      ordersTaken:           body.ordersTaken           ? Number(body.ordersTaken) : null,
      leadsCollected:        body.leadsCollected        ? Number(body.leadsCollected) : null,
      revenueDuringEvent:    body.revenueDuringEvent    ? Number(body.revenueDuringEvent) : null,
      unitsSoldDuringEvent:  body.unitsSoldDuringEvent  ? Number(body.unitsSoldDuringEvent) : null,
      couponRedeemed:        body.couponRedeemed        ? Number(body.couponRedeemed) : null,
      newCustomersCollected: body.newCustomersCollected ? Number(body.newCustomersCollected) : null,
      roi:                   body.roi                   ? Number(body.roi) : null,
      targetAchievementPct:  body.targetAchievementPct ? Number(body.targetAchievementPct) : null,
      performanceSummary:    body.performanceSummary    || null,
      nextActionNote:        body.nextActionNote        || null,
      notes:                 body.notes                 || null,
    },
    include: {
      outlet: { select: { id: true, outletName: true } },
      groupBuy: true,
    },
  })

  // 如果是團購活動，同步建立 RetailGroupBuy
  if (body.eventType === 'GROUP_BUY' && body.groupBuy) {
    const gb = body.groupBuy
    await prisma.retailGroupBuy.create({
      data: {
        eventId:         event.id,
        outletId:        body.outletId || null,
        groupBuyTitle:   gb.groupBuyTitle || body.eventName,
        organizer:       gb.organizer        || null,
        organizerPhone:  gb.organizerPhone   || null,
        organizerLine:   gb.organizerLine    || null,
        platform:        gb.platform         || null,
        minQty:          Number(gb.minQty)   || 1,
        targetQty:       gb.targetQty        ? Number(gb.targetQty) : null,
        groupBuyPrice:   Number(gb.groupBuyPrice) || 0,
        originalPrice:   gb.originalPrice    ? Number(gb.originalPrice) : null,
        discountNote:    gb.discountNote     || null,
        includedProducts: gb.includedProducts || null,
        openDate:        new Date(gb.openDate || body.eventDate),
        closeDate:       new Date(gb.closeDate || body.endDate || body.eventDate),
        shipDate:        gb.shipDate         ? new Date(gb.shipDate) : null,
        status:          gb.status           || 'OPEN',
        notes:           gb.notes            || null,
      },
    })
  }

  return NextResponse.json(event, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'retailEvents.post')
  }
}
