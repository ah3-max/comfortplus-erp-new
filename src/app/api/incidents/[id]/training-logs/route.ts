import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const logs = await prisma.incidentTrainingLog.findMany({
    where:   { incidentId: id },
    include: { trainer: { select: { id: true, name: true } } },
    orderBy: { trainingDate: 'desc' },
  })
  return NextResponse.json(logs)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const log = await prisma.incidentTrainingLog.create({
    data: {
      incidentId:        id,
      trainingDate:      new Date(body.trainingDate),
      trainingTopic:     body.trainingTopic,
      trainerUserId:     body.trainerUserId || session.user.id,
      attendees:         Array.isArray(body.attendees) ? body.attendees : null,
      trainingContent:   body.trainingContent   || null,
      trainingResult:    body.trainingResult    || null,
      trainingPhotoUrls: Array.isArray(body.trainingPhotoUrls) ? body.trainingPhotoUrls : null,
      followupRequired:  body.followupRequired  ?? false,
      nextFollowupDate:  body.nextFollowupDate ? new Date(body.nextFollowupDate) : null,
    },
    include: { trainer: { select: { id: true, name: true } } },
  })

  return NextResponse.json(log, { status: 201 })
}
