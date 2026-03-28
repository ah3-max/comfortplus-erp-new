import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo') ?? ''

  const invoices = await prisma.salesInvoice.findMany({
    where: {
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(status && { status: status as never }),
      ...(dateFrom || dateTo ? {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo + 'T23:59:59') }),
        },
      } : {}),
    },
    include: {
      customer:    { select: { name: true, code: true } },
      salesPerson: { select: { name: true } },
      warehouse:   { select: { name: true } },
      items: { include: { product: { select: { name: true, sku: true } } } },
    },
    orderBy: { date: 'desc' },
    take: 5000,
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('銷貨單')

  ws.addRow(['銷貨單號', '客戶', '客戶代碼', '日期', '狀態', '稅前金額', '營業稅', '含稅合計', '業務', '倉庫', '品項明細'])
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
  })

  for (const inv of invoices) {
    const itemsSummary = inv.items.map(i => `${i.product?.name ?? i.productName}×${i.quantity}`).join('、')
    ws.addRow([
      inv.invoiceNumber,
      inv.customer.name,
      inv.customer.code,
      new Date(inv.date).toLocaleDateString('zh-TW'),
      inv.status,
      Number(inv.subtotal),
      Number(inv.taxAmount),
      Number(inv.totalAmount),
      inv.salesPerson?.name ?? '',
      inv.warehouse?.name ?? '',
      itemsSummary,
    ])
  }

  ws.getColumn(1).width = 20
  ws.getColumn(2).width = 20
  ws.getColumn(3).width = 10
  ws.getColumn(4).width = 12
  ws.getColumn(5).width = 12
  ws.getColumn(6).width = 14; ws.getColumn(6).numFmt = '#,##0'
  ws.getColumn(7).width = 12; ws.getColumn(7).numFmt = '#,##0'
  ws.getColumn(8).width = 14; ws.getColumn(8).numFmt = '#,##0'
  ws.getColumn(9).width = 10
  ws.getColumn(10).width = 12
  ws.getColumn(11).width = 50

  const buffer = await wb.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="sales-invoices-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
