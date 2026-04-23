import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'
import { PurchaseStatus } from '@prisma/client'

/**
 * POST /api/purchases/batch-status
 * Body: { ids: string[], status: PurchaseStatus }
 *
 * Bulk-transitions multiple POs to the same target status. Each PO is validated
 * against PO_TRANSITIONS — invalid ones are skipped (not hard-failed). Returns
 * per-PO result so the UI can show "3 succeeded, 2 skipped" without any silent drop.
 */
const PO_TRANSITIONS: Record<string, string[]> = {
  DRAFT:            ['PENDING_APPROVAL', 'SOURCING', 'CANCELLED'],
  SOURCING:         ['PENDING_APPROVAL', 'ORDERED', 'CANCELLED'],
  PENDING_APPROVAL: ['ORDERED', 'CANCELLED'],
  ORDERED:          ['FACTORY_CONFIRMED', 'IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION:    ['FACTORY_CONFIRMED'],
  FACTORY_CONFIRMED:['RECEIVED', 'PARTIAL'],
  PARTIAL:          ['RECEIVED'],
  RECEIVED:         ['INSPECTED', 'WAREHOUSED', 'CLOSED'],
  INSPECTED:        ['WAREHOUSED', 'CLOSED'],
  WAREHOUSED:       ['CLOSED'],
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'WAREHOUSE_MANAGER'].includes(role)) {
      return NextResponse.json({ error: '無權限批次修改採購單' }, { status: 403 })
    }

    const body = await req.json() as { ids?: string[]; status?: string }
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []
    const status = body.status as PurchaseStatus | undefined

    if (ids.length === 0) return NextResponse.json({ error: '請提供至少一張採購單' }, { status: 400 })
    if (!status) return NextResponse.json({ error: '請指定目標狀態' }, { status: 400 })

    const orders = await prisma.purchaseOrder.findMany({
      where: { id: { in: ids } },
      select: { id: true, poNo: true, status: true },
    })

    const results: { id: string; poNo: string; ok: boolean; reason?: string }[] = []
    for (const o of orders) {
      const allowed = PO_TRANSITIONS[o.status as string]
      if (allowed && !allowed.includes(status)) {
        results.push({ id: o.id, poNo: o.poNo, ok: false, reason: `${o.status} → ${status} 不合法` })
        continue
      }
      try {
        await prisma.purchaseOrder.update({
          where: { id: o.id },
          data: { status },
        })
        logAudit({
          userId: session.user.id, userName: session.user.name ?? '', userRole: role,
          module: 'purchases', action: 'BATCH_STATUS_CHANGE',
          entityType: 'PurchaseOrder', entityId: o.id, entityLabel: o.poNo,
          changes: { status: { before: o.status, after: status } },
        }).catch(() => {})
        results.push({ id: o.id, poNo: o.poNo, ok: true })
      } catch (e) {
        results.push({ id: o.id, poNo: o.poNo, ok: false, reason: (e as Error).message })
      }
    }

    const succeeded = results.filter(r => r.ok).length
    const skipped = results.length - succeeded
    return NextResponse.json({
      message: `批次完成：${succeeded} 張成功，${skipped} 張略過`,
      succeeded, skipped, results,
    })
  } catch (error) {
    return handleApiError(error, 'purchases.batchStatus')
  }
}
