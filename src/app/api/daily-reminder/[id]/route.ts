import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'CS', 'FINANCE']

// ── PATCH /api/daily-reminder/[id] ──────────────────────────────────────────
// 確認已提醒（助理打勾）或取消確認
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; name?: string; role?: string }
  if (!ALLOWED_ROLES.includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const { isConfirmed, note } = body as { isConfirmed?: boolean; note?: string }

    const existing = await prisma.dailyReminderLog.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: '找不到此提醒記錄' }, { status: 404 })

    const updated = await prisma.dailyReminderLog.update({
      where: { id },
      data: {
        isConfirmed: isConfirmed ?? true,
        confirmedAt: isConfirmed === false ? null : new Date(),
        confirmedById: isConfirmed === false ? null : user.id,
        note: note !== undefined ? note : existing.note,
      },
      include: {
        targetUser: { select: { id: true, name: true, role: true } },
        confirmedBy: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: user.id,
      userName: user.name ?? '',
      userRole: user.role ?? '',
      module: 'daily-reminder',
      action: isConfirmed === false ? 'UPDATE' : 'APPROVE',
      entityType: 'DailyReminderLog',
      entityId: id,
      entityLabel: `${updated.targetUser.name} ${existing.date.toISOString().slice(0, 10)}`,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    return handleApiError(error, 'daily-reminder.patch')
  }
}
