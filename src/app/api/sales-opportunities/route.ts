import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')
  const stage = searchParams.get('stage')
  const ownerId = searchParams.get('ownerId')
  const isActive = searchParams.get('isActive')

  const where: Record<string, unknown> = {}
  if (customerId) where.customerId = customerId
  if (stage) where.stage = stage
  if (ownerId) where.ownerId = ownerId
  if (isActive !== null) where.isActive = isActive !== 'false'

  const opps = await prisma.salesOpportunity.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, code: true, type: true } },
      owner: { select: { id: true, name: true } },
      _count: { select: { followUpLogs: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(opps)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { customerId, title, stage, probability, expectedAmount,
          expectedCloseDate, productInterest, competitorInfo, notes, ownerId } = body

  if (!customerId || !title) {
    return NextResponse.json({ error: 'customerId and title required' }, { status: 400 })
  }

  const opp = await prisma.salesOpportunity.create({
    data: {
      customerId,
      ownerId: ownerId ?? session.user.id,
      title,
      stage: stage ?? 'PROSPECTING',
      probability: probability ?? 10,
      expectedAmount: expectedAmount ? Number(expectedAmount) : null,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      productInterest: productInterest ?? null,
      competitorInfo: competitorInfo ?? null,
      notes: notes ?? null,
    },
    include: {
      customer: { select: { id: true, name: true, code: true } },
      owner: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(opp, { status: 201 })
}
