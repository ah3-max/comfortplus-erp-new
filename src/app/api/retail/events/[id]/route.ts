import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const event = await prisma.retailEvent.update({
    where: { id },
    data: {
      eventType:             body.eventType             ?? undefined,
      eventName:             body.eventName             ?? undefined,
      eventStatus:           body.eventStatus           ?? undefined,
      eventDate:             body.eventDate             ? new Date(body.eventDate) : undefined,
      endDate:               body.endDate               !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
      location:              body.location              !== undefined ? (body.location || null) : undefined,
      budget:                body.budget                !== undefined ? (body.budget ? Number(body.budget) : null) : undefined,
      actualCost:            body.actualCost            !== undefined ? (body.actualCost ? Number(body.actualCost) : null) : undefined,
      staffNote:             body.staffNote             !== undefined ? (body.staffNote || null) : undefined,
      setupRequirements:     body.setupRequirements     !== undefined ? (body.setupRequirements || null) : undefined,
      productRequirements:   body.productRequirements   !== undefined ? (body.productRequirements || null) : undefined,
      communicationNote:     body.communicationNote     !== undefined ? (body.communicationNote || null) : undefined,
      attendeeCount:         body.attendeeCount         !== undefined ? (body.attendeeCount ? Number(body.attendeeCount) : null) : undefined,
      sampleQty:             body.sampleQty             !== undefined ? (body.sampleQty ? Number(body.sampleQty) : null) : undefined,
      ordersTaken:           body.ordersTaken           !== undefined ? (body.ordersTaken ? Number(body.ordersTaken) : null) : undefined,
      leadsCollected:        body.leadsCollected        !== undefined ? (body.leadsCollected ? Number(body.leadsCollected) : null) : undefined,
      revenueDuringEvent:    body.revenueDuringEvent    !== undefined ? (body.revenueDuringEvent ? Number(body.revenueDuringEvent) : null) : undefined,
      unitsSoldDuringEvent:  body.unitsSoldDuringEvent  !== undefined ? (body.unitsSoldDuringEvent ? Number(body.unitsSoldDuringEvent) : null) : undefined,
      couponRedeemed:        body.couponRedeemed        !== undefined ? (body.couponRedeemed ? Number(body.couponRedeemed) : null) : undefined,
      newCustomersCollected: body.newCustomersCollected !== undefined ? (body.newCustomersCollected ? Number(body.newCustomersCollected) : null) : undefined,
      roi:                   body.roi                   !== undefined ? (body.roi ? Number(body.roi) : null) : undefined,
      targetAchievementPct:  body.targetAchievementPct !== undefined ? (body.targetAchievementPct ? Number(body.targetAchievementPct) : null) : undefined,
      performanceSummary:    body.performanceSummary    !== undefined ? (body.performanceSummary || null) : undefined,
      nextActionNote:        body.nextActionNote        !== undefined ? (body.nextActionNote || null) : undefined,
      notes:                 body.notes                 !== undefined ? (body.notes || null) : undefined,
    },
    include: {
      outlet:  { select: { id: true, outletName: true } },
      groupBuy: true,
    },
  })

  // 更新團購資訊
  if (body.groupBuy && event.groupBuy) {
    const gb = body.groupBuy
    await prisma.retailGroupBuy.update({
      where: { eventId: id },
      data: {
        groupBuyTitle:  gb.groupBuyTitle   ?? undefined,
        organizer:      gb.organizer       !== undefined ? (gb.organizer || null) : undefined,
        organizerPhone: gb.organizerPhone  !== undefined ? (gb.organizerPhone || null) : undefined,
        platform:       gb.platform        !== undefined ? (gb.platform || null) : undefined,
        minQty:         gb.minQty          !== undefined ? Number(gb.minQty) : undefined,
        targetQty:      gb.targetQty       !== undefined ? (gb.targetQty ? Number(gb.targetQty) : null) : undefined,
        groupBuyPrice:  gb.groupBuyPrice   !== undefined ? Number(gb.groupBuyPrice) : undefined,
        status:         gb.status          ?? undefined,
        actualOrders:   gb.actualOrders    !== undefined ? (gb.actualOrders ? Number(gb.actualOrders) : null) : undefined,
        actualQty:      gb.actualQty       !== undefined ? (gb.actualQty ? Number(gb.actualQty) : null) : undefined,
        actualRevenue:  gb.actualRevenue   !== undefined ? (gb.actualRevenue ? Number(gb.actualRevenue) : null) : undefined,
        fulfillmentNote: gb.fulfillmentNote !== undefined ? (gb.fulfillmentNote || null) : undefined,
      },
    })
  }

  return NextResponse.json(event)
}
