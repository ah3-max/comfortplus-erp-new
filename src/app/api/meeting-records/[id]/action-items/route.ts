import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const items = await prisma.meetingActionItem.findMany({
    where: { meetingRecordId: id },
    include: { owner: { select: { id: true, name: true } } },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  if (!body.actionTitle) return NextResponse.json({ error: '請填寫待辦標題' }, { status: 400 })

  const item = await prisma.meetingActionItem.create({
    data: {
      meetingRecordId:  id,
      actionTitle:      body.actionTitle,
      actionDescription: body.actionDescription || null,
      ownerUserId:      body.ownerUserId        || null,
      dueDate:          body.dueDate            ? new Date(body.dueDate) : null,
      status:           body.status             ?? 'OPEN',
      priority:         body.priority           ?? 'MEDIUM',
      followUpNote:     body.followUpNote       || null,
    },
    include: { owner: { select: { id: true, name: true } } },
  })

  return NextResponse.json(item, { status: 201 })
}
