import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'WAREHOUSE_MANAGER', 'PROCUREMENT']

function cellStr(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text)
  if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result)
  return String(v).trim()
}
function cellNum(cell: ExcelJS.Cell): number | null {
  const s = cellStr(cell)
  if (!s) return null
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

// Columns: SKU * / 品名(參考) / 倉庫代碼 / 數量 * / 成本價(更新用)

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳 Excel 檔案' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer: any = Buffer.from(new Uint8Array(bytes))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) return NextResponse.json({ error: 'Excel 無工作表' }, { status: 400 })

    const results = { updated: 0, skipped: 0, errors: [] as string[] }
    const rows: ExcelJS.Row[] = []
    sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push(row) })

    for (const row of rows) {
      const sku       = cellStr(row.getCell(1))
      const warehouse = cellStr(row.getCell(3)) || 'MAIN'
      const qty       = cellNum(row.getCell(4))
      const costPrice = cellNum(row.getCell(5))

      if (!sku || qty === null) { results.skipped++; continue }

      const product = await prisma.product.findUnique({ where: { sku }, select: { id: true } })
      if (!product) {
        results.errors.push(`找不到商品 SKU：${sku}`)
        results.skipped++
        continue
      }

      // Upsert inventory
      await prisma.inventory.upsert({
        where: { productId_warehouse_category: { productId: product.id, warehouse, category: 'FINISHED_GOODS' } },
        update: {
          quantity: qty,
          availableQty: qty,
        },
        create: {
          productId: product.id,
          warehouse,
          category: 'FINISHED_GOODS',
          quantity: qty,
          availableQty: qty,
        },
      })

      // Optionally update cost price
      if (costPrice !== null && costPrice > 0) {
        await prisma.product.update({ where: { id: product.id }, data: { costPrice } })
      }

      results.updated++
    }

    return NextResponse.json(results)
  } catch (error) {
    return handleApiError(error, 'inventory.opening')
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('庫存期初')
  sheet.columns = [
    { header: 'SKU/料號 *', key: 'sku', width: 18 },
    { header: '品名（參考）', key: 'name', width: 28 },
    { header: '倉庫代碼', key: 'warehouse', width: 14 },
    { header: '期初數量 *', key: 'quantity', width: 12 },
    { header: '成本價（選填，填入後更新商品成本）', key: 'costPrice', width: 30 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD7CC' } }
  sheet.addRow({ sku: 'P001', name: '愛舒樂M', warehouse: 'MAIN', quantity: 240, costPrice: 120 })
  sheet.addRow({ sku: 'P002', name: '愛舒樂L', warehouse: 'MAIN', quantity: 180, costPrice: 125 })

  const notesSheet = workbook.addWorksheet('說明（倉庫代碼）')
  notesSheet.addRow(['倉庫代碼', '說明', '對應鼎新倉庫'])
  notesSheet.addRow(['MAIN', '龜山主倉（預設）', '主倉'])
  notesSheet.addRow(['ZHONGHE768', '中和768', ''])
  notesSheet.addRow(['ZHONGHE_MAT', '中和材料倉', ''])
  notesSheet.addRow(['CUSTOM', '可自行填入其他倉庫代碼', ''])
  notesSheet.columns = [{ width: 18 }, { width: 24 }, { width: 20 }]
  notesSheet.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="inventory_opening_template.xlsx"',
    },
  })
}
