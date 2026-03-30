import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const showAll = searchParams.get('showAll') === 'true'

  const providers = await prisma.logisticsProvider.findMany({
    where: showAll ? undefined : { isActive: true },
    include: { _count: { select: { shipments: true } } },
    orderBy: { code: 'asc' },
  })

  return NextResponse.json(providers)
  } catch (error) { return handleApiError(error, 'logistics.list') }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.code || !body.name) {
    return NextResponse.json({ error: '物流商代碼和名稱為必填' }, { status: 400 })
  }

  const existing = await prisma.logisticsProvider.findUnique({ where: { code: body.code } })
  if (existing) return NextResponse.json({ error: '物流商代碼已存在' }, { status: 400 })

  const provider = await prisma.logisticsProvider.create({
    data: {
      code:          body.code.toUpperCase(),
      name:          body.name,
      regions:       body.regions        || null,
      deliveryDays:  body.deliveryDays   ? Number(body.deliveryDays) : null,
      paymentTerms:  body.paymentTerms   || null,
      rateCard:      body.rateCard       || null,
      contactPerson: body.contactPerson  || null,
      contactPhone:  body.contactPhone   || null,
      contactEmail:  body.contactEmail   || null,
      claimRules:    body.claimRules     || null,
      notes:         body.notes          || null,
    },
  })

  return NextResponse.json(provider, { status: 201 })
  } catch (error) { return handleApiError(error, 'logistics.create') }
}
