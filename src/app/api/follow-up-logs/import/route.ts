import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { CustomerDevStatus } from '@prisma/client'
import ExcelJS from 'exceljs'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/follow-up-logs/import
 * 機構聯繫紀錄 Excel 匯入
 *
 * 欄位（表頭第一列，從左到右）：
 *   1. 客戶名稱 或 客戶代碼（擇一，其一必填）
 *   2. 日期 (YYYY-MM-DD 或 Excel date，空值則用今天)
 *   3. 類型 (CALL/LINE/EMAIL/ONSITE/FIRST_VISIT... 支援中文：電話/LINE/Email/拜訪/初訪/複訪)
 *   4. 內容 (必填)
 *   5. 結果 (選填)
 *   6. 下次追蹤日 (選填)
 *   7. 下次動作 (選填)
 *   8. 客戶反應 (選填：POSITIVE/NEUTRAL/NEGATIVE)
 *
 * 回傳：{ created, skipped, errors: [{row, reason}] }
 */

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES', 'CS', 'CARE_SUPERVISOR']

// Chinese → FollowUpLogType enum
const LOG_TYPE_MAP: Record<string, string> = {
  '電話': 'CALL', '電訪': 'CALL', 'CALL': 'CALL',
  'LINE': 'LINE', 'Line': 'LINE', 'line': 'LINE',
  'EMAIL': 'EMAIL', 'Email': 'EMAIL', 'email': 'EMAIL', '信': 'EMAIL',
  '會議': 'MEETING', 'MEETING': 'MEETING',
  '拜訪': 'FIRST_VISIT', '初訪': 'FIRST_VISIT', 'FIRST_VISIT': 'FIRST_VISIT',
  '複訪': 'SECOND_VISIT', '二訪': 'SECOND_VISIT', 'SECOND_VISIT': 'SECOND_VISIT',
  '三訪': 'THIRD_VISIT', 'THIRD_VISIT': 'THIRD_VISIT',
  '送貨': 'DELIVERY', 'DELIVERY': 'DELIVERY',
  '春酒': 'SPRING_PARTY', 'SPRING_PARTY': 'SPRING_PARTY',
  '展覽': 'EXPO', 'EXPO': 'EXPO',
  '其他': 'OTHER', 'OTHER': 'OTHER',
}

const VISIT_TYPES = new Set(['FIRST_VISIT', 'SECOND_VISIT', 'THIRD_VISIT', 'DELIVERY', 'SPRING_PARTY', 'EXPO'])

const STAGE_RANK: Record<string, number> = {
  POTENTIAL: 0, CONTACTED: 1, VISITED: 2,
  NEGOTIATING: 3, TRIAL: 4, CLOSED: 5,
  STABLE_REPURCHASE: 6, DORMANT: -1, CHURNED: -1, REJECTED: -1, OTHER: 0,
}

function upgradeStage(current: string, candidate: string): string {
  const curRank = STAGE_RANK[current] ?? 0
  const candRank = STAGE_RANK[candidate] ?? 0
  if (curRank < 0) return candidate
  return candRank > curRank ? candidate : current
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
      return NextResponse.json({ error: '無權限匯入聯繫紀錄' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳 Excel 檔案' }, { status: 400 })

    // Opt-in: auto-create customer if nameOrCode doesn't match anyone
    const autoCreate = formData.get('autoCreateCustomer') === 'true'

    const bytes = await file.arrayBuffer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer: any = Buffer.from(new Uint8Array(bytes))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const sheet = workbook.worksheets[0]
    if (!sheet) return NextResponse.json({ error: 'Excel 沒有工作表' }, { status: 400 })

    const results = { created: 0, skipped: 0, customersCreated: 0, errors: [] as { row: number; reason: string }[] }

    // ── Header detection: map field → 1-based column index ──
    // Accept many aliases so Excel from different sources just works.
    const FIELD_ALIASES: Record<string, string[]> = {
      customer:   ['客戶', '客戶名稱', '客戶代碼', '機構', '機構名稱', '機構代碼', '名稱', 'customer', 'name'],
      date:       ['日期', '聯繫日', '聯繫日期', '拜訪日', '拜訪日期', '聯絡日期', 'date'],
      logType:    ['類型', '聯繫類型', '聯繫方式', '方式', '類別', 'type', 'logtype'],
      content:    ['內容', '聯繫內容', '拜訪內容', '摘要', '紀錄', '記錄', '說明', 'content', 'note'],
      result:     ['結果', '聯繫結果', '拜訪結果', 'result'],
      nextDate:   ['下次追蹤日', '下次追蹤', '下次拜訪', '下次聯繫日', '下次日期', 'nextdate'],
      nextAction: ['下次動作', '下次行動', '下一步', 'nextaction'],
      reaction:   ['客戶反應', '反應', '態度', 'reaction'],
    }

    const headerRow = sheet.getRow(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const col: Record<string, number | null> = {
      customer: null, date: null, logType: null, content: null,
      result: null, nextDate: null, nextAction: null, reaction: null,
    }
    const normalize = (s: string) => s.replace(/[\s（）()*\*]/g, '').toLowerCase()
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = cellStr(cell as any)
      const n = normalize(raw)
      for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        if (col[field] !== null) continue
        if (aliases.some(a => n.includes(normalize(a)))) {
          col[field] = colNumber
          break
        }
      }
    })

    if (!col.customer || !col.content) {
      // AI fallback: let LLM figure out the column mapping
      try {
        const headers: string[] = []
        headerRow.eachCell({ includeEmpty: false }, cell => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          headers.push(cellStr(cell as any))
        })

        const sampleRows: string[][] = []
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1 && rowNumber <= 3) {
            const rowData: string[] = []
            row.eachCell({ includeEmpty: true }, cell => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rowData.push(cellStr(cell as any))
            })
            sampleRows.push(rowData)
          }
        })

        const { aiChat } = await import('@/lib/ai')
        const aiRes = await aiChat({
          messages: [
            { role: 'system', content: '你是 Excel 資料分析助手，只回傳 JSON，不加任何說明。' },
            {
              role: 'user',
              content: `以下是 Excel 的表頭與前兩列資料：
表頭：${JSON.stringify(headers)}
資料範例：${JSON.stringify(sampleRows)}

請判斷哪個欄位名稱對應以下欄位（用表頭原始名稱，找不到用 null）：
- customer（客戶名稱/代碼/機構名稱）
- date（聯繫日期）
- logType（類型/方式/聯繫方式）
- content（內容/紀錄/摘要，必填）
- result（結果/聯繫結果）
- nextDate（下次追蹤日/下次拜訪）
- nextAction（下次動作/下一步）
- reaction（客戶反應/態度）

只回傳 JSON，格式：{"customer":"欄名","date":"欄名或null","logType":"欄名或null","content":"欄名","result":"欄名或null","nextDate":"欄名或null","nextAction":"欄名或null","reaction":"欄名或null"}`,
            },
          ],
          temperature: 0.1,
          maxTokens: 256,
        })

        const jsonMatch = aiRes.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const mapping = JSON.parse(jsonMatch[0]) as Record<string, string | null>
          headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const raw = cellStr(cell as any).trim()
            for (const [field, headerName] of Object.entries(mapping)) {
              if (headerName && raw === headerName.trim() && col[field] === null) {
                col[field] = colNumber
              }
            }
          })
        }
      } catch {
        // AI fallback failed — fall through to error below
      }
    }

    if (!col.customer || !col.content) {
      return NextResponse.json({
        error: `欄位對應失敗。請確認 Excel 第一列含有「客戶」與「內容」欄（找到 customer=${col.customer}, content=${col.content}）。\n系統接受的欄名：客戶/客戶名稱/機構、內容/紀錄/摘要等。`,
        detectedColumns: col,
      }, { status: 400 })
    }

    // Pre-load customer lookup (name + code) to keep imports fast
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, devStatus: true },
    })
    const byName = new Map(customers.map(c => [c.name.trim(), c]))
    const byCode = new Map(customers.map(c => [c.code.trim().toUpperCase(), c]))

    const rowsToProcess: Array<{ row: number; data: typeof sheet extends never ? never : unknown }> = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) rowsToProcess.push({ row: rowNumber, data: row })
    })

    const today = new Date()
    const getCell = (row: unknown, colIdx: number | null) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      colIdx ? (row as any).getCell(colIdx) : null

    for (const { row: rowNumber, data } of rowsToProcess) {
      const nameOrCode = col.customer   ? cellStr(getCell(data, col.customer))  : ''
      const logDateRaw = col.date       ? cellDate(getCell(data, col.date))     : null
      const logTypeRaw = col.logType    ? cellStr(getCell(data, col.logType))   : ''
      const content    = col.content    ? cellStr(getCell(data, col.content))   : ''
      const result     = col.result     ? cellStr(getCell(data, col.result))    : ''
      const nextDate   = col.nextDate   ? cellDate(getCell(data, col.nextDate)) : null
      const nextAction = col.nextAction ? cellStr(getCell(data, col.nextAction)): ''
      const reaction   = col.reaction   ? cellStr(getCell(data, col.reaction))  : ''

      if (!nameOrCode) {
        results.skipped++
        continue
      }
      if (!content) {
        results.errors.push({ row: rowNumber, reason: '內容（第 4 欄）是必填' })
        continue
      }

      const key = nameOrCode.trim()
      let customer = byName.get(key) ?? byCode.get(key.toUpperCase())

      // Auto-create missing customer if opted in
      if (!customer && autoCreate) {
        try {
          // Generate next customer code (C0001, C0002...)
          const lastCust = await prisma.customer.findFirst({
            where: { code: { startsWith: 'C' } },
            orderBy: { code: 'desc' },
            select: { code: true },
          })
          const seq = lastCust?.code ? (parseInt(lastCust.code.replace(/\D/g, ''), 10) || 0) : 0
          const code = `C${String(seq + 1 + results.customersCreated).padStart(4, '0')}`
          const created = await prisma.customer.create({
            data: {
              code,
              name: key,
              type: 'NURSING_HOME', // 最常見的 B2B type，業務手動改
              devStatus: 'POTENTIAL',
              isActive: true,
              notes: `由聯繫紀錄 Excel 匯入自動建立 (${new Date().toISOString().slice(0,10)})`,
            },
            select: { id: true, name: true, code: true, devStatus: true },
          })
          customer = created
          byName.set(key, created)
          byCode.set(code.toUpperCase(), created)
          results.customersCreated++
        } catch (e) {
          results.errors.push({ row: rowNumber, reason: `自動建客戶失敗：${(e as Error).message}` })
          continue
        }
      }

      if (!customer) {
        results.errors.push({ row: rowNumber, reason: `找不到客戶「${nameOrCode}」（可勾「找不到就建新的」自動建立）` })
        continue
      }

      const logType = LOG_TYPE_MAP[logTypeRaw] ?? LOG_TYPE_MAP[logTypeRaw.toUpperCase()] ?? 'CALL'
      const logDate = logDateRaw ?? today

      try {
        const log = await prisma.followUpLog.create({
          data: {
            customerId: customer.id,
            createdById: session.user.id,
            logDate,
            logType: logType as never,
            content,
            result: result || null,
            customerReaction: ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_RESPONSE'].includes(reaction.toUpperCase())
              ? reaction.toUpperCase()
              : null,
            nextFollowUpDate: nextDate,
            nextAction: nextAction || null,
            isFollowUp: true,
          },
        })

        // Upgrade customer devStatus (same logic as /api/customers/[id]/followup)
        let newStage = customer.devStatus ?? CustomerDevStatus.POTENTIAL
        if (logType === 'CALL' || logType === 'LINE' || logType === 'EMAIL') {
          newStage = upgradeStage(newStage, CustomerDevStatus.CONTACTED) as CustomerDevStatus
        }
        if (VISIT_TYPES.has(logType)) {
          newStage = upgradeStage(newStage, CustomerDevStatus.VISITED) as CustomerDevStatus
        }

        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            lastContactDate: log.logDate,
            nextFollowUpDate: nextDate ?? undefined,
            isFollowUp: true,
            devStatus: newStage,
          },
        })
        // Keep local map fresh so subsequent rows see the updated stage
        customer.devStatus = newStage

        results.created++
      } catch (e) {
        results.errors.push({ row: rowNumber, reason: (e as Error).message })
      }
    }

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'follow-up-logs',
      action: 'IMPORT',
      entityType: 'FollowUpLog',
      entityId: 'bulk',
      entityLabel: `${file.name} — 匯入 ${results.created} 筆，錯誤 ${results.errors.length} 筆`,
    }).catch(() => {})

    return NextResponse.json(results)
  } catch (error) {
    return handleApiError(error, 'follow-up-logs.import')
  }
}

/**
 * GET /api/follow-up-logs/import — 下載範本 Excel
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('聯繫紀錄匯入')
  sheet.columns = [
    { header: '客戶名稱或代碼', key: 'customer', width: 24 },
    { header: '日期 (YYYY-MM-DD)', key: 'date', width: 16 },
    { header: '類型 (電話/LINE/Email/拜訪/複訪)', key: 'logType', width: 24 },
    { header: '內容 (必填)', key: 'content', width: 40 },
    { header: '結果', key: 'result', width: 20 },
    { header: '下次追蹤日', key: 'nextDate', width: 16 },
    { header: '下次動作', key: 'nextAction', width: 24 },
    { header: '客戶反應 (POSITIVE/NEUTRAL/NEGATIVE)', key: 'reaction', width: 32 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' },
  }

  // Example row
  sheet.addRow({
    customer: '陽明護理之家',
    date: '2026-04-24',
    logType: '電話',
    content: '確認下月訂單量；對方要求報價 3 項',
    result: '已送報價單',
    nextDate: '2026-04-28',
    nextAction: '追蹤報價回覆',
    reaction: 'POSITIVE',
  })

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="follow-up-logs-template.xlsx"`,
    },
  })
}
