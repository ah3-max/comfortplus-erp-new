import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const outlet = await prisma.retailOutlet.findUnique({
    where: { id },
    include: {
      brand: true,
      events: {
        orderBy: { eventDate: 'desc' },
        take: 20,
        include: { groupBuy: true },
      },
      groupBuys: { orderBy: { openDate: 'desc' }, take: 10 },
      salesPlans: {
        orderBy: { planMonth: 'desc' },
        take: 12,
        include: { product: { select: { id: true, sku: true, name: true } } },
      },
      displayRecords: { orderBy: { visitDate: 'desc' }, take: 5 },
    },
  })

  if (!outlet) return NextResponse.json({ error: '找不到門市' }, { status: 404 })
  return NextResponse.json(outlet)
  } catch (error) {
    return handleApiError(error, 'retailOutlets.get')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const outlet = await prisma.retailOutlet.update({
    where: { id },
    data: {
      brandId:              body.brandId              ?? undefined,
      channelId:            body.channelId            !== undefined ? (body.channelId || null) : undefined,
      outletName:           body.outletName           ?? undefined,
      outletCode:           body.outletCode           !== undefined ? (body.outletCode || null) : undefined,
      address:              body.address              !== undefined ? (body.address || null) : undefined,
      city:                 body.city                 !== undefined ? (body.city || null) : undefined,
      region:               body.region               !== undefined ? (body.region || null) : undefined,
      phone:                body.phone                !== undefined ? (body.phone || null) : undefined,
      openHours:            body.openHours            !== undefined ? (body.openHours || null) : undefined,
      closedDays:           body.closedDays           !== undefined ? (body.closedDays || null) : undefined,
      storeManagerName:     body.storeManagerName     !== undefined ? (body.storeManagerName || null) : undefined,
      storeManagerPhone:    body.storeManagerPhone    !== undefined ? (body.storeManagerPhone || null) : undefined,
      storeManagerLine:     body.storeManagerLine     !== undefined ? (body.storeManagerLine || null) : undefined,
      salesRepId:           body.salesRepId           !== undefined ? (body.salesRepId || null) : undefined,
      salesRepName:         body.salesRepName         !== undefined ? (body.salesRepName || null) : undefined,
      backupContactName:    body.backupContactName    !== undefined ? (body.backupContactName || null) : undefined,
      backupContactPhone:   body.backupContactPhone   !== undefined ? (body.backupContactPhone || null) : undefined,
      displayShelfCount:    body.displayShelfCount    !== undefined ? (body.displayShelfCount ? Number(body.displayShelfCount) : null) : undefined,
      displayShelfSpec:     body.displayShelfSpec     !== undefined ? (body.displayShelfSpec || null) : undefined,
      displayRequirements:  body.displayRequirements  !== undefined ? (body.displayRequirements || null) : undefined,
      facingCount:          body.facingCount          !== undefined ? (body.facingCount ? Number(body.facingCount) : null) : undefined,
      shelfLocation:        body.shelfLocation        !== undefined ? (body.shelfLocation || null) : undefined,
      displayType:          body.displayType          !== undefined ? (body.displayType || null) : undefined,
      eventRequirements:    body.eventRequirements    !== undefined ? (body.eventRequirements || null) : undefined,
      promoCalendarNote:    body.promoCalendarNote    !== undefined ? (body.promoCalendarNote || null) : undefined,
      minOrderQtyPerEvent:  body.minOrderQtyPerEvent  !== undefined ? (body.minOrderQtyPerEvent ? Number(body.minOrderQtyPerEvent) : null) : undefined,
      placementZone:        body.placementZone        !== undefined ? (body.placementZone || null) : undefined,
      placementDetail:      body.placementDetail      !== undefined ? (body.placementDetail || null) : undefined,
      maxSkuCount:          body.maxSkuCount          !== undefined ? (body.maxSkuCount ? Number(body.maxSkuCount) : null) : undefined,
      maxUnitsPerSku:       body.maxUnitsPerSku       !== undefined ? (body.maxUnitsPerSku ? Number(body.maxUnitsPerSku) : null) : undefined,
      maxPacksTotal:        body.maxPacksTotal        !== undefined ? (body.maxPacksTotal ? Number(body.maxPacksTotal) : null) : undefined,
      currentSkuCount:      body.currentSkuCount      !== undefined ? (body.currentSkuCount ? Number(body.currentSkuCount) : null) : undefined,
      deliveryTimeWindow:   body.deliveryTimeWindow   !== undefined ? (body.deliveryTimeWindow || null) : undefined,
      deliveryDayOfWeek:    body.deliveryDayOfWeek    !== undefined ? (body.deliveryDayOfWeek || null) : undefined,
      logisticsNote:        body.logisticsNote        !== undefined ? (body.logisticsNote || null) : undefined,
      parkingInfo:          body.parkingInfo          !== undefined ? (body.parkingInfo || null) : undefined,
      loadingDockNote:      body.loadingDockNote      !== undefined ? (body.loadingDockNote || null) : undefined,
      commissionRate:       body.commissionRate       !== undefined ? (body.commissionRate ? Number(body.commissionRate) : null) : undefined,
      paymentTerms:         body.paymentTerms         !== undefined ? (body.paymentTerms || null) : undefined,
      settlementDay:        body.settlementDay        !== undefined ? (body.settlementDay ? Number(body.settlementDay) : null) : undefined,
      shelfRent:            body.shelfRent            !== undefined ? (body.shelfRent ? Number(body.shelfRent) : null) : undefined,
      displayFee:           body.displayFee           !== undefined ? (body.displayFee ? Number(body.displayFee) : null) : undefined,
      isActive:             body.isActive             !== undefined ? body.isActive : undefined,
      notes:                body.notes               !== undefined ? (body.notes || null) : undefined,
    },
    include: {
      brand: { select: { id: true, name: true, code: true, brandType: true } },
    },
  })

  return NextResponse.json(outlet)
  } catch (error) {
    return handleApiError(error, 'retailOutlets.put')
  }
}
