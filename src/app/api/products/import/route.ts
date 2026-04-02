import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'PROCUREMENT']

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

// Columns (1-based):
// 1: SKU *  2: 品名 *  3: 分類  4: 規格  5: 單位  6: 成本價 *  7: 售價 *
// 8: 通路價  9: 批發價  10: 每包片數  11: 每箱包數  12: 條碼  13: 備註

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

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }

    const rows: ExcelJS.Row[] = []
    sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push(row) })

    for (const row of rows) {
      const sku          = cellStr(row.getCell(1))
      const name         = cellStr(row.getCell(2))
      const category     = cellStr(row.getCell(3)) || '紙尿褲'
      const specification = cellStr(row.getCell(4)) || null
      const unit         = cellStr(row.getCell(5)) || '包'
      const costPrice    = cellNum(row.getCell(6))
      const sellingPrice = cellNum(row.getCell(7))
      const channelPrice = cellNum(row.getCell(8))
      const wholesalePrice = cellNum(row.getCell(9))
      const piecesPerPack = cellNum(row.getCell(10)) ? Number(cellNum(row.getCell(10))) : null
      const packsPerBox  = cellNum(row.getCell(11)) ? Number(cellNum(row.getCell(11))) : null
      const barcode      = cellStr(row.getCell(12)) || null
      const description  = cellStr(row.getCell(13)) || null

      if (!sku || !name) { results.skipped++; continue }
      if (costPrice === null || sellingPrice === null) {
        results.errors.push(`SKU ${sku}：成本價或售價缺失`)
        results.skipped++
        continue
      }

      const existing = await prisma.product.findUnique({ where: { sku }, select: { id: true } })
      const data = {
        name, category, specification, unit,
        costPrice, sellingPrice,
        channelPrice: channelPrice ?? undefined,
        wholesalePrice: wholesalePrice ?? undefined,
        piecesPerPack, packsPerBox, barcode, description,
      }

      if (existing) {
        await prisma.product.update({ where: { sku }, data })
        results.updated++
      } else {
        await prisma.product.create({ data: { sku, ...data } })
        results.created++
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    return handleApiError(error, 'products.import')
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('商品主檔')
  sheet.columns = [
    { header: 'SKU/料號 *', key: 'sku', width: 18 },
    { header: '品名 *', key: 'name', width: 30 },
    { header: '分類', key: 'category', width: 14 },
    { header: '規格', key: 'specification', width: 20 },
    { header: '單位', key: 'unit', width: 8 },
    { header: '成本價 *', key: 'costPrice', width: 12 },
    { header: '售價 *', key: 'sellingPrice', width: 12 },
    { header: '通路價', key: 'channelPrice', width: 12 },
    { header: '批發價', key: 'wholesalePrice', width: 12 },
    { header: '每包片數', key: 'piecesPerPack', width: 10 },
    { header: '每箱包數', key: 'packsPerBox', width: 10 },
    { header: '條碼', key: 'barcode', width: 16 },
    { header: '備註', key: 'description', width: 24 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
  sheet.addRow({ sku: 'P001', name: '愛舒樂成人紙尿褲M', category: '紙尿褲', specification: 'M/30片/包', unit: '包', costPrice: 120, sellingPrice: 180, channelPrice: 160, wholesalePrice: 150, piecesPerPack: 30, packsPerBox: 6, barcode: '4710000000001', description: '範例' })

  const notesSheet = workbook.addWorksheet('說明（鼎新對照）')
  notesSheet.addRow(['ComfortPlus 欄位', '鼎新 A1 對應欄位', '說明'])
  notesSheet.addRow(['SKU/料號', '商品代碼', '必填，唯一識別碼'])
  notesSheet.addRow(['品名', '品名', '必填'])
  notesSheet.addRow(['成本價', '進貨單價 / 成本', '必填'])
  notesSheet.addRow(['售價', '售價 / 定價', '必填'])
  notesSheet.addRow(['通路價', '特殊售價', ''])
  notesSheet.addRow(['每包片數', '包裝規格', ''])
  notesSheet.addRow(['每箱包數', '箱裝數', ''])
  notesSheet.columns = [{ width: 20 }, { width: 24 }, { width: 36 }]
  notesSheet.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="product_import_template.xlsx"',
    },
  })
}
