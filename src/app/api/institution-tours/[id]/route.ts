import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

const MANAGER_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'CS']
const FIELD_ROLES   = ['SALES', 'CARE_SUPERVISOR']
const ALL_ROLES     = [...MANAGER_ROLES, ...FIELD_ROLES]

const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED:   ['DEPARTED', 'CANCELLED', 'MISSED'],
  DEPARTED:    ['IN_PROGRESS', 'COMPLETED', 'MISSED'],
  IN_PROGRESS: ['COMPLETED', 'MISSED'],
  COMPLETED:   [],
  MISSED:      ['SCHEDULED'],
  CANCELLED:   ['SCHEDULED'],
}

// ── PATCH /api/institution-tours/[id] ───────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; name?: string; role?: string }
  if (!ALL_ROLES.includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await req.json() as {
      status?: string
      reportResult?: string
      plannedStartTime?: string
      reminderMinutes?: number
      tourType?: string
      purpose?: string
    }

    const existing = await prisma.institutionTour.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: '找不到此巡迴記錄' }, { status: 404 })

    // 外勤人員只能更新自己的
    const isManager = MANAGER_ROLES.includes(user.role ?? '')
    if (!isManager && existing.assignedUserId !== user.id) {
      return NextResponse.json({ error: '只能更新自己的巡迴排程' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}

    // 狀態變更
    if (body.status && body.status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status] ?? []
      if (!allowed.includes(body.status)) {
        return NextResponse.json({
          error: `無法從 ${existing.status} 切換到 ${body.status}`,
        }, { status: 400 })
      }
      updateData.status = body.status
      const now = new Date()
      if (body.status === 'DEPARTED')     updateData.departedAt   = now
      if (body.status === 'IN_PROGRESS')  updateData.arrivedAt    = now
      if (body.status === 'COMPLETED')    updateData.completedAt  = now
    }

    // 回報內容
    if (body.reportResult !== undefined) {
      updateData.reportResult = body.reportResult
      updateData.reportedAt   = new Date()
    }

    // 其他欄位（管理者才能修改）
    if (isManager) {
      if (body.plannedStartTime !== undefined) updateData.plannedStartTime = body.plannedStartTime
      if (body.reminderMinutes  !== undefined) updateData.reminderMinutes  = body.reminderMinutes
      if (body.tourType         !== undefined) updateData.tourType         = body.tourType
      if (body.purpose          !== undefined) updateData.purpose          = body.purpose
    }

    const updated = await prisma.institutionTour.update({
      where: { id },
      data:  updateData,
      include: {
        assignedUser: { select: { id: true, name: true, role: true } },
        customer:     { select: { id: true, name: true } },
      },
    })

    // F-2: Auto-create FollowUpLog when tour is COMPLETED
    if (body.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      prisma.followUpLog.create({
        data: {
          customerId:  existing.customerId,
          createdById: user.id,
          logDate:     new Date(),
          logType:     'MEETING',
          method:      'ONSITE',
          content:     body.reportResult ?? `機構巡迴完成（${existing.tourNo}）`,
          result:      body.reportResult ?? null,
          isFollowUp:  false,
        },
      }).catch(() => {}) // non-blocking, best-effort
    }

    logAudit({
      userId:      user.id,
      userName:    user.name ?? '',
      userRole:    user.role ?? '',
      module:      'institution-tours',
      action:      'UPDATE',
      entityType:  'InstitutionTour',
      entityId:    id,
      entityLabel: `${existing.tourNo}`,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    return handleApiError(error, 'institution-tours.patch')
  }
}

// ── DELETE /api/institution-tours/[id] ──────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; name?: string; role?: string }
  if (!MANAGER_ROLES.includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const existing = await prisma.institutionTour.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: '找不到此記錄' }, { status: 404 })
    if (existing.status === 'COMPLETED') {
      return NextResponse.json({ error: '已完成的巡迴不可刪除' }, { status: 400 })
    }

    await prisma.institutionTour.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'institution-tours.delete')
  }
}
