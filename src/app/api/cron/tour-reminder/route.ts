import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notify, notifyByRole } from '@/lib/notify'

/**
 * GET /api/cron/tour-reminder
 *
 * 每 15 分鐘執行一次（建議：`*\/15 * * * *`）：
 *  1. 找出今天 status=SCHEDULED、尚未發過提醒 (reminderSentAt IS NULL)
 *     且 plannedStartTime - now <= reminderMinutes 的巡迴
 *  2. 對當事人發出「即將出發」推播
 *  3. 同時通知 SALES_MANAGER/GM/CS
 *  4. 設 reminderSentAt = now 防止重複推播
 *
 * 同時處理「未完成」檢查：
 *  - 今天已過 22:00 且 status=SCHEDULED/DEPARTED/IN_PROGRESS → 標記 MISSED
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
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd   = new Date(todayStart.getTime() + 86400000)

  const results = { reminded: 0, missed: 0, errors: 0 }

  // ── Task 1: 出發前推播 ───────────────────────────────────────────────────
  try {
    const pendingTours = await prisma.institutionTour.findMany({
      where: {
        tourDate:       { gte: todayStart, lt: todayEnd },
        status:         'SCHEDULED',
        reminderSentAt: null,
        plannedStartTime: { not: null },
      },
      include: {
        assignedUser: { select: { id: true, name: true, role: true } },
        customer:     { select: { id: true, name: true, address: true } },
      },
    })

    for (const tour of pendingTours) {
      if (!tour.plannedStartTime) continue

      // 解析 plannedStartTime（HH:MM）
      const [hh, mm] = tour.plannedStartTime.split(':').map(Number)
      const planned = new Date(todayStart.getTime() + hh * 3600000 + mm * 60000)
      const diffMin = (planned.getTime() - now.getTime()) / 60000

      // 在提醒時間窗口內：0 ≤ diff ≤ reminderMinutes
      if (diffMin < 0 || diffMin > tour.reminderMinutes) continue

      const TOUR_TYPE_LABEL: Record<string, string> = {
        ROUTINE_VISIT:    '例行巡迴',
        DIAPER_CHECK:     '尿布問題檢查',
        COMPLAINT_FOLLOW: '客訴追蹤',
        TRAINING:         '教育訓練',
        ONBOARDING:       '新客開通',
        PAYMENT:          '收款',
        OTHER:            '其他',
      }
      const typeLabel = TOUR_TYPE_LABEL[tour.tourType] ?? tour.tourType

      await notify({
        userIds: [tour.assignedUserId],
        title:   `🚗 ${tour.plannedStartTime} 出發提醒`,
        message: `${tour.customer.name} — ${typeLabel}\n${tour.customer.address ?? ''}\n${tour.purpose ? `目的：${tour.purpose}` : ''}`.trim(),
        linkUrl: '/institution-tours',
        category: 'TOUR_REMINDER',
        priority: 'HIGH',
        line:    true,
      }).catch(() => {})

      await prisma.institutionTour.update({
        where: { id: tour.id },
        data:  { reminderSentAt: now },
      })

      results.reminded++
    }
  } catch (e) {
    results.errors++
    console.error('[tour-reminder] remind error', e)
  }

  // ── Task 2: 標記今日未完成（22:00 後檢查）──────────────────────────────────
  try {
    const hour = now.getHours()
    if (hour >= 22) {
      const unfinished = await prisma.institutionTour.findMany({
        where: {
          tourDate: { gte: todayStart, lt: todayEnd },
          status:   { in: ['SCHEDULED', 'DEPARTED', 'IN_PROGRESS'] },
        },
        include: {
          assignedUser: { select: { id: true, name: true } },
          customer:     { select: { name: true } },
        },
      })

      for (const tour of unfinished) {
        await prisma.institutionTour.update({
          where: { id: tour.id },
          data:  { status: 'MISSED' },
        })
        results.missed++
      }

      if (unfinished.length > 0) {
        const summary = unfinished.map(t => `${t.assignedUser.name} → ${t.customer.name}`).join('\n')
        await notifyByRole(['SALES_MANAGER', 'GM'], {
          title:   `⚠️ 今日 ${unfinished.length} 筆巡迴未完成`,
          message: summary,
          linkUrl: '/institution-tours',
          category: 'TOUR_MISSED',
          priority: 'HIGH',
        }).catch(() => {})
      }
    }
  } catch (e) {
    results.errors++
    console.error('[tour-reminder] missed check error', e)
  }

  return NextResponse.json({
    ok:        results.errors === 0,
    timestamp: now.toISOString(),
    results,
  })
}
