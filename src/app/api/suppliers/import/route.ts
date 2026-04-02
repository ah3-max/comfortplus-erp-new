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

// Columns (1-based):
// 1: 供應商代碼 *  2: 供應商名稱 *  3: 聯絡人  4: 電話  5: Email
// 6: 地址  7: 統編  8: 付款條件  9: 國家  10: 備註

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

    const results = { created: 0, updated: 0, skipped: 0 }
    const rows: ExcelJS.Row[] = []
    sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push(row) })

    for (const row of rows) {
      const code         = cellStr(row.getCell(1))
      const name         = cellStr(row.getCell(2))
      const contactPerson = cellStr(row.getCell(3)) || null
      const phone        = cellStr(row.getCell(4)) || null
      const email        = cellStr(row.getCell(5)) || null
      const address      = cellStr(row.getCell(6)) || null
      const taxId        = cellStr(row.getCell(7)) || null
      const paymentTerms = cellStr(row.getCell(8)) || null
      const country      = cellStr(row.getCell(9)) || 'TW'
      const notes        = cellStr(row.getCell(10)) || null

      if (!code || !name) { results.skipped++; continue }

      const existing = await prisma.supplier.findUnique({ where: { code }, select: { id: true } })
      const data = { name, contactPerson, phone, email, address, taxId, paymentTerms, country, notes }

      if (existing) {
        await prisma.supplier.update({ where: { code }, data })
        results.updated++
      } else {
        await prisma.supplier.create({ data: { code, ...data } })
        results.created++
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    return handleApiError(error, 'suppliers.import')
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('供應商主檔')
  sheet.columns = [
    { header: '供應商代碼 *', key: 'code', width: 16 },
    { header: '供應商名稱 *', key: 'name', width: 30 },
    { header: '聯絡人', key: 'contactPerson', width: 12 },
    { header: '電話', key: 'phone', width: 16 },
    { header: 'Email', key: 'email', width: 24 },
    { header: '地址', key: 'address', width: 36 },
    { header: '統一編號', key: 'taxId', width: 12 },
    { header: '付款條件', key: 'paymentTerms', width: 14 },
    { header: '國家(TW/VN/CN)', key: 'country', width: 14 },
    { header: '備註', key: 'notes', width: 24 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } }
  sheet.addRow({ code: 'S001', name: '範例供應商股份有限公司', contactPerson: '王業務', phone: '02-87654321', email: 'sample@supplier.com', address: '台北市信義區', taxId: '12345678', paymentTerms: 'NET30', country: 'TW', notes: '' })

  const notesSheet = workbook.addWorksheet('說明（鼎新對照）')
  notesSheet.addRow(['ComfortPlus 欄位', '鼎新 A1 對應欄位', '說明'])
  notesSheet.addRow(['供應商代碼', '廠商代碼', '必填，唯一識別'])
  notesSheet.addRow(['供應商名稱', '廠商名稱', '必填'])
  notesSheet.addRow(['統一編號', '統一編號', ''])
  notesSheet.addRow(['付款條件', '付款條件', 'NET30 / NET60 / CASH'])
  notesSheet.addRow(['國家', '國別', 'TW=台灣 VN=越南 CN=中國 ID=印尼'])
  notesSheet.columns = [{ width: 20 }, { width: 24 }, { width: 36 }]
  notesSheet.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="supplier_import_template.xlsx"',
    },
  })
}
