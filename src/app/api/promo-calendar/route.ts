import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

function computePhase(p: { eventStartDate: Date; eventEndDate: Date; prepStartDate: Date; negoStartDate: Date; execStartDate: Date }) {
  const now = new Date()
  if (now >= p.eventEndDate)    return 'REVIEW'
  if (now >= p.eventStartDate)  return 'LIVE'
  if (now >= p.execStartDate)   return 'EXECUTION'
  if (now >= p.negoStartDate)   return 'NEGOTIATION'
  return 'PREPARATION'
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const year      = searchParams.get('year')      ? parseInt(searchParams.get('year')!) : null
    const promoTier = searchParams.get('promoTier') ?? ''
    const isActive  = searchParams.get('isActive')

    const promos = await prisma.promoCalendar.findMany({
      where: {
        ...(year      && { year }),
        ...(promoTier && { promoTier: promoTier as never }),
        ...(isActive !== null && { isActive: isActive === 'true' }),
      },
      include: {
        responsibleUser: { select: { id: true, name: true } },
        _count: { select: { businessEvents: true, meetingRecords: true } },
      },
      orderBy: [{ year: 'desc' }, { eventStartDate: 'asc' }],
    })

    const now = new Date()
    const result = promos.map(p => ({
      ...p,
      daysUntilEvent: Math.ceil((p.eventStartDate.getTime() - now.getTime()) / 86400_000),
      currentPhase: computePhase(p),
    }))

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, 'promo-calendar.GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body.promoCode || !body.promoName || !body.eventStartDate || !body.eventEndDate) {
      return NextResponse.json({ error: '請填寫檔期代碼、名稱、活動日期' }, { status: 400 })
    }

    const eventStart = new Date(body.eventStartDate)
    const eventEnd   = new Date(body.eventEndDate)
    const prepStart  = body.prepStartDate  ? new Date(body.prepStartDate)  : new Date(eventStart.getTime() - 90 * 86400_000)
    const negoStart  = body.negoStartDate  ? new Date(body.negoStartDate)  : new Date(eventStart.getTime() - 60 * 86400_000)
    const execStart  = body.execStartDate  ? new Date(body.execStartDate)  : new Date(eventStart.getTime() - 30 * 86400_000)

    const promo = await prisma.promoCalendar.create({
      data: {
        promoCode:          body.promoCode.toUpperCase(),
        promoName:          body.promoName,
        promoTier:          body.promoTier        || 'NATIONAL_MAJOR',
        year:               body.year             ? Number(body.year) : eventStart.getFullYear(),
        eventStartDate:     eventStart,
        eventEndDate:       eventEnd,
        prepStartDate:      prepStart,
        negoStartDate:      negoStart,
        execStartDate:      execStart,
        currentPhase:       computePhase({ eventStartDate: eventStart, eventEndDate: eventEnd, prepStartDate: prepStart, negoStartDate: negoStart, execStartDate: execStart }) as never,
        reminderDays:       body.reminderDays     ?? [90, 60, 30, 14, 7],
        revenueTarget:      body.revenueTarget    ? Number(body.revenueTarget) : null,
        orderTarget:        body.orderTarget      ? Number(body.orderTarget)   : null,
        targetChannels:     body.targetChannels   ?? [],
        featuredSkus:       body.featuredSkus     ?? [],
        responsibleUserId:  body.responsibleUserId || null,
        notes:              body.notes            || null,
      },
    })

    // Auto-create reminder Notifications for each reminderDay
    const reminderDays: number[] = promo.reminderDays
    const admins = await prisma.user.findMany({
      where: { role: { in: ['GM', 'SALES_MANAGER', 'ECOMMERCE'] }, isActive: true },
      select: { id: true },
    })
    const notifData = reminderDays.flatMap(d => {
      const scheduledAt = new Date(eventStart.getTime() - d * 86400_000)
      if (scheduledAt <= new Date()) return []
      return admins.map(u => ({
        id:           `promo-${promo.id}-${d}-${u.id}`,
        userId:       u.id,
        category:     'PROMO_REMINDER',
        title:        `${promo.promoName} 距活動還有 ${d} 天`,
        message:      `請確認準備進度`,
        relatedType:  'PromoCalendar',
        relatedId:    promo.id,
        linkUrl:      '/business-calendar',
        scheduledAt,
        priority:     d <= 14 ? 'HIGH' : 'NORMAL',
      }))
    })
    if (notifData.length > 0) {
      await prisma.notification.createMany({ data: notifData, skipDuplicates: true })
    }

    return NextResponse.json(promo, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'promo-calendar.POST')
  }
}
