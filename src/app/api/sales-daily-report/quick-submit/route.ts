import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/sales-daily-report/quick-submit
 *
 * 一鍵送出今日日報：
 *   - 自動從今日活動（拜訪/通話/訂單/報價）抓 stats
 *   - 若前端有傳 { highlights, obstacles, tomorrowPlan, needsHelp } 就覆寫，沒有就保留原值或空字串
 *   - 標記 status = SUBMITTED
 *   - 冪等：重複呼叫只是 update，不會建新筆
 *
 * 使用情境：業務下班前在 dashboard 點一下「一鍵送出今日報表」。
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const body = await req.json().catch(() => ({})) as {
      highlights?: string
      obstacles?: string
      tomorrowPlan?: string
      needsHelp?: string
      attachments?: Array<{ url: string; fileName: string; mimeType?: string; size?: number; uploadedAt?: string }>
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [visits, calls, orders, quotes, existing] = await Promise.all([
      prisma.visitRecord.count({ where: { visitedById: userId, visitDate: { gte: today, lt: tomorrow } } }),
      prisma.callRecord.count({ where: { calledById: userId, callDate: { gte: today, lt: tomorrow } } }),
      prisma.salesOrder.findMany({
        where: { createdById: userId, createdAt: { gte: today, lt: tomorrow } },
        select: { totalAmount: true },
      }),
      prisma.quotation.count({ where: { createdById: userId, createdAt: { gte: today, lt: tomorrow } } }),
      prisma.salesDailyReport.findFirst({
        where: { salesRepId: userId, reportDate: today },
        select: { highlights: true, obstacles: true, tomorrowPlan: true, needsHelp: true, attachments: true },
      }),
    ])

    const orderAmount = orders.reduce((s, o) => s + Number(o.totalAmount), 0)

    const data = {
      visitCount:       visits,
      callCount:        calls,
      orderCount:       orders.length,
      orderAmount,
      newCustomerCount: 0,
      quoteCount:       quotes,
      highlights:       body.highlights ?? existing?.highlights ?? '',
      obstacles:        body.obstacles ?? existing?.obstacles ?? '',
      tomorrowPlan:     body.tomorrowPlan ?? existing?.tomorrowPlan ?? '',
      needsHelp:        body.needsHelp ?? existing?.needsHelp ?? '',
      attachments:      body.attachments ?? (existing?.attachments as unknown) ?? undefined,
      status:           'SUBMITTED',
      submittedAt:      new Date(),
    }

    const report = await prisma.salesDailyReport.upsert({
      where: { salesRepId_reportDate: { salesRepId: userId, reportDate: today } },
      create: { salesRepId: userId, reportDate: today, ...data },
      update: data,
    })

    return NextResponse.json({
      ok: true,
      report,
      summary: {
        visits, calls,
        orders: orders.length,
        orderAmount,
        quotes,
      },
    })
  } catch (e) {
    return handleApiError(e, 'salesDailyReport.quickSubmit')
  }
}
