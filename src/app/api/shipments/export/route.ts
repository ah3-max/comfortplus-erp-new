import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { shipmentScope, buildScopeContext } from '@/lib/scope'
import ExcelJS from 'exceljs'

/**
 * GET /api/shipments/export?ids=&search=&status=
 * 匯出出貨單為 Excel
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search         = searchParams.get('search') ?? ''
  const status         = searchParams.get('status') ?? ''
  const deliveryMethod = searchParams.get('deliveryMethod') ?? ''
  const ids            = searchParams.getAll('ids')

  const scope = shipmentScope(buildScopeContext(session as { user: { id: string; role: string } }))

  const shipments = await prisma.shipment.findMany({
    where: {
      ...scope,
      ...(ids.length > 0
        ? { id: { in: ids } }
        : {
            ...(search && {
              OR: [
                { shipmentNo: { contains: search, mode: 'insensitive' } },
                { order: { customer: { name: { contains: search, mode: 'insensitive' } } } },
                { trackingNo: { contains: search, mode: 'insensitive' } },
              ],
            }),
            ...(status         && { status: status as never }),
            ...(deliveryMethod && { deliveryMethod: deliveryMethod as never }),
          }),
    },
    include: {
      order: {
        include: { customer: { select: { name: true, code: true, address: true } } },
      },
      logisticsProvider: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: {
        include: { product: { select: { sku: true, name: true, unit: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('出貨單')

  // Header
  ws.addRow(['出貨單號', '訂單編號', '客戶', '狀態', '出貨方式', '物流商', '追蹤號', '棧板/箱數', '出貨日', '預計到貨', '簽收狀態', '異常', '建立者', '商品明細'])
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
  })

  const statusMap: Record<string, string> = {
    PREPARING: '備貨中', PACKED: '已打包', SHIPPED: '已出貨', DELIVERED: '已送達', FAILED: '配送失敗',
  }
  const methodMap: Record<string, string> = {
    EXPRESS: '快遞', FREIGHT: '貨運', OWN_FLEET: '自有車隊', SELF_PICKUP: '自取',
  }
  const signMap: Record<string, string> = {
    PENDING: '待簽', SIGNED: '已簽', REJECTED: '拒簽',
  }

  for (const s of shipments) {
    const itemsSummary = s.items.map(i => `${i.product.name}×${i.quantity}`).join('、')
    ws.addRow([
      s.shipmentNo,
      s.order.orderNo,
      s.order.customer.name,
      statusMap[s.status] ?? s.status,
      methodMap[s.deliveryMethod] ?? s.deliveryMethod,
      s.logisticsProvider?.name ?? s.carrier ?? '',
      s.trackingNo ?? '',
      s.palletCount != null || s.boxCount != null ? `${s.palletCount ?? '—'}/${s.boxCount ?? '—'}` : '',
      s.shipDate ? new Date(s.shipDate).toLocaleDateString('zh-TW') : '',
      s.expectedDeliveryDate ? new Date(s.expectedDeliveryDate).toLocaleDateString('zh-TW') : '',
      signMap[s.signStatus] ?? s.signStatus,
      s.anomalyStatus !== 'NORMAL' ? s.anomalyStatus : '',
      s.createdBy.name,
      itemsSummary,
    ])
  }

  // Column widths
  const widths = [18, 18, 20, 10, 10, 16, 18, 12, 12, 12, 10, 10, 10, 40]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const buffer = await wb.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="shipments-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
