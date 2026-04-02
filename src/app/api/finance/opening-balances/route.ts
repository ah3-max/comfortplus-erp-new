import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

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
function cellDate(cell: ExcelJS.Cell): Date | null {
  const v = cell.value
  if (!v) return null
  if (v instanceof Date) return v
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d
}

// ?type=ar  AR columns: 客戶代碼* / 客戶名稱* / 發票號 / 發票日期 / 到期日 / 未付金額* / 備註
// ?type=ap  AP columns: 供應商代碼* / 供應商名稱* / 發票號 / 發票日期 / 到期日 / 未付金額* / 備註

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') // 'ar' | 'ap'
    if (!type || !['ar', 'ap'].includes(type)) {
      return NextResponse.json({ error: 'type 參數需為 ar 或 ap' }, { status: 400 })
    }

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

    const results = { created: 0, skipped: 0, errors: [] as string[] }
    const rows: ExcelJS.Row[] = []
    sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push(row) })

    for (const row of rows) {
      const partyCode  = cellStr(row.getCell(1))
      const partyName  = cellStr(row.getCell(2))
      const invoiceNo  = cellStr(row.getCell(3)) || null
      const invoiceDate = cellDate(row.getCell(4))
      const dueDate    = cellDate(row.getCell(5))
      const amount     = cellNum(row.getCell(6))
      const notes      = cellStr(row.getCell(7)) || null

      if ((!partyCode && !partyName) || amount === null) { results.skipped++; continue }
      if (amount <= 0) { results.skipped++; continue }

      if (type === 'ar') {
        // Find customer by code or name
        const customer = await prisma.customer.findFirst({
          where: partyCode
            ? { code: partyCode }
            : { name: { equals: partyName, mode: 'insensitive' } },
          select: { id: true },
        })
        if (!customer) {
          results.errors.push(`找不到客戶：${partyCode || partyName}`)
          results.skipped++
          continue
        }
        await prisma.accountsReceivable.create({
          data: {
            customerId: customer.id,
            invoiceNo,
            invoiceDate,
            dueDate,
            amount,
            paidAmount: 0,
            status: 'NOT_DUE',
            notes,
          },
        })
        results.created++
      } else {
        // AP: find supplier
        const supplier = await prisma.supplier.findFirst({
          where: partyCode
            ? { code: partyCode }
            : { name: { equals: partyName, mode: 'insensitive' } },
          select: { id: true },
        })
        if (!supplier) {
          results.errors.push(`找不到供應商：${partyCode || partyName}`)
          results.skipped++
          continue
        }
        await prisma.accountsPayable.create({
          data: {
            supplierId: supplier.id,
            invoiceNo,
            invoiceDate,
            dueDate,
            amount,
            paidAmount: 0,
            status: 'NOT_DUE',
            notes,
          },
        })
        results.created++
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    return handleApiError(error, 'opening-balances.POST')
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'ar'

  const workbook = new ExcelJS.Workbook()
  const isAr = type === 'ar'
  const sheetName = isAr ? '應收帳款期初' : '應付帳款期初'
  const sheet = workbook.addWorksheet(sheetName)

  const partyLabel = isAr ? '客戶' : '供應商'
  sheet.columns = [
    { header: `${partyLabel}代碼 *`, key: 'code', width: 16 },
    { header: `${partyLabel}名稱 *`, key: 'name', width: 30 },
    { header: '發票號碼', key: 'invoiceNo', width: 16 },
    { header: '發票日期', key: 'invoiceDate', width: 14 },
    { header: '到期日', key: 'dueDate', width: 14 },
    { header: '未付金額 *', key: 'amount', width: 14 },
    { header: '備註', key: 'notes', width: 24 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAr ? 'FFE2EFDA' : 'FFFFF2CC' } }

  if (isAr) {
    sheet.addRow({ code: 'C00001', name: '範例護理之家', invoiceNo: 'IV2025001', invoiceDate: '2025-12-31', dueDate: '2026-01-31', amount: 50000, notes: '鼎新期初匯入' })
  } else {
    sheet.addRow({ code: 'S001', name: '範例供應商', invoiceNo: 'PO2025001', invoiceDate: '2025-12-31', dueDate: '2026-01-31', amount: 30000, notes: '鼎新期初匯入' })
  }

  const notesSheet = workbook.addWorksheet('說明（鼎新對照）')
  notesSheet.addRow(['ComfortPlus 欄位', '鼎新 A1 對應欄位', '說明'])
  if (isAr) {
    notesSheet.addRow(['客戶代碼', '客戶代號', '從客戶主檔確認代碼，或填客戶名稱'])
    notesSheet.addRow(['未付金額', '未收金額 / 餘額', '必填，只填尚未收回的金額'])
    notesSheet.addRow(['到期日', '帳款到期日', '決定帳齡分類'])
  } else {
    notesSheet.addRow(['供應商代碼', '廠商代號', '從供應商主檔確認代碼，或填名稱'])
    notesSheet.addRow(['未付金額', '未付金額 / 餘額', '必填，只填尚未付出的金額'])
    notesSheet.addRow(['到期日', '付款到期日', ''])
  }
  notesSheet.columns = [{ width: 20 }, { width: 24 }, { width: 40 }]
  notesSheet.getRow(1).font = { bold: true }

  const filename = isAr ? 'ar_opening_template.xlsx' : 'ap_opening_template.xlsx'
  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
