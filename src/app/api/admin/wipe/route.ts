import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/admin/wipe
 *
 * 清除「舊的測試/demo 資料」，以便重新用 Excel 匯入真實資料。
 *
 * Body:
 *   {
 *     targets: ('contact' | 'sample' | 'tour')[],   // 至少一項
 *     confirm: 'WIPE',                               // 必須字面等於 "WIPE"
 *     scope?: 'all' | 'mine'                         // 預設 'mine'
 *   }
 *
 * 權限：
 *   - scope='mine' → 任何業務角色，僅清自己建的資料
 *   - scope='all'  → SUPER_ADMIN / GM / SALES_MANAGER 才能清全站
 *
 * 僅清這三類（聯繫紀錄 / 樣品紀錄 / 拜訪排程），
 * 絕不碰 Customer / User / Product / 財務資料。
 */

const MANAGER_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER']
const ALLOWED_ROLES = [...MANAGER_ROLES, 'SALES', 'CS', 'CARE_SUPERVISOR']

type Target = 'contact' | 'sample' | 'tour'
type Scope = 'all' | 'mine'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: '無權限執行資料清除' }, { status: 403 })
    }

    const body = await req.json() as {
      targets?: Target[]
      confirm?: string
      scope?: Scope
    }

    // Safety: confirmation string must match exactly
    if (body.confirm !== 'WIPE') {
      return NextResponse.json({ error: '缺少確認字串 (confirm: "WIPE")' }, { status: 400 })
    }

    const targets = Array.isArray(body.targets) ? body.targets.filter(Boolean) : []
    if (targets.length === 0) {
      return NextResponse.json({ error: '請指定要清除的資料類型' }, { status: 400 })
    }

    // Default: managers get 'all' (clearing seed/demo data is their job),
    // regular reps get 'mine' (safe — only their own records).
    const isManager = MANAGER_ROLES.includes(role)
    const scope: Scope = body.scope === 'all'
      ? 'all'
      : body.scope === 'mine'
        ? 'mine'
        : (isManager ? 'all' : 'mine')

    if (scope === 'all' && !isManager) {
      return NextResponse.json({ error: '僅主管/管理員可執行全站清除' }, { status: 403 })
    }

    const userScope = scope === 'mine' ? { createdById: session.user.id } : undefined
    const tourUserScope = scope === 'mine' ? { createdById: session.user.id } : undefined

    const deleted: Record<string, number> = {}

    for (const t of targets) {
      if (t === 'contact') {
        // FollowUpLog + 其自動建立的 SalesTask（透過 taskId 欄位關聯）
        const logs = await prisma.followUpLog.findMany({
          where: userScope,
          select: { id: true, taskId: true },
        })
        const taskIds = logs.map(l => l.taskId).filter((x): x is string => !!x)
        if (taskIds.length > 0) {
          await prisma.salesTask.deleteMany({ where: { id: { in: taskIds } } })
        }
        const r = await prisma.followUpLog.deleteMany({ where: userScope })
        deleted.contact = r.count
      }
      if (t === 'sample') {
        const r = await prisma.sampleRecord.deleteMany({
          where: scope === 'mine' ? { sentById: session.user.id } : undefined,
        })
        deleted.sample = r.count
      }
      if (t === 'tour') {
        const r = await prisma.institutionTour.deleteMany({ where: tourUserScope })
        deleted.tour = r.count
      }
    }

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'admin',
      action: 'WIPE_DATA',
      entityType: 'BulkDelete',
      entityId: 'wipe',
      entityLabel: `${scope === 'all' ? '全站' : '個人'} — ${targets.join(',')} — ${Object.entries(deleted).map(([k, v]) => `${k}:${v}`).join(', ')}`,
    }).catch(() => {})

    return NextResponse.json({ ok: true, deleted, scope })
  } catch (error) {
    return handleApiError(error, 'admin.wipe')
  }
}
