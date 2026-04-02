import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { notify } from '@/lib/notify'

/**
 * POST /api/meeting-records/[id]/publish
 *
 * M-5: Publish workflow
 *   1. Mark meeting record status as COMPLETED
 *   2. Create MeetingActionItems from aiActionItems (if not already created)
 *   3. Notify action item owners and facilitator
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const record = await prisma.meetingRecord.findUnique({
      where: { id },
      include: {
        facilitator: { select: { id: true, name: true } },
        actionItems: { select: { id: true } },
      },
    })
    if (!record) return NextResponse.json({ error: '找不到會議記錄' }, { status: 404 })
    if (record.status === 'CANCELLED') {
      return NextResponse.json({ error: '已取消的會議記錄無法發佈' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))

    // Build action items to create from aiActionItems + manually added items from body
    const existingCount = record.actionItems.length
    const aiItems = (record.aiActionItems ?? []) as Array<{
      title: string; owner?: string; dueDate?: string | null; priority?: string
    }>
    const manualItems: Array<{ title: string; ownerUserId?: string; dueDate?: string; priority?: string }> =
      body.actionItems ?? []

    // Lookup user IDs for AI-extracted owner names
    const allUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })
    const nameToId = new Map(allUsers.map(u => [u.name, u.id]))

    const createdItems: string[] = []

    // Create from AI items only if no action items exist yet
    if (existingCount === 0 && aiItems.length > 0) {
      for (const item of aiItems) {
        const ownerId = item.owner ? nameToId.get(item.owner) : undefined
        await prisma.meetingActionItem.create({
          data: {
            meetingRecordId: id,
            actionTitle: item.title,
            ownerUserId: ownerId ?? null,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            priority: (item.priority as 'HIGH' | 'MEDIUM' | 'LOW') ?? 'MEDIUM',
            status: 'OPEN',
          },
        })
        createdItems.push(item.title)
      }
    }

    // Create manually specified items from body
    for (const item of manualItems) {
      await prisma.meetingActionItem.create({
        data: {
          meetingRecordId: id,
          actionTitle: item.title,
          ownerUserId: item.ownerUserId ?? null,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          priority: (item.priority as 'HIGH' | 'MEDIUM' | 'LOW') ?? 'MEDIUM',
          status: 'OPEN',
        },
      })
      createdItems.push(item.title)
    }

    // Mark as COMPLETED
    const updated = await prisma.meetingRecord.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: {
        actionItems: {
          include: { owner: { select: { id: true, name: true } } },
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        },
      },
    })

    // Notify owners of newly created action items
    const ownerIds = new Set<string>()
    for (const item of updated.actionItems) {
      if (item.ownerUserId && item.status === 'OPEN') ownerIds.add(item.ownerUserId)
    }
    if (ownerIds.size > 0) {
      await notify({
        userIds: Array.from(ownerIds),
        title: `📋 會議記錄已發佈：${record.title}`,
        message: `您有 ${updated.actionItems.filter(i => i.ownerUserId && ownerIds.has(i.ownerUserId)).length} 項待辦事項需要跟進。`,
        linkUrl: `/meeting-records`,
        category: 'MEETING_PUBLISHED',
        priority: 'NORMAL',
      })
    }

    return NextResponse.json({
      ...updated,
      createdActionItems: createdItems.length,
      notifiedUsers: ownerIds.size,
    })
  } catch (error) {
    return handleApiError(error, 'meetingRecords.publish')
  }
}
