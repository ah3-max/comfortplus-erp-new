import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const logs = await prisma.incidentVisitLog.findMany({
    where:   { incidentId: id },
    include: {
      visitedBy:   { select: { id: true, name: true } },
      attachments: { where: { isSensitive: false } },
    },
    orderBy: { visitDate: 'desc' },
  })
  return NextResponse.json(logs)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const log = await prisma.incidentVisitLog.create({
    data: {
      incidentId:           id,
      visitDate:            new Date(body.visitDate),
      visitType:            body.visitType,
      participants:         body.participants         || null,
      onSiteObservation:    body.onSiteObservation    || null,
      skinConditionNote:    body.skinConditionNote    || null,
      careProcessNote:      body.careProcessNote      || null,
      productUsageNote:     body.productUsageNote     || null,
      staffFeedback:        body.staffFeedback        || null,
      immediateSuggestion:  body.immediateSuggestion  || null,
      nextFollowupDate:     body.nextFollowupDate ? new Date(body.nextFollowupDate) : null,
      visitedById:          session.user.id,
    },
    include: { visitedBy: { select: { id: true, name: true } } },
  })

  // If there is a nextFollowupDate, update the incident status to IN_PROGRESS
  if (body.nextFollowupDate) {
    await prisma.careIncident.update({
      where: { id },
      data:  { status: 'IN_PROGRESS' as never, scheduledVisitDate: new Date(body.nextFollowupDate) },
    })
  }

  return NextResponse.json(log, { status: 201 })
}
