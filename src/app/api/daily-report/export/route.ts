import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'

/**
 * GET /api/daily-report/export?date=2026-03-20
 * 匯出每日報表為 Excel
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const targetDate = new Date(dateStr)
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 86400000)

  // Yesterday for comparison
  const startOfYesterday = new Date(startOfDay.getTime() - 86400000)

  // ── Fetch all data ──
  const [
    todayOrders, todayRevAgg, yesterdayOrders, yesterdayRevAgg,
    todayShipments, newCustomers, visitRecords, callRecords,
    salesRanking,
  ] = await Promise.all([
    prisma.salesOrder.count({
      where: { createdAt: { gte: startOfDay, lt: endOfDay }, status: { not: 'CANCELLED' } },
    }),
    prisma.salesOrder.aggregate({
      where: { createdAt: { gte: startOfDay, lt: endOfDay }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
    prisma.salesOrder.count({
      where: { createdAt: { gte: startOfYesterday, lt: startOfDay }, status: { not: 'CANCELLED' } },
    }),
    prisma.salesOrder.aggregate({
      where: { createdAt: { gte: startOfYesterday, lt: startOfDay }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
    prisma.shipment.count({
      where: { shipDate: { gte: startOfDay, lt: endOfDay } },
    }),
    prisma.customer.count({
      where: { createdAt: { gte: startOfDay, lt: endOfDay } },
    }),
    prisma.visitRecord.findMany({
      where: { visitDate: { gte: startOfDay, lt: endOfDay } },
      include: {
        customer: { select: { name: true } },
        visitedBy: { select: { name: true } },
      },
    }),
    prisma.callRecord.findMany({
      where: { callDate: { gte: startOfDay, lt: endOfDay } },
      include: {
        customer: { select: { name: true } },
        calledBy: { select: { name: true } },
      },
    }),
    prisma.$queryRaw<Array<{
      name: string; revenue: number; orders: bigint
    }>>`
      SELECT u.name, SUM(so."totalAmount")::float AS revenue, COUNT(so.id) AS orders
      FROM "SalesOrder" so JOIN "User" u ON u.id = so."createdById"
      WHERE so."createdAt" >= ${startOfDay} AND so."createdAt" < ${endOfDay}
        AND so.status != 'CANCELLED'
      GROUP BY u.name ORDER BY revenue DESC
    `,
  ])

  const todayRevenue = Number(todayRevAgg._sum.totalAmount ?? 0)
  const yesterdayRevenue = Number(yesterdayRevAgg._sum.totalAmount ?? 0)

  // ── Build Excel ──
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ComfortPlus ERP'
  wb.created = new Date()

  // Sheet 1: 日報摘要
  const ws1 = wb.addWorksheet('日報摘要')

  // Title
  ws1.mergeCells('A1:F1')
  const titleCell = ws1.getCell('A1')
  titleCell.value = `ComfortPlus 每日報表 — ${dateStr}`
  titleCell.font = { size: 16, bold: true }
  titleCell.alignment = { horizontal: 'center' }

  // Summary section
  ws1.addRow([])
  ws1.addRow(['項目', '今日', '昨日', '差異'])
  ws1.addRow(['訂單數', todayOrders, yesterdayOrders, todayOrders - yesterdayOrders])
  ws1.addRow(['營收 (TWD)', todayRevenue, yesterdayRevenue, todayRevenue - yesterdayRevenue])
  ws1.addRow(['出貨數', todayShipments, '', ''])
  ws1.addRow(['新客戶', newCustomers, '', ''])
  ws1.addRow(['拜訪數', visitRecords.length, '', ''])
  ws1.addRow(['電訪數', callRecords.length, '', ''])

  // Style header row
  const headerRow = ws1.getRow(3)
  headerRow.font = { bold: true }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
    cell.border = { bottom: { style: 'thin' } }
  })

  // Format currency columns
  ws1.getColumn(2).numFmt = '#,##0'
  ws1.getColumn(3).numFmt = '#,##0'
  ws1.getColumn(4).numFmt = '#,##0'
  ws1.getColumn(1).width = 15
  ws1.getColumn(2).width = 15
  ws1.getColumn(3).width = 15
  ws1.getColumn(4).width = 12

  // Sales ranking section
  ws1.addRow([])
  ws1.addRow(['業務排名', '營收', '訂單數'])
  const rankHeaderRow = ws1.getRow(ws1.rowCount)
  rankHeaderRow.font = { bold: true }
  rankHeaderRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
  })
  for (const rep of salesRanking) {
    ws1.addRow([rep.name, rep.revenue, Number(rep.orders)])
  }

  // Sheet 2: 拜訪記錄
  if (visitRecords.length > 0) {
    const ws2 = wb.addWorksheet('拜訪記錄')
    ws2.addRow(['業務', '客戶', '拜訪日期', '目的', '重點內容'])
    const vHeader = ws2.getRow(1)
    vHeader.font = { bold: true }
    vHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
    })
    for (const v of visitRecords) {
      ws2.addRow([
        v.visitedBy.name,
        v.customer.name,
        new Date(v.visitDate).toLocaleDateString('zh-TW'),
        v.purpose ?? '',
        v.content ?? '',
      ])
    }
    ws2.getColumn(1).width = 12
    ws2.getColumn(2).width = 20
    ws2.getColumn(3).width = 12
    ws2.getColumn(4).width = 15
    ws2.getColumn(5).width = 40
  }

  // Sheet 3: 電訪記錄
  if (callRecords.length > 0) {
    const ws3 = wb.addWorksheet('電訪記錄')
    ws3.addRow(['業務', '客戶', '日期', '目的', '內容', '結果'])
    const cHeader = ws3.getRow(1)
    cHeader.font = { bold: true }
    cHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
    })
    for (const c of callRecords) {
      ws3.addRow([
        c.calledBy.name,
        c.customer.name,
        new Date(c.callDate).toLocaleDateString('zh-TW'),
        c.purpose ?? '',
        c.content ?? '',
        c.result ?? '',
      ])
    }
    ws3.getColumn(1).width = 12
    ws3.getColumn(2).width = 20
    ws3.getColumn(3).width = 12
    ws3.getColumn(4).width = 15
    ws3.getColumn(5).width = 40
    ws3.getColumn(6).width = 20
  }

  // Generate buffer
  const buffer = await wb.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="daily-report-${dateStr}.xlsx"`,
    },
  })
}
