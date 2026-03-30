import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { persistOrderMargin, calculateOrderMargin } from '@/lib/gross-margin'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

const CAN_RECALC = ['SUPER_ADMIN', 'GM', 'FINANCE', 'PROCUREMENT']

function getIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? '127.0.0.1'
}

// GET /api/orders/recalc-margin?orderId=xxx  — 預覽（不寫入）
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!CAN_RECALC.includes(session.user.role as string)) {
    return NextResponse.json({ error: '無權限查看毛利資料' }, { status: 403 })
  }

  const orderId = new URL(req.url).searchParams.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  try {
    const result = await calculateOrderMargin(orderId)
    return NextResponse.json({
      costOfGoods:          result.costOfGoods,
      grossProfit:          result.grossProfit,
      grossMarginPct:       result.grossMarginPct,
      warehouseStorageTotal: result.warehouseStorageTotal,
      items: result.items.map(i => ({
        id: i.id, batchNo: i.batchNo, unitCostSnap: i.unitCostSnap,
        warehouseStorageDays: i.warehouseStorageDays, effectiveUnitCost: i.effectiveUnitCost,
        grossMarginAmt: i.grossMarginAmt, grossMarginRate: i.grossMarginRate,
        source: i.costBreakdown.source,
      })),
    })
  } catch (err) {
    return handleApiError(err, 'orders.marginPreview')
  }
}

// POST /api/orders/recalc-margin  — 計算並寫入（有稽核日誌）
// body: { orderId } or { all: true }
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!CAN_RECALC.includes(session.user.role as string)) {
    return NextResponse.json({ error: '無權限執行毛利計算' }, { status: 403 })
  }

  const ip = getIp(req)
  const ua = req.headers.get('user-agent') ?? undefined

  try {
    const body = await req.json()

    if (body.all) {
      const orders = await prisma.salesOrder.findMany({
        where: { status: { notIn: ['DRAFT', 'CANCELLED'] } },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      })

      // Timeout protection: stop processing after 50s to avoid Next.js 60s limit
      const deadline = Date.now() + 50_000
      const CHUNK = 20
      let success = 0; let failed = 0; let timedOut = false

      for (let i = 0; i < orders.length; i += CHUNK) {
        if (Date.now() >= deadline) { timedOut = true; break }
        const chunk = orders.slice(i, i + CHUNK)
        await Promise.allSettled(
          chunk.map(o => persistOrderMargin(o.id).then(() => { success++ }).catch(() => { failed++ }))
        )
      }

      await logAudit({
        userId: session.user.id, userName: session.user.name ?? '', userRole: session.user.role as string,
        module: 'finance', action: 'BATCH_RECALC_MARGIN',
        entityType: 'SalesOrder', entityId: 'ALL',
        entityLabel: `批次重算 ${success}/${orders.length} 筆${timedOut ? '（逾時中斷）' : ''}`,
        ipAddress: ip, userAgent: ua,
      })
      return NextResponse.json({ success, failed, total: orders.length, timedOut })
    }

    if (!body.orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    // Snapshot before values for audit diff
    const orderBefore = await prisma.salesOrder.findUnique({
      where: { id: body.orderId },
      select: { orderNo: true, costOfGoods: true, grossProfit: true, grossMarginPct: true },
    })

    const result = await persistOrderMargin(body.orderId)

    await logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: session.user.role as string,
      module: 'finance', action: 'RECALC_MARGIN',
      entityType: 'SalesOrder', entityId: body.orderId,
      entityLabel: orderBefore?.orderNo,
      changes: {
        costOfGoods:    { before: Number(orderBefore?.costOfGoods ?? 0),    after: result.costOfGoods },
        grossProfit:    { before: Number(orderBefore?.grossProfit ?? 0),    after: result.grossProfit },
        grossMarginPct: { before: Number(orderBefore?.grossMarginPct ?? 0), after: result.grossMarginPct },
      },
      ipAddress: ip, userAgent: ua,
    })

    return NextResponse.json({
      costOfGoods:          result.costOfGoods,
      grossProfit:          result.grossProfit,
      grossMarginPct:       result.grossMarginPct,
      warehouseStorageTotal: result.warehouseStorageTotal,
      items: result.items.map(i => ({
        id: i.id, batchNo: i.batchNo, unitCostSnap: i.unitCostSnap,
        warehouseStorageDays: i.warehouseStorageDays, effectiveUnitCost: i.effectiveUnitCost,
        grossMarginAmt: i.grossMarginAmt, grossMarginRate: i.grossMarginRate,
        source: i.costBreakdown.source,
      })),
    })
  } catch (err) {
    return handleApiError(err, 'orders.recalcMargin')
  }
}
