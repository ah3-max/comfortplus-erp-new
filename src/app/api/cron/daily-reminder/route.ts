import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notify, notifyByRole } from '@/lib/notify'

const REMINDER_ROLES = ['SALES', 'CARE_SUPERVISOR']

/**
 * GET /api/cron/daily-reminder
 *
 * 每日下班前（建議設在 17:00）自動執行：
 *  1. 為今天所有 SALES + CARE_SUPERVISOR 建立 DailyReminderLog
 *  2. 發送系統通知給每位成員（提醒今日工作確認）
 *  3. 發送彙整通知給 SALES_MANAGER/GM/CS（今日需確認人數）
 *
 * Authentication: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET must be ≥32 chars' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  try {
    const activeUsers = await prisma.user.findMany({
      where: { role: { in: REMINDER_ROLES as never[] }, isActive: true },
      select: { id: true, name: true, role: true },
    })

    let created = 0
    let skipped = 0
    const newlyCreated: string[] = []

    for (const user of activeUsers) {
      const existing = await prisma.dailyReminderLog.findUnique({
        where: {
          date_targetUserId_reminderType: {
            date: dateOnly,
            targetUserId: user.id,
            reminderType: 'DAILY_TASKS',
          },
        },
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

      // 通知個人
      await notify({
        userIds: [user.id],
        title: '📋 每日工作確認',
        message: `今日（${dateOnly.toLocaleDateString('zh-TW')}）工作事項請確認，如有未完成請回報主管。`,
        linkUrl: '/daily-report',
        category: 'DAILY_REMINDER',
        priority: 'NORMAL',
      }).catch(() => {})

      created++
      newlyCreated.push(user.name)
    }

    // 通知管理者（彙整）
    if (created > 0) {
      await notifyByRole(
        ['SALES_MANAGER', 'GM', 'CS'],
        {
          title: `📋 今日工作提醒已發送（${created} 人）`,
          message: `已發送每日工作提醒給：${newlyCreated.join('、')}\n請前往「每日提醒確認」頁面打勾確認。`,
          linkUrl: '/daily-reminder',
          category: 'DAILY_REMINDER_SUMMARY',
          priority: 'NORMAL',
        }
      ).catch(() => {})
    }

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      results: { created, skipped, total: activeUsers.length },
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
