import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { customerScope, buildScopeContext } from '@/lib/scope'
import ExcelJS from 'exceljs'

/**
 * GET /api/customers/export
 * 匯出客戶為 Excel
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = customerScope(buildScopeContext(session as { user: { id: string; role: string } }))

  const customers = await prisma.customer.findMany({
    where: { isActive: true, ...scope },
    include: {
      salesRep: { select: { name: true } },
      _count: { select: { salesOrders: true, visitRecords: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('客戶')

  ws.addRow(['客戶代碼', '客戶名稱', '類型', '等級', '區域', '聯絡人', '電話', 'Email', '地址', '負責業務', '訂單數', '拜訪數', '開發狀態', '建立日期'])
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
  })

  for (const c of customers) {
    ws.addRow([
      c.code,
      c.name,
      c.type,
      c.grade ?? '',
      c.region ?? '',
      c.contactPerson ?? '',
      c.phone ?? '',
      c.email ?? '',
      c.address ?? '',
      c.salesRep?.name ?? '',
      c._count.salesOrders,
      c._count.visitRecords,
      c.devStatus,
      new Date(c.createdAt).toLocaleDateString('zh-TW'),
    ])
  }

  ws.getColumn(1).width = 10
  ws.getColumn(2).width = 25
  ws.getColumn(3).width = 15
  ws.getColumn(4).width = 6
  ws.getColumn(5).width = 10
  ws.getColumn(6).width = 12
  ws.getColumn(7).width = 15
  ws.getColumn(8).width = 22
  ws.getColumn(9).width = 30
  ws.getColumn(10).width = 10
  ws.getColumn(11).width = 8
  ws.getColumn(12).width = 8
  ws.getColumn(13).width = 10
  ws.getColumn(14).width = 12

  const buffer = await wb.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
