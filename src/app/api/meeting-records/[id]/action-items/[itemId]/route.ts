import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { itemId } = await params
    const body = await req.json()

    const item = await prisma.meetingActionItem.update({
      where: { id: itemId },
      data: {
        actionTitle:       body.actionTitle       ?? undefined,
        actionDescription: body.actionDescription !== undefined ? (body.actionDescription || null) : undefined,
        ownerUserId:       body.ownerUserId       !== undefined ? (body.ownerUserId || null)        : undefined,
        dueDate:           body.dueDate           !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
        status:            body.status            ?? undefined,
        priority:          body.priority          ?? undefined,
        completionNote:    body.completionNote    !== undefined ? (body.completionNote || null)  : undefined,
        completedAt:       body.status === 'DONE' && !body.completedAt ? new Date() : (body.completedAt !== undefined ? (body.completedAt ? new Date(body.completedAt) : null) : undefined),
        followUpNote:      body.followUpNote      !== undefined ? (body.followUpNote || null)    : undefined,
        lastFollowUpAt:    body.followUpNote      ? new Date() : undefined,
        reportedInMeetingId: body.reportedInMeetingId !== undefined ? (body.reportedInMeetingId || null) : undefined,
      },
      include: { owner: { select: { id: true, name: true } } },
    })

    return NextResponse.json(item)
  } catch (error) {
    return handleApiError(error, 'meetingRecords.actionItems.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { itemId } = await params
    await prisma.meetingActionItem.delete({ where: { id: itemId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, 'meetingRecords.actionItems.delete')
  }
}
