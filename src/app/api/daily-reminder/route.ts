import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { notify } from '@/lib/notify'

const REMINDER_ROLES = ['SALES', 'CARE_SUPERVISOR']
const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'CS', 'FINANCE']

// ── GET /api/daily-reminder?date=YYYY-MM-DD ──────────────────────────────────
// 取得指定日期的提醒清單（不傳 date 則為今天）
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dateEnd = new Date(dateStart.getTime() + 86400000)

    const logs = await prisma.dailyReminderLog.findMany({
      where: { date: { gte: dateStart, lt: dateEnd } },
      include: {
        targetUser: { select: { id: true, name: true, role: true, avatar: true } },
        confirmedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ isConfirmed: 'asc' }, { targetUser: { name: 'asc' } }],
    })

    // 取當日有效的 SALES + CARE_SUPERVISOR 使用者清單（補上尚未建立 log 的人）
    const activeUsers = await prisma.user.findMany({
      where: { role: { in: REMINDER_ROLES as never[] }, isActive: true },
      select: { id: true, name: true, role: true, avatar: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ data: logs, users: activeUsers, date: dateStart.toISOString() })
  } catch (error) {
    return handleApiError(error, 'daily-reminder.get')
  }
}

// ── POST /api/daily-reminder ─────────────────────────────────────────────────
// 手動為今天產生提醒（若已存在則跳過），並發送系統通知
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const dateParam = (body as { date?: string }).date
    const date = dateParam ? new Date(dateParam) : new Date()
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    const activeUsers = await prisma.user.findMany({
      where: { role: { in: REMINDER_ROLES as never[] }, isActive: true },
      select: { id: true, name: true, role: true },
    })

    let created = 0
    let skipped = 0

    for (const user of activeUsers) {
      const existing = await prisma.dailyReminderLog.findUnique({
        where: { date_targetUserId_reminderType: { date: dateOnly, targetUserId: user.id, reminderType: 'DAILY_TASKS' } },
      })
      if (existing) { skipped++; continue }

      await prisma.dailyReminderLog.create({
        data: {
          date: dateOnly,
          targetUserId: user.id,
          reminderType: 'DAILY_TASKS',
          isSent: true,
          sentAt: new Date(),
          sentChannel: 'WEB',
        },
      })

      // 發送系統通知給被提醒者
      await notify({
        userIds: [user.id],
        title: '📋 每日工作確認',
        message: `${dateOnly.toLocaleDateString('zh-TW')} 今日工作事項請確認完成，如有未完成事項請回報主管。`,
        linkUrl: '/daily-report',
        category: 'DAILY_REMINDER',
        priority: 'NORMAL',
      }).catch(() => {})

      created++
    }

    return NextResponse.json({ created, skipped, total: activeUsers.length })
  } catch (error) {
    return handleApiError(error, 'daily-reminder.post')
  }
}
