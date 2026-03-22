import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { orderScope, buildScopeContext } from '@/lib/scope'
import ExcelJS from 'exceljs'

/**
 * GET /api/orders/export?search=&status=
 * 匯出訂單為 Excel
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''

  const scope = orderScope(buildScopeContext(session as { user: { id: string; role: string } }))

  const orders = await prisma.salesOrder.findMany({
    where: {
      ...scope,
      ...(search && {
        OR: [
          { orderNo: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(status && { status: status as never }),
    },
    include: {
      customer: { select: { name: true, code: true } },
      createdBy: { select: { name: true } },
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('訂單')

  // Header
  ws.addRow(['訂單編號', '客戶', '客戶代碼', '狀態', '總金額', '已收', '未收', '業務', '建單日期', '商品明細'])
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
  })

  for (const o of orders) {
    const itemsSummary = o.items.map(i => `${i.product.name}×${i.quantity}`).join('、')
    ws.addRow([
      o.orderNo,
      o.customer.name,
      o.customer.code,
      o.status,
      Number(o.totalAmount),
      Number(o.paidAmount),
      Number(o.totalAmount) - Number(o.paidAmount),
      o.createdBy.name,
      new Date(o.createdAt).toLocaleDateString('zh-TW'),
      itemsSummary,
    ])
  }

  // Format
  ws.getColumn(1).width = 18
  ws.getColumn(2).width = 20
  ws.getColumn(3).width = 10
  ws.getColumn(4).width = 12
  ws.getColumn(5).width = 14
  ws.getColumn(5).numFmt = '#,##0'
  ws.getColumn(6).width = 14
  ws.getColumn(6).numFmt = '#,##0'
  ws.getColumn(7).width = 14
  ws.getColumn(7).numFmt = '#,##0'
  ws.getColumn(8).width = 10
  ws.getColumn(9).width = 12
  ws.getColumn(10).width = 40

  const buffer = await wb.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
