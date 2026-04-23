import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/samples/import
 * 樣品寄送紀錄 Excel 批次匯入
 *
 * 欄位：
 *   1. 客戶名稱或代碼        *必填
 *   2. 寄送日 (YYYY-MM-DD)  空值用今天
 *   3. 樣品品項描述          *必填（自由文字，例如「嬰兒紙尿布 L 20 片」）
 *   4. 數量                  選填（整數）
 *   5. 目的 (試用/比較/教育/議價)  選填
 *   6. 寄送單號              選填
 *   7. 收件人                選填
 *   8. 預計追蹤日            選填
 *   9. 備註                  選填
 */

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES', 'CS', 'CARE_SUPERVISOR']

const PURPOSE_MAP: Record<string, string> = {
  '試用': 'TRIAL', 'TRIAL': 'TRIAL', '試樣': 'TRIAL',
  '比較': 'COMPARISON', 'COMPARISON': 'COMPARISON', '比價': 'COMPARISON',
  '教育': 'EDUCATION', 'EDUCATION': 'EDUCATION', '教育訓練': 'EDUCATION',
  '議價': 'NEGOTIATION', 'NEGOTIATION': 'NEGOTIATION',
  '其他': 'OTHER', 'OTHER': 'OTHER',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cellStr(cell: any): string {
  const v = cell?.value
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text).trim()
  if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result).trim()
  return String(v).trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cellDate(cell: any): Date | null {
  const v = cell?.value
  if (!v) return null
  if (v instanceof Date) return v
  const s = cellStr(cell)
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: '無權限匯入樣品紀錄' }, { status: 403 })
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
    if (!sheet) return NextResponse.json({ error: 'Excel 沒有工作表' }, { status: 400 })

    const results = { created: 0, skipped: 0, errors: [] as { row: number; reason: string }[] }

    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
    })
    const byName = new Map(customers.map(c => [c.name.trim(), c]))
    const byCode = new Map(customers.map(c => [c.code.trim().toUpperCase(), c]))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowsToProcess: Array<{ row: number; data: any }> = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) rowsToProcess.push({ row: rowNumber, data: row })
    })

    const today = new Date()

    for (const { row: rowNumber, data: row } of rowsToProcess) {
      const nameOrCode = cellStr(row.getCell(1))
      const sentDate   = cellDate(row.getCell(2)) ?? today
      const items      = cellStr(row.getCell(3))
      const qtyRaw     = cellStr(row.getCell(4))
      const purposeRaw = cellStr(row.getCell(5))
      const trackingNo = cellStr(row.getCell(6))
      const recipient  = cellStr(row.getCell(7))
      const followUp   = cellDate(row.getCell(8))
      const notes      = cellStr(row.getCell(9))

      if (!nameOrCode) { results.skipped++; continue }
      if (!items) {
        results.errors.push({ row: rowNumber, reason: '樣品品項描述（第 3 欄）是必填' })
        continue
      }

      const customer = byName.get(nameOrCode.trim()) ?? byCode.get(nameOrCode.trim().toUpperCase())
      if (!customer) {
        results.errors.push({ row: rowNumber, reason: `找不到客戶「${nameOrCode}」` })
        continue
      }

      const qty = qtyRaw ? Math.max(0, parseInt(qtyRaw, 10)) : null
      const purpose = PURPOSE_MAP[purposeRaw] ?? PURPOSE_MAP[purposeRaw.toUpperCase()] ?? null

      try {
        await prisma.sampleRecord.create({
          data: {
            customerId: customer.id,
            sentById: session.user.id,
            sentDate,
            items,
            quantity: qty && !isNaN(qty) ? qty : null,
            purpose: (purpose ?? null) as never,
            trackingNo: trackingNo || null,
            recipient: recipient || null,
            followUpDate: followUp,
            notes: notes || null,
          },
        })
        results.created++
      } catch (e) {
        results.errors.push({ row: rowNumber, reason: (e as Error).message })
      }
    }

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'samples',
      action: 'IMPORT',
      entityType: 'SampleRecord',
      entityId: 'bulk',
      entityLabel: `${file.name} — 匯入 ${results.created} 筆，錯誤 ${results.errors.length} 筆`,
    }).catch(() => {})

    return NextResponse.json(results)
  } catch (error) {
    return handleApiError(error, 'samples.import')
  }
}

/**
 * GET /api/samples/import — 下載範本 Excel
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('樣品寄送匯入')
  sheet.columns = [
    { header: '客戶名稱或代碼', key: 'customer', width: 24 },
    { header: '寄送日 (YYYY-MM-DD)', key: 'sentDate', width: 18 },
    { header: '樣品品項描述 (必填)', key: 'items', width: 32 },
    { header: '數量', key: 'quantity', width: 10 },
    { header: '目的 (試用/比較/教育/議價)', key: 'purpose', width: 22 },
    { header: '寄送單號', key: 'trackingNo', width: 16 },
    { header: '收件人', key: 'recipient', width: 16 },
    { header: '預計追蹤日', key: 'followUpDate', width: 16 },
    { header: '備註', key: 'notes', width: 24 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' },
  }
  sheet.addRow({
    customer: '陽明護理之家',
    sentDate: '2026-04-24',
    items: '成人紙尿布 M 30 片裝 ×2 包',
    quantity: 2,
    purpose: '試用',
    trackingNo: 'CTC-20260424-001',
    recipient: '王護理長',
    followUpDate: '2026-05-01',
    notes: '要求一週內回覆',
  })

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="samples-template.xlsx"`,
    },
  })
}
