import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { handleApiError } from '@/lib/api-error'

const REVIEWER_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER']

/**
 * PUT /api/sales-daily-report/review
 * Body: { reportId, action: 'approve' | 'return', comment?: string }
 *
 * Managers approve or return (NEEDS_REVISION) a submitted daily report.
 * Notifies the sales rep in both cases.
 */
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!REVIEWER_ROLES.includes(role)) {
    return NextResponse.json({ error: '只有主管可審核日報' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { reportId, action, comment } = body as {
      reportId?: string
      action?: 'approve' | 'return'
      comment?: string
    }

    if (!reportId) return NextResponse.json({ error: 'reportId 必填' }, { status: 400 })
    if (!['approve', 'return'].includes(action ?? '')) {
      return NextResponse.json({ error: 'action 必須為 approve 或 return' }, { status: 400 })
    }
    if (action === 'return' && !comment?.trim()) {
      return NextResponse.json({ error: '退回時必須填寫原因' }, { status: 400 })
    }

    const existing = await prisma.salesDailyReport.findUnique({
      where: { id: reportId },
      select: { id: true, status: true, salesRepId: true, reportDate: true },
    })
    if (!existing) return NextResponse.json({ error: '找不到日報' }, { status: 404 })
    if (existing.status === 'DRAFT') {
      return NextResponse.json({ error: '草稿尚未提交，無法審核' }, { status: 409 })
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'NEEDS_REVISION'
    const report = await prisma.salesDailyReport.update({
      where: { id: reportId },
      data: {
        status:         newStatus,
        managerComment: comment?.trim() ?? null,
        reviewedById:   session.user.id,
        reviewedAt:     new Date(),
      },
      include: {
        salesRep:   { select: { id: true, name: true } },
        reviewedBy: { select: { name: true } },
      },
    })

    // Notify the sales rep
    const dateStr = existing.reportDate.toISOString().slice(0, 10)
    const reviewerName = session.user.name ?? '主管'
    if (action === 'approve') {
      await notify({
        userIds: [existing.salesRepId],
        title: `✅ 日報已核准（${dateStr}）`,
        message: `${reviewerName} 已核准您 ${dateStr} 的業務日報。`,
        linkUrl: '/daily-report',
        category: 'REPORT_REVIEWED',
      })
    } else {
      await notify({
        userIds: [existing.salesRepId],
        title: `↩️ 日報需修正（${dateStr}）`,
        message: `${reviewerName} 退回您 ${dateStr} 的日報，請修正後重新提交。\n意見：${comment}`,
        linkUrl: '/daily-report',
        category: 'REPORT_REVIEWED',
        priority: 'HIGH',
      })
    }

    return NextResponse.json(report)
  } catch (e) {
    return handleApiError(e, 'salesDailyReport.review')
  }
}
