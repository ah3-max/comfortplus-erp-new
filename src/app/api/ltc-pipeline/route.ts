import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'
import { CustomerDevStatus } from '@prisma/client'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES']

// ── Column aliases ────────────────────────────────────────────────────────────
const HEADER_ALIASES: Record<string, string[]> = {
  name:                 ['機構名稱', '客戶名稱', '機構', '客戶', '名稱', 'name'],
  city:                 ['縣市', '城市', '地區'],
  district:             ['區域', '行政區'],
  address:              ['完整地址', '地址', 'address'],
  phone:                ['電話', '聯絡電話', 'phone'],
  fax:                  ['傳真', 'fax'],
  bedCount:             ['床數', '床位數', 'bed'],
  currentBrand:         ['使用品牌', '目前品牌', '競品品牌'],
  assignedSalesName:    ['業務', '負責業務', '業務員', '指派業務'],
  ltcStage:             ['銷售階段', '狀態', '階段', 'ltc階段', '漏斗'],
  carePopulation:       ['收案對象', '收案'],
  competitorShareholders: ['他牌股東', '競品股東'],
  notes:                ['備註', '說明', 'note'],
  quotationNotes:       ['報價備註'],
  billingNotes:         ['結帳備註', '結帳'],
  sampleProvided:       ['提供樣品', '樣品'],
  historyLog:           ['歷史紀錄', '歷史'],
  monthlyContactCount:  ['本月聯繫次數', '聯繫次數', '本月次數'],
  contactResultLatest:  ['最新聯繫結果', '昨日聯繫', '聯繫結果'],
  logDate:              ['日期', '聯繫日期', '聯繫日', '拜訪日', '拜訪日期'],
  logType:              ['類型', '聯繫方式', '聯繫類型', '方式', '類別'],
  logContent:           ['內容', '聯繫內容', '拜訪內容', '摘要', '紀錄', '記錄'],
  logResult:            ['結果', '聯繫結果', '拜訪結果'],
  nextFollowUp:         ['下次追蹤日', '下次追蹤', '下次拜訪', '下次聯繫日'],
  nextAction:           ['下次動作', '下次行動', '下一步'],
  reaction:             ['客戶反應', '反應', '態度'],
}

const LOG_TYPE_MAP: Record<string, string> = {
  '電話': 'CALL', '電訪': 'CALL', 'CALL': 'CALL',
  'LINE': 'LINE', 'line': 'LINE', 'Line': 'LINE',
  'EMAIL': 'EMAIL', 'email': 'EMAIL', 'Email': 'EMAIL',
  '拜訪': 'FIRST_VISIT', '初訪': 'FIRST_VISIT',
  '複訪': 'SECOND_VISIT', '二訪': 'SECOND_VISIT',
  '三訪': 'THIRD_VISIT', '其他': 'OTHER', 'OTHER': 'OTHER',
}

const STAGE_TO_DEVSTATUS: Record<string, CustomerDevStatus> = {
  '待追蹤': CustomerDevStatus.POTENTIAL, '待聯繫': CustomerDevStatus.POTENTIAL,
  '已聯繫': CustomerDevStatus.CONTACTED, '聯繫中': CustomerDevStatus.CONTACTED,
  '已拜訪': CustomerDevStatus.VISITED,   '初訪': CustomerDevStatus.VISITED,
  '已報價': CustomerDevStatus.NEGOTIATING,'報價中': CustomerDevStatus.NEGOTIATING,
  '談判中': CustomerDevStatus.NEGOTIATING,
  '已寄樣': CustomerDevStatus.TRIAL,     '試用中': CustomerDevStatus.TRIAL,
  '已成交': CustomerDevStatus.CLOSED,    '成交': CustomerDevStatus.CLOSED,
  '長期合作': CustomerDevStatus.STABLE_REPURCHASE,
  '已拒絕': CustomerDevStatus.REJECTED,  '拒絕': CustomerDevStatus.REJECTED,
  '休眠': CustomerDevStatus.DORMANT,
}

const STAGE_TO_TASK: Record<CustomerDevStatus, { taskType: string; title: string; priority: string }> = {
  [CustomerDevStatus.POTENTIAL]:         { taskType: 'FOLLOW_UP', title: '初次聯繫追蹤',  priority: 'MEDIUM' },
  [CustomerDevStatus.CONTACTED]:         { taskType: 'FOLLOW_UP', title: '持續聯繫追蹤',  priority: 'MEDIUM' },
  [CustomerDevStatus.VISITED]:           { taskType: 'FOLLOW_UP', title: '拜訪後追蹤',   priority: 'HIGH'   },
  [CustomerDevStatus.NEGOTIATING]:       { taskType: 'PROPOSAL',  title: '報價跟進',     priority: 'HIGH'   },
  [CustomerDevStatus.TRIAL]:             { taskType: 'FOLLOW_UP', title: '樣品試用追蹤',  priority: 'HIGH'   },
  [CustomerDevStatus.CLOSED]:            { taskType: 'ADMIN',     title: '成交後服務',   priority: 'LOW'    },
  [CustomerDevStatus.STABLE_REPURCHASE]: { taskType: 'ADMIN',     title: '定期維繫',     priority: 'LOW'    },
  [CustomerDevStatus.DORMANT]:           { taskType: 'FOLLOW_UP', title: '休眠客戶重啟',  priority: 'LOW'    },
  [CustomerDevStatus.CHURNED]:           { taskType: 'FOLLOW_UP', title: '流失客戶追回',  priority: 'LOW'    },
  [CustomerDevStatus.REJECTED]:          { taskType: 'FOLLOW_UP', title: '未來重新接洽',  priority: 'LOW'    },
  [CustomerDevStatus.OTHER]:             { taskType: 'OTHER',     title: '一般追蹤',     priority: 'LOW'    },
}

// ── Cell helpers ──────────────────────────────────────────────────────────────
function cellStr(cell: ExcelJS.Cell): string {
  const v = cell?.value
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object' && 'richText' in v)
    return (v as { richText: Array<{ text: string }> }).richText.map(r => r.text).join('').trim()
  if (typeof v === 'object' && 'text'   in v) return String((v as { text: string }).text).trim()
  if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result).trim()
  return String(v).trim()
}

const INVALID_INSTITUTION_PATTERNS = [
  /^(上午|下午|早上|中午|晚上|今天|昨天)/,
  /(展覽館|搬貨|倉庫路|支援.*展)/,
  /\/(護理師|居服員|社工|醫師|護士|照服員)/,
  /(先生|小姐|女士)$/,
]
function isValidInstitution(name: string): boolean {
  if (name.length < 3) return false
  return !INVALID_INSTITUTION_PATTERNS.some(p => p.test(name))
}

function cellDate(cell: ExcelJS.Cell): Date | null {
  const v = cell?.value
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const s = cellStr(cell)
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// ── AI content generation ─────────────────────────────────────────────────────
const LMSTUDIO_URL   = process.env.LMSTUDIO_URL   ?? 'http://192.168.0.157:1234/v1/chat/completions'
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL ?? 'google/gemma-4-31b'

async function aiGenContent(name: string, logType: string, result: string, nextDate: string): Promise<string> {
  const typeLabel: Record<string, string> = {
    CALL: '電話', LINE: 'LINE', EMAIL: 'Email', FIRST_VISIT: '初訪',
    SECOND_VISIT: '複訪', THIRD_VISIT: '三訪', OTHER: '聯繫',
  }
  const prompt = `你是業務助理，請依以下資訊用一句話（30 字內）描述業務聯繫過程，不要編造未提供的細節：
機構：${name}，類型：${typeLabel[logType] ?? '聯繫'}，結果：${result || '未記錄'}，下次追蹤：${nextDate || '未設定'}
只回覆一句話。`
  try {
    const res = await fetch(LMSTUDIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: LMSTUDIO_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 80 }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return (data.choices?.[0]?.message?.content ?? '').trim().replace(/^["「]|["」]$/g, '').trim()
  } catch {
    return `${typeLabel[logType] ?? ''}聯繫${name}，結果：${result || '未記錄'}。`
  }
}

// ── Main route ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const startMs = Date.now()
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳 Excel 檔' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(Buffer.from(new Uint8Array(bytes)) as any)
    const ws = wb.worksheets[0]
    if (!ws) return NextResponse.json({ error: 'Excel 沒有工作表' }, { status: 400 })

    // ── Detect header columns ────────────────────────────────────────���────────
    const normalize = (s: string) => s.replace(/[\s（）()\*]/g, '').toLowerCase()
    const col: Record<string, number | null> = Object.fromEntries(Object.keys(HEADER_ALIASES).map(k => [k, null]))
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const n = normalize(cellStr(cell))
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (col[field] !== null) continue
        if (aliases.some(a => n.includes(normalize(a)))) { col[field] = colNumber; break }
      }
    })
    if (!col.name) return NextResponse.json({ error: '找不到「機構名稱」欄，請確認 Excel 表頭' }, { status: 400 })

    const get = (row: ExcelJS.Row, field: string) => col[field] ? cellStr(row.getCell(col[field]!)) : ''
    const getDate = (row: ExcelJS.Row, field: string) => col[field] ? cellDate(row.getCell(col[field]!)) : null

    // ── Collect rows ──────────────────────────────────────────────────────────
    const allRows: ExcelJS.Row[] = []
    ws.eachRow((row, n) => { if (n > 1) allRows.push(row) })

    // ── Load lookup tables ────────────────────────────────────────────────────
    const existingCustomers = await prisma.customer.findMany({
      select: { id: true, name: true, code: true, devStatus: true, nextFollowUpDate: true,
                bedCount: true, assignedSalesName: true, currentBrand: true, lastContactDate: true },
    })
    const byName = new Map(existingCustomers.map(c => [c.name.trim(), c]))
    const byCode = new Map(existingCustomers.map(c => [c.code.trim().toUpperCase(), c]))

    const allUsers = await prisma.user.findMany({
      where: { role: { in: ['SALES', 'SALES_MANAGER', 'SUPER_ADMIN'] } },
      select: { id: true, name: true, role: true },
    })
    const userByName = new Map(allUsers.map(u => [u.name.trim(), u]))
    const defaultUser = allUsers.find(u => u.role === 'SUPER_ADMIN') ?? allUsers[0]

    const result = {
      summary: { totalRows: allRows.length, uniqueCustomers: 0, processingTimeMs: 0 },
      customers: { created: 0, updated: 0, notFound: [] as string[] },
      logs: { created: 0, aiGenerated: 0, skipped: 0, errors: [] as { row: number; reason: string }[] },
      tasks: { created: 0, skipped: 0 },
      stats: { competitors: {} as Record<string, number>, salesAssignment: {} as Record<string, number>,
               ltcStages: {} as Record<string, number>, totalBeds: 0, monthlyContactsUpdated: 0 },
      anomalies: [] as { name: string; issues: string[] }[],
    }

    // ── Stage 1: Upsert customers ─────────────────────────────────────────────
    const customerMaster = new Map<string, Record<string, unknown>>()
    for (const row of allRows) {
      const name = get(row, 'name')
      if (!name) continue
      const prev = customerMaster.get(name) ?? {}
      const patch: Record<string, unknown> = { ...prev }
      const strFields = ['city','district','address','phone','fax','currentBrand','assignedSalesName',
        'ltcStage','carePopulation','competitorShareholders','notes','quotationNotes','billingNotes',
        'sampleProvided','historyLog','contactResultLatest']
      for (const f of strFields) { const v = get(row, f); if (v) patch[f] = v }
      const bed = get(row, 'bedCount'); if (bed) { const n = parseInt(bed); if (!isNaN(n)) patch.bedCount = n }
      const mo  = get(row, 'monthlyContactCount'); if (mo) { const n = parseInt(mo); if (!isNaN(n)) patch.monthlyContactCount = n }
      customerMaster.set(name, patch)
    }

    result.summary.uniqueCustomers = customerMaster.size
    let codeSeq = (await prisma.customer.findFirst({ where: { code: { startsWith: 'C' } }, orderBy: { code: 'desc' }, select: { code: true } }))?.code
      ? parseInt((await prisma.customer.findFirst({ where: { code: { startsWith: 'C' } }, orderBy: { code: 'desc' }, select: { code: true } }))!.code.replace(/\D/g, ''), 10) : 0

    for (const [name, master] of customerMaster) {
      const cust = byName.get(name) ?? byCode.get(name.toUpperCase())
      const ltcStage = master.ltcStage as string | undefined
      const devStatus = ltcStage ? (STAGE_TO_DEVSTATUS[ltcStage] ?? undefined) : undefined
      const salesUser = master.assignedSalesName ? userByName.get(String(master.assignedSalesName)) : undefined

      const payload: Record<string, unknown> = { ...master }
      if (devStatus) payload.devStatus = devStatus
      if (salesUser) payload.salesRepId = salesUser.id

      if (cust) {
        await prisma.customer.update({ where: { id: cust.id }, data: payload })
        byName.set(name, { ...cust, ...payload } as typeof cust)
        result.customers.updated++
      } else if (!isValidInstitution(name)) {
        result.customers.notFound.push(name)
      } else {
        codeSeq++
        const code = `C${String(codeSeq).padStart(4, '0')}`
        const newCust = await prisma.customer.create({
          data: { code, name, type: 'NURSING_HOME', devStatus: devStatus ?? CustomerDevStatus.POTENTIAL, isActive: true, ...payload },
          select: { id: true, name: true, code: true, devStatus: true, nextFollowUpDate: true,
                    bedCount: true, assignedSalesName: true, currentBrand: true, lastContactDate: true },
        })
        byName.set(name, newCust)
        byCode.set(code.toUpperCase(), newCust)
        result.customers.created++
      }
    }

    // ── Stage 2: FollowUpLogs ─────────────────────────────────────────────────
    if (col.logDate || col.logType || col.logContent) {
      const today = new Date()
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i]
        const rowNumber = i + 2
        const name = get(row, 'name')
        if (!name) { result.logs.skipped++; continue }
        const cust = byName.get(name)
        if (!cust) { result.logs.errors.push({ row: rowNumber, reason: `找不到客戶「${name}」` }); continue }

        const rawType    = get(row, 'logType')
        const logType    = LOG_TYPE_MAP[rawType] ?? LOG_TYPE_MAP[rawType?.toUpperCase()] ?? 'CALL'
        const logDate    = getDate(row, 'logDate') ?? today
        const logResult  = get(row, 'logResult')
        const nextDate   = getDate(row, 'nextFollowUp')
        const nextAction = get(row, 'nextAction')

        let content = get(row, 'logContent')
        if (!content) {
          content = `[AI 自動補] ${await aiGenContent(name, logType, logResult, nextDate?.toISOString().slice(0, 10) ?? '')}`
          result.logs.aiGenerated++
        }

        try {
          await prisma.followUpLog.create({
            data: {
              customerId: cust.id, createdById: session.user.id,
              logDate, logType: logType as never, content,
              result: logResult || null,
              nextFollowUpDate: nextDate, nextAction: nextAction || null, isFollowUp: true,
            },
          })
          await prisma.customer.update({
            where: { id: cust.id },
            data: { lastContactDate: logDate, nextFollowUpDate: nextDate ?? undefined, isFollowUp: true },
          })
          result.logs.created++
        } catch (e) {
          result.logs.errors.push({ row: rowNumber, reason: (e as Error).message })
        }
      }
    }

    // ── Stage 3: SalesTasks ───────────────────────────────────────────────────
    const processedCustomerIds = new Set<string>()
    for (const [name] of customerMaster) {
      const cust = byName.get(name)
      if (!cust || processedCustomerIds.has(cust.id)) continue
      processedCustomerIds.add(cust.id)

      const devStatus = (cust as { devStatus?: CustomerDevStatus }).devStatus
      if (!devStatus) continue
      const taskDef = STAGE_TO_TASK[devStatus]
      if (!taskDef) continue

      const existing = await prisma.salesTask.findFirst({
        where: { customerId: cust.id, status: 'PENDING', taskType: taskDef.taskType as never },
      })
      if (existing) { result.tasks.skipped++; continue }

      const master = customerMaster.get(name)
      const salesUser = master?.assignedSalesName ? userByName.get(String(master.assignedSalesName)) : null
      const assignedToId = salesUser?.id ?? defaultUser?.id
      if (!assignedToId) { result.tasks.skipped++; continue }

      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7)
      await prisma.salesTask.create({
        data: {
          title: `${name} — ${taskDef.title}`,
          taskType: taskDef.taskType as never,
          priority:  taskDef.priority as never,
          status: 'PENDING',
          customerId: cust.id,
          assignedToId,
          createdById: session.user.id,
          dueDate,
        },
      })
      result.tasks.created++
    }

    // ── Stage 4-7: Stats, monthly count, anomalies ────────────────────────────
    const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0)
    const today30 = new Date(); today30.setDate(today30.getDate() - 30)
    const today = new Date()

    for (const [name] of customerMaster) {
      const cust = byName.get(name)
      if (!cust) continue

      // Monthly contact count
      const monthCount = await prisma.followUpLog.count({
        where: { customerId: cust.id, logDate: { gte: thisMonthStart } },
      })
      await prisma.customer.update({ where: { id: cust.id }, data: { monthlyContactCount: monthCount } })
      result.stats.monthlyContactsUpdated++

      // Stats
      const brand = (cust as { currentBrand?: string }).currentBrand ?? customerMaster.get(name)?.currentBrand as string
      if (brand) result.stats.competitors[brand] = (result.stats.competitors[brand] ?? 0) + 1
      const sales = (cust as { assignedSalesName?: string }).assignedSalesName ?? customerMaster.get(name)?.assignedSalesName as string
      if (sales) result.stats.salesAssignment[sales] = (result.stats.salesAssignment[sales] ?? 0) + 1
      const stage = customerMaster.get(name)?.ltcStage as string
      if (stage) result.stats.ltcStages[stage] = (result.stats.ltcStages[stage] ?? 0) + 1
      const beds = (cust as { bedCount?: number }).bedCount ?? customerMaster.get(name)?.bedCount as number
      if (beds) result.stats.totalBeds += beds

      // Anomalies
      const issues: string[] = []
      if (!beds) issues.push('缺床數')
      if (!((cust as { assignedSalesName?: string }).assignedSalesName ?? customerMaster.get(name)?.assignedSalesName)) issues.push('缺負責業務')
      if (!brand) issues.push('缺競品資訊')
      const nextDate = (cust as { nextFollowUpDate?: Date | null }).nextFollowUpDate
      if (nextDate && nextDate < today) issues.push('追蹤已逾期')
      const lastContact = (cust as { lastContactDate?: Date | null }).lastContactDate
      const devStatus = (cust as { devStatus?: CustomerDevStatus }).devStatus
      if (devStatus && ['POTENTIAL','CONTACTED','VISITED','NEGOTIATING','TRIAL'].includes(devStatus)) {
        if (!lastContact || lastContact < today30) issues.push('超過 30 天未聯繫')
      }
      if (issues.length > 0) result.anomalies.push({ name, issues })
    }

    result.summary.processingTimeMs = Date.now() - startMs
    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, 'ltc-pipeline')
  }
}
