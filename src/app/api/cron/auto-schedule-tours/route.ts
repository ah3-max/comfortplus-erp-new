import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { notify } from '@/lib/notify'

/**
 * GET /api/cron/auto-schedule-tours
 *
 * 建議每天早上 07:00 執行（`0 7 * * *`）
 *
 * 邏輯：
 *  1. 讀取 SystemConfig 的等級預設頻率
 *     - TOUR_FREQ_A（預設 7 天）
 *     - TOUR_FREQ_B（預設 14 天）
 *     - TOUR_FREQ_C（預設 30 天）
 *  2. 掃描所有 tourAutoSchedule=true 且 grade IN (A,B,C) 的客戶
 *  3. 對每個客戶：
 *     a. 取頻率：visitFrequencyDays（個人設定）> 等級預設
 *     b. 找最後一筆未來 SCHEDULED/DEPARTED/IN_PROGRESS 的巡迴
 *     c. 若無（或最後一筆距今超過頻率），往前建立 1 筆排程
 *        - 指派給 tourAutoAssigneeId（優先）或 salesRepId
 *        - 若無可指派人員則跳過
 *  4. 回傳 created / skipped / errors
 *
 * Authentication: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // ── 讀取等級頻率設定 ─────────────────────────────────────────────────────
  const configs = await prisma.systemConfig.findMany({
    where: { key: { in: ['TOUR_FREQ_A', 'TOUR_FREQ_B', 'TOUR_FREQ_C'] } },
  })
  const cfgMap: Record<string, number> = {
    A: 7,
    B: 14,
    C: 30,
  }
  for (const c of configs) {
    const grade = c.key.replace('TOUR_FREQ_', '')
    const val = parseInt(c.value, 10)
    if (!isNaN(val) && val > 0) cfgMap[grade] = val
  }

  // ── 掃描需要自動排程的客戶 ──────────────────────────────────────────────
  const customers = await prisma.customer.findMany({
    where: {
      tourAutoSchedule: true,
      isActive: true,
      grade: { in: ['A', 'B', 'C'] },
    },
    select: {
      id: true,
      name: true,
      grade: true,
      visitFrequencyDays: true,
      salesRepId: true,
      tourAutoAssigneeId: true,
    },
  })

  const results = { created: 0, skipped: 0, errors: 0, details: [] as string[] }

  for (const customer of customers) {
    try {
      const grade = customer.grade as 'A' | 'B' | 'C'
      const freqDays = customer.visitFrequencyDays ?? cfgMap[grade]
      const assigneeId = customer.tourAutoAssigneeId ?? customer.salesRepId

      if (!assigneeId) {
        results.skipped++
        results.details.push(`${customer.name}: 無指派人員，跳過`)
        continue
      }

      // 找最後一筆未來的排程
      const latestFutureTour = await prisma.institutionTour.findFirst({
        where: {
          customerId: customer.id,
          status: { in: ['SCHEDULED', 'DEPARTED', 'IN_PROGRESS'] },
          tourDate: { gte: today },
        },
        orderBy: { tourDate: 'desc' },
        select: { tourDate: true },
      })

      if (latestFutureTour) {
        // 已有未來排程，距今小於頻率→不需新建
        const daysAhead = Math.floor(
          (latestFutureTour.tourDate.getTime() - today.getTime()) / 86400000
        )
        if (daysAhead < freqDays) {
          results.skipped++
          continue
        }
      }

      // 建立下次排程日期：今天 + freqDays
      const nextDate = new Date(today)
      nextDate.setDate(today.getDate() + freqDays)

      // 避免重複：同客戶同日期已有排程
      const exists = await prisma.institutionTour.findFirst({
        where: {
          customerId: customer.id,
          tourDate: nextDate,
          status: { not: 'CANCELLED' },
        },
      })
      if (exists) {
        results.skipped++
        continue
      }

      const tourNo = await generateSequenceNo('TOUR')

      const tour = await prisma.institutionTour.create({
        data: {
          tourNo,
          customerId: customer.id,
          assignedUserId: assigneeId,
          tourDate: nextDate,
          tourType: 'ROUTINE_VISIT',
          purpose: `${grade}級客戶例行關懷（自動排程，每 ${freqDays} 天）`,
          status: 'SCHEDULED',
          reminderMinutes: 30,
        },
      })

      // 通知被指派人員
      await notify({
        userIds: [assigneeId],
        title: '📅 新增例行巡迴排程',
        message: `${customer.name}（${grade}級）— ${nextDate.toLocaleDateString('zh-TW')}\n例行關懷，每 ${freqDays} 天一次`,
        linkUrl: '/institution-tours',
        category: 'TOUR_AUTO_SCHEDULED',
        priority: 'NORMAL',
      }).catch(() => {})

      results.created++
      results.details.push(`${customer.name}（${grade}）→ ${nextDate.toISOString().slice(0, 10)} 建立 ${tour.tourNo}`)
    } catch (e) {
      results.errors++
      results.details.push(`${customer.name}: 錯誤 ${String(e)}`)
    }
  }

  return NextResponse.json({
    ok: results.errors === 0,
    timestamp: now.toISOString(),
    gradeFrequency: cfgMap,
    customersScanned: customers.length,
    results,
  })
}
