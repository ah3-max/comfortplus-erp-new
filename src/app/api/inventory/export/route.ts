import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const warehouseId = searchParams.get('warehouseId') ?? ''
  const search      = searchParams.get('search') ?? ''

  const lots = await prisma.inventoryLot.findMany({
    where: {
      ...(warehouseId && { warehouseId }),
      ...(search && {
        OR: [
          { lotNo: { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { sku:  { contains: search, mode: 'insensitive' } } },
        ],
      }),
      quantity: { gt: 0 },
    },
    include: {
      product:   { select: { name: true, sku: true, unit: true } },
      warehouse: { select: { name: true, code: true } },
    },
    orderBy: [{ warehouse: { code: 'asc' } }, { product: { sku: 'asc' } }],
    take: 10000,
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('庫存清單')

  ws.addRow(['批號', 'SKU', '商品名稱', '單位', '倉庫', '倉庫代碼', '庫存量', '製造日期', '到期日', '狀態'])
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
  })

  for (const lot of lots) {
    ws.addRow([
      lot.lotNo,
      lot.product.sku,
      lot.product.name,
      lot.product.unit ?? '',
      lot.warehouse.name,
      lot.warehouse.code,
      lot.quantity,
      lot.manufactureDate ? new Date(lot.manufactureDate).toLocaleDateString('zh-TW') : '',
      lot.expiryDate      ? new Date(lot.expiryDate).toLocaleDateString('zh-TW') : '',
      lot.status,
    ])
  }

  ws.getColumn(1).width = 20
  ws.getColumn(2).width = 14
  ws.getColumn(3).width = 24
  ws.getColumn(4).width = 8
  ws.getColumn(5).width = 16
  ws.getColumn(6).width = 10
  ws.getColumn(7).width = 12; ws.getColumn(7).numFmt = '#,##0'
  ws.getColumn(8).width = 12
  ws.getColumn(9).width = 12
  ws.getColumn(10).width = 12

  const buffer = await wb.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="inventory-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
