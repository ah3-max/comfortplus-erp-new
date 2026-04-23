import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { generateSequenceNo } from '@/lib/sequence'
import ExcelJS from 'exceljs'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/institution-tours/import — 機構拜訪排程 Excel 批次匯入
 *
 * 欄位：
 *   1. 客戶名稱或代碼        *必填
 *   2. 拜訪日 (YYYY-MM-DD)   *必填
 *   3. 預計開始時間 (HH:mm)   選填
 *   4. 類型 (例行/首訪/複訪/簽約/送樣/其他) 選填，預設 ROUTINE_VISIT
 *   5. 目的/備註              選填
 *   6. 指派業務 (姓名或 email) 選填，主管才有效；其他人預設為自己
 *   7. 提醒分鐘 (預設 30)     選填
 */

const MANAGER_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER']
const ALLOWED_ROLES = [...MANAGER_ROLES, 'SALES', 'CS', 'CARE_SUPERVISOR']

const TOUR_TYPE_MAP: Record<string, string> = {
  '例行': 'ROUTINE_VISIT', '例行拜訪': 'ROUTINE_VISIT', 'ROUTINE_VISIT': 'ROUTINE_VISIT',
  '首訪': 'FIRST_VISIT', '初訪': 'FIRST_VISIT', 'FIRST_VISIT': 'FIRST_VISIT',
  '複訪': 'SECOND_VISIT', '二訪': 'SECOND_VISIT', 'SECOND_VISIT': 'SECOND_VISIT',
  '三訪': 'THIRD_VISIT', 'THIRD_VISIT': 'THIRD_VISIT',
  '簽約': 'CONTRACT_VISIT', '合約': 'CONTRACT_VISIT', 'CONTRACT_VISIT': 'CONTRACT_VISIT',
  '送樣': 'SAMPLE_DELIVERY', 'SAMPLE_DELIVERY': 'SAMPLE_DELIVERY',
  '送貨': 'DELIVERY', 'DELIVERY': 'DELIVERY',
  '收款': 'PAYMENT_COLLECT', 'PAYMENT_COLLECT': 'PAYMENT_COLLECT',
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
      return NextResponse.json({ error: '無權限匯入拜訪排程' }, { status: 403 })
    }
    const isManager = MANAGER_ROLES.includes(role)

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

    const [customers, users] = await Promise.all([
      prisma.customer.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
      }),
    ])
    const byName = new Map(customers.map(c => [c.name.trim(), c]))
    const byCode = new Map(customers.map(c => [c.code.trim().toUpperCase(), c]))
    const userByName = new Map(users.map(u => [u.name.trim(), u]))
    const userByEmail = new Map(users.map(u => [u.email.trim().toLowerCase(), u]))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowsToProcess: Array<{ row: number; data: any }> = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) rowsToProcess.push({ row: rowNumber, data: row })
    })

    for (const { row: rowNumber, data: row } of rowsToProcess) {
      const nameOrCode = cellStr(row.getCell(1))
      const tourDate   = cellDate(row.getCell(2))
      const startTime  = cellStr(row.getCell(3))
      const typeRaw    = cellStr(row.getCell(4))
      const purpose    = cellStr(row.getCell(5))
      const assigneeRaw = cellStr(row.getCell(6))
      const reminderRaw = cellStr(row.getCell(7))

      if (!nameOrCode) { results.skipped++; continue }
      if (!tourDate) {
        results.errors.push({ row: rowNumber, reason: '拜訪日（第 2 欄）是必填' })
        continue
      }

      const customer = byName.get(nameOrCode.trim()) ?? byCode.get(nameOrCode.trim().toUpperCase())
      if (!customer) {
        results.errors.push({ row: rowNumber, reason: `找不到客戶「${nameOrCode}」` })
        continue
      }

      // Assignee: manager can specify anyone; others always self
      let assignedUserId = session.user.id
      if (isManager && assigneeRaw) {
        const u = userByName.get(assigneeRaw.trim()) ?? userByEmail.get(assigneeRaw.trim().toLowerCase())
        if (u) assignedUserId = u.id
        else {
          results.errors.push({ row: rowNumber, reason: `找不到指派業務「${assigneeRaw}」` })
          continue
        }
      }

      const tourType = TOUR_TYPE_MAP[typeRaw] ?? TOUR_TYPE_MAP[typeRaw.toUpperCase()] ?? 'ROUTINE_VISIT'
      const reminder = reminderRaw ? Math.max(0, parseInt(reminderRaw, 10) || 30) : 30
      const dateOnly = new Date(tourDate.getFullYear(), tourDate.getMonth(), tourDate.getDate())

      try {
        const tourNo = await generateSequenceNo('INSTITUTION_TOUR')
        await prisma.institutionTour.create({
          data: {
            tourNo,
            assignedUserId,
            customerId: customer.id,
            tourDate: dateOnly,
            plannedStartTime: startTime || null,
            reminderMinutes: reminder,
            tourType,
            purpose: purpose || null,
            status: 'SCHEDULED',
            createdById: session.user.id,
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
      module: 'institution-tours',
      action: 'IMPORT',
      entityType: 'InstitutionTour',
      entityId: 'bulk',
      entityLabel: `${file.name} — 匯入 ${results.created} 筆，錯誤 ${results.errors.length} 筆`,
    }).catch(() => {})

    return NextResponse.json(results)
  } catch (error) {
    return handleApiError(error, 'institution-tours.import')
  }
}

/**
 * GET /api/institution-tours/import — 下載範本 Excel
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('拜訪排程匯入')
  sheet.columns = [
    { header: '客戶名稱或代碼', key: 'customer', width: 24 },
    { header: '拜訪日 (YYYY-MM-DD)', key: 'tourDate', width: 18 },
    { header: '預計開始時間 (HH:mm)', key: 'startTime', width: 18 },
    { header: '類型 (例行/首訪/複訪/簽約/送樣)', key: 'tourType', width: 30 },
    { header: '目的/備註', key: 'purpose', width: 28 },
    { header: '指派業務 (姓名或 email)', key: 'assignee', width: 24 },
    { header: '提醒分鐘 (預設 30)', key: 'reminder', width: 16 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' },
  }
  sheet.addRow({
    customer: '陽明護理之家',
    tourDate: '2026-04-28',
    startTime: '14:00',
    tourType: '複訪',
    purpose: '確認試用結果 + 送新樣品',
    assignee: '',
    reminder: 30,
  })

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="institution-tours-template.xlsx"`,
    },
  })
}
