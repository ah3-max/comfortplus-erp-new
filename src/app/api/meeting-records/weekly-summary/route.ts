import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/meeting-records/weekly-summary?weekStart=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const weekStartStr = searchParams.get('weekStart')
  const weekStart = weekStartStr ? new Date(weekStartStr) : (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - d.getDay() + 1) // Monday
    return d
  })()
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400_000)

  // All open/in-progress action items (overdue or due this week)
  const [openItems, weekMeetings, completedThisWeek] = await Promise.all([
    prisma.meetingActionItem.findMany({
      where: {
        status:  { in: ['OPEN', 'IN_PROGRESS'] },
        dueDate: { lte: weekEnd },
      },
      include: {
        owner:        { select: { id: true, name: true } },
        meetingRecord: { select: { id: true, meetingNo: true, title: true, meetingDate: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
    }),
    prisma.meetingRecord.findMany({
      where: {
        meetingType: 'WEEKLY_ADMIN',
        meetingDate: { gte: weekStart, lt: weekEnd },
      },
      include: {
        facilitator: { select: { id: true, name: true } },
        _count: { select: { actionItems: true } },
      },
    }),
    prisma.meetingActionItem.findMany({
      where: {
        status:      'DONE',
        completedAt: { gte: weekStart, lt: weekEnd },
      },
      include: {
        owner:        { select: { id: true, name: true } },
        meetingRecord: { select: { id: true, meetingNo: true, title: true } },
      },
      orderBy: { completedAt: 'desc' },
    }),
  ])

  const now = new Date()

  // Group open items by owner
  const byOwner = new Map<string, { owner: { id: string; name: string } | null; items: typeof openItems }>()
  for (const item of openItems) {
    const key = item.ownerUserId ?? '__unassigned__'
    if (!byOwner.has(key)) byOwner.set(key, { owner: item.owner, items: [] })
    byOwner.get(key)!.items.push(item)
  }

  const ownerGroups = Array.from(byOwner.values()).map(group => ({
    owner: group.owner,
    items: group.items.map(i => ({
      ...i,
      isOverdue: i.dueDate ? i.dueDate < now : false,
      isDueThisWeek: i.dueDate ? i.dueDate >= weekStart && i.dueDate < weekEnd : false,
    })),
  }))

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    weekEnd:   weekEnd.toISOString(),
    ownerGroups,
    weekMeetings,
    completedThisWeek,
    totalOpen:      openItems.length,
    totalOverdue:   openItems.filter(i => i.dueDate && i.dueDate < now).length,
    totalCompleted: completedThisWeek.length,
  })
}
