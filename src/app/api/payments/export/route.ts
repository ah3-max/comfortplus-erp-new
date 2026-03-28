import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: '銀行轉帳', CHECK: '支票', CASH: '現金',
  CREDIT_CARD: '信用卡', OTHER: '其他',
}
const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: '訂金', PROGRESS: '期款', FINAL: '尾款',
  FULL: '全額', REFUND: '退款', ADJUSTMENT: '調整',
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const direction = searchParams.get('direction') ?? ''
  const dateFrom  = searchParams.get('dateFrom') ?? ''
  const dateTo    = searchParams.get('dateTo') ?? ''

  const payments = await prisma.paymentRecord.findMany({
    where: {
      ...(direction && { direction: direction as never }),
      ...(dateFrom || dateTo ? {
        paymentDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo + 'T23:59:59') }),
        },
      } : {}),
    },
    include: {
      customer:      { select: { name: true, code: true } },
      supplier:      { select: { name: true, code: true } },
      salesOrder:    { select: { orderNo: true } },
      purchaseOrder: { select: { poNo: true } } as const,
    },
    orderBy: { paymentDate: 'desc' },
    take: 5000,
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('收付款')

  ws.addRow(['收付單號', '方向', '類型', '金額', '日期', '客戶/供應商', '關聯單號', '付款方式', '發票號碼', '備註'])
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
  })

  for (const p of payments) {
    const party = p.direction === 'INCOMING'
      ? (p.customer ? `${p.customer.code} ${p.customer.name}` : '')
      : (p.supplier ? `${p.supplier.code} ${p.supplier.name}` : '')
    const linkedOrder = p.direction === 'INCOMING'
      ? (p.salesOrder?.orderNo ?? '')
      : (p.purchaseOrder?.poNo ?? '')
    ws.addRow([
      p.paymentNo,
      p.direction === 'INCOMING' ? '收款' : '付款',
      TYPE_LABELS[p.paymentType] ?? p.paymentType,
      Number(p.amount),
      new Date(p.paymentDate).toLocaleDateString('zh-TW'),
      party,
      linkedOrder,
      p.paymentMethod ? (METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod) : '',
      p.invoiceNo ?? '',
      p.notes ?? '',
    ])
  }

  ws.getColumn(1).width = 18
  ws.getColumn(2).width = 8
  ws.getColumn(3).width = 8
  ws.getColumn(4).width = 14; ws.getColumn(4).numFmt = '#,##0'
  ws.getColumn(5).width = 12
  ws.getColumn(6).width = 22
  ws.getColumn(7).width = 16
  ws.getColumn(8).width = 12
  ws.getColumn(9).width = 14
  ws.getColumn(10).width = 30

  const buffer = await wb.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
