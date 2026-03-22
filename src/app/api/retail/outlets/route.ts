import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  const search  = searchParams.get('search') ?? ''

  const outlets = await prisma.retailOutlet.findMany({
    where: {
      ...(brandId && { brandId }),
      ...(search && {
        OR: [
          { outletName: { contains: search, mode: 'insensitive' } },
          { address:    { contains: search, mode: 'insensitive' } },
          { outletCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      brand: { select: { id: true, name: true, code: true, brandType: true } },
      _count: { select: { events: true, groupBuys: true } },
      events: {
        where: { eventStatus: { in: ['ACTIVE', 'PLANNING'] } },
        select: {
          id: true, eventName: true, eventStatus: true, eventDate: true, endDate: true, eventType: true,
        },
        orderBy: { eventDate: 'asc' },
        take: 3,
      },
    },
    orderBy: [{ brand: { name: 'asc' } }, { outletName: 'asc' }],
  })

  return NextResponse.json(outlets)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.outletName || !body.brandId) {
    return NextResponse.json({ error: '請填寫門市名稱與通路品牌' }, { status: 400 })
  }

  const outlet = await prisma.retailOutlet.create({
    data: {
      brandId:              body.brandId,
      channelId:            body.channelId            || null,
      outletCode:           body.outletCode            || null,
      outletName:           body.outletName,
      address:              body.address               || null,
      city:                 body.city                  || null,
      region:               body.region                || null,
      phone:                body.phone                 || null,
      openHours:            body.openHours             || null,
      closedDays:           body.closedDays            || null,
      storeManagerName:     body.storeManagerName      || null,
      storeManagerPhone:    body.storeManagerPhone     || null,
      storeManagerLine:     body.storeManagerLine      || null,
      salesRepId:           body.salesRepId            || null,
      salesRepName:         body.salesRepName          || null,
      backupContactName:    body.backupContactName     || null,
      backupContactPhone:   body.backupContactPhone    || null,
      displayShelfCount:    body.displayShelfCount     ? Number(body.displayShelfCount)   : null,
      displayShelfSpec:     body.displayShelfSpec      || null,
      displayRequirements:  body.displayRequirements   || null,
      facingCount:          body.facingCount           ? Number(body.facingCount)         : null,
      shelfLocation:        body.shelfLocation         || null,
      displayType:          body.displayType           || null,
      eventRequirements:    body.eventRequirements     || null,
      promoCalendarNote:    body.promoCalendarNote     || null,
      minOrderQtyPerEvent:  body.minOrderQtyPerEvent   ? Number(body.minOrderQtyPerEvent) : null,
      placementZone:        body.placementZone         || null,
      placementDetail:      body.placementDetail       || null,
      maxSkuCount:          body.maxSkuCount           ? Number(body.maxSkuCount)         : null,
      maxUnitsPerSku:       body.maxUnitsPerSku        ? Number(body.maxUnitsPerSku)      : null,
      maxPacksTotal:        body.maxPacksTotal         ? Number(body.maxPacksTotal)       : null,
      currentSkuCount:      body.currentSkuCount       ? Number(body.currentSkuCount)     : null,
      deliveryTimeWindow:   body.deliveryTimeWindow    || null,
      deliveryDayOfWeek:    body.deliveryDayOfWeek     || null,
      logisticsNote:        body.logisticsNote         || null,
      parkingInfo:          body.parkingInfo           || null,
      loadingDockNote:      body.loadingDockNote       || null,
      commissionRate:       body.commissionRate        ? Number(body.commissionRate)      : null,
      paymentTerms:         body.paymentTerms          || null,
      settlementDay:        body.settlementDay         ? Number(body.settlementDay)       : null,
      shelfRent:            body.shelfRent             ? Number(body.shelfRent)           : null,
      displayFee:           body.displayFee            ? Number(body.displayFee)          : null,
      notes:                body.notes                 || null,
    },
    include: {
      brand: { select: { id: true, name: true, code: true, brandType: true } },
    },
  })

  return NextResponse.json(outlet, { status: 201 })
}
