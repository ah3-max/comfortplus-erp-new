/**
 * scripts/ai-fill-empty-content.ts
 *
 * 讀 Excel，找「內容」欄空白的 row，用 LM Studio 自動生成一句話，
 * dry-run 模式只印結果，不寫 DB。
 *
 * 用法：
 *   DATABASE_URL="..." npx tsx scripts/ai-fill-empty-content.ts <file.xlsx> [--dry-run]
 */

import { prisma } from '../src/lib/prisma'
import ExcelJS from 'exceljs'

const FILE    = process.argv[2]
const DRY_RUN = process.argv.includes('--dry-run')

if (!FILE) {
  console.error('用法: npx tsx scripts/ai-fill-empty-content.ts <file.xlsx> [--dry-run]')
  process.exit(1)
}

// ── Follow-up log import column aliases (same as API) ───────────────────────
const FIELD_ALIASES: Record<string, string[]> = {
  customer:   ['客戶', '客戶名稱', '機構', '機構名稱', '客戶代碼', '機構代碼', '名稱', 'customer', 'name'],
  date:       ['日期', '聯繫日', '聯繫日期', '拜訪日', '拜訪日期', '聯絡日期', 'date'],
  logType:    ['類型', '聯繫類型', '聯繫方式', '方式', '類別', 'type', 'logtype'],
  content:    ['內容', '聯繫內容', '拜訪內容', '摘要', '紀錄', '記錄', '說明', 'content', 'note'],
  result:     ['結果', '聯繫結果', '拜訪結果', 'result'],
  nextDate:   ['下次追蹤日', '下次追蹤', '下次拜訪', '下次聯繫日', '下次日期', 'nextdate'],
}

const LOG_TYPE_LABEL: Record<string, string> = {
  CALL: '電話聯繫', LINE: 'LINE 聯繫', EMAIL: 'Email 聯繫', MEETING: '會議',
  FIRST_VISIT: '初次拜訪', SECOND_VISIT: '二次拜訪', THIRD_VISIT: '三次拜訪',
  DELIVERY: '送貨', EXPO: '展覽', OTHER: '聯繫',
}

const LOG_TYPE_MAP: Record<string, string> = {
  '電話': 'CALL', '電訪': 'CALL', 'CALL': 'CALL',
  'LINE': 'LINE', 'Line': 'LINE', 'line': 'LINE',
  'EMAIL': 'EMAIL', 'Email': 'EMAIL', 'email': 'EMAIL',
  '拜訪': 'FIRST_VISIT', '初訪': 'FIRST_VISIT', 'FIRST_VISIT': 'FIRST_VISIT',
  '複訪': 'SECOND_VISIT', '二訪': 'SECOND_VISIT', 'SECOND_VISIT': 'SECOND_VISIT',
  '三訪': 'THIRD_VISIT', 'THIRD_VISIT': 'THIRD_VISIT',
  '其他': 'OTHER', 'OTHER': 'OTHER',
}

// ── LM Studio call ───────────────────────────────────────────────────────────
const LMSTUDIO_URL   = process.env.LMSTUDIO_URL   ?? 'http://192.168.0.157:1234/v1/chat/completions'
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL ?? 'google/gemma-4-31b'

async function aiGenContent(name: string, date: string, logType: string, result: string, nextDate: string): Promise<string> {
  const typeLabel = LOG_TYPE_LABEL[logType] ?? '聯繫'
  const prompt = `你是業務助理，請依以下資訊用一句話（30 字內）描述業務聯繫過程，不要編造未提供的細節：
機構：${name}
日期：${date}
類型：${typeLabel}
結果：${result || '（未記錄）'}
下次追蹤日：${nextDate || '（未設定）'}

只回覆一句話，不加標點符號以外的格式。`

  const res = await fetch(LMSTUDIO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LMSTUDIO_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 80,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`LM Studio error (${res.status}): ${txt.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  return content.trim().replace(/^["「『]|["」』]$/g, '').trim()
}

// ── Cell helpers ─────────────────────────────────────────────────────────────
function cellStr(cell: ExcelJS.Cell): string {
  const v = cell?.value
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text).trim()
  if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result).trim()
  return String(v).trim()
}

function cellDate(cell: ExcelJS.Cell): string {
  const v = cell?.value
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = cellStr(cell)
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📂 讀取 ${FILE}`)
  if (DRY_RUN) console.log('🔍 DRY-RUN 模式 — 不會寫入 DB\n')

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(FILE)
  const ws = wb.worksheets[0]

  // Detect header columns
  const normalize = (s: string) => s.replace(/[\s（）()*]/g, '').toLowerCase()
  const col: Record<string, number | null> = {
    customer: null, date: null, logType: null, content: null, result: null, nextDate: null,
  }
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const n = normalize(cellStr(cell))
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (col[field] !== null) continue
      if (aliases.some(a => n.includes(normalize(a)))) { col[field] = colNumber; break }
    }
  })
  console.log('欄位對應:', JSON.stringify(col))

  if (!col.customer) { console.error('❌ 找不到「客戶」欄，請確認 Excel 表頭'); process.exit(1) }
  if (!col.content)  { console.error('❌ 找不到「內容」欄，請確認 Excel 表頭'); process.exit(1) }

  // Collect rows with empty content
  const emptyRows: Array<{
    rowNumber: number
    name: string
    date: string
    logType: string
    result: string
    nextDate: string
  }> = []

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const name    = col.customer ? cellStr(row.getCell(col.customer)) : ''
    const content = col.content  ? cellStr(row.getCell(col.content))  : ''
    if (!name) return                    // skip blank rows
    if (content) return                  // content already filled — skip
    emptyRows.push({
      rowNumber,
      name,
      date:     col.date    ? cellDate(row.getCell(col.date!))    : '',
      logType:  col.logType ? cellStr(row.getCell(col.logType!))  : '',
      result:   col.result  ? cellStr(row.getCell(col.result!))   : '',
      nextDate: col.nextDate? cellDate(row.getCell(col.nextDate!)) : '',
    })
  })

  console.log(`\n找到 ${emptyRows.length} 筆內容空白的 row\n`)
  if (emptyRows.length === 0) { console.log('✅ 沒有需要補的 row'); await prisma.$disconnect(); return }

  // Load customer lookup
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, code: true },
  })
  const byName = new Map(customers.map(c => [c.name.trim(), c]))

  // Process each empty row
  const results: Array<{ rowNumber: number; name: string; aiContent: string; custFound: boolean }> = []

  for (const r of emptyRows) {
    console.log(`── Row ${r.rowNumber}: ${r.name} / 類型:${r.logType || '—'} / 結果:${r.result || '—'}`)

    let aiContent = ''
    try {
      const logType = LOG_TYPE_MAP[r.logType] ?? LOG_TYPE_MAP[r.logType?.toUpperCase()] ?? 'CALL'
      aiContent = await aiGenContent(r.name, r.date, logType, r.result, r.nextDate)
      console.log(`   AI → 「${aiContent}」`)
    } catch (e) {
      console.error(`   ⚠️  AI 失敗: ${(e as Error).message}`)
      aiContent = `${r.logType || '聯繫'}了 ${r.name}，結果：${r.result || '未記錄'}。`
      console.log(`   fallback → 「${aiContent}」`)
    }

    const cust = byName.get(r.name.trim())
    if (!cust) {
      console.log(`   ⚠️  找不到客戶「${r.name}」，跳過`)
    }
    results.push({ rowNumber: r.rowNumber, name: r.name, aiContent: `[AI 自動補] ${aiContent}`, custFound: !!cust })
  }

  console.log('\n══════════════════════════════')
  console.log(`DRY-RUN 結果 (${results.length} 筆):`)
  results.forEach(r =>
    console.log(`  Row ${r.rowNumber} ${r.custFound ? '✅' : '❌ 找不到客戶'} ${r.name}:\n    ${r.aiContent}`)
  )

  if (DRY_RUN) {
    console.log('\n✋ DRY-RUN 模式，未寫入 DB。確認內容 OK 後移除 --dry-run 旗標重跑。')
    await prisma.$disconnect()
    return
  }

  // Write to DB
  console.log('\n📝 寫入 DB...')
  const today = new Date()
  let written = 0
  for (const r of results) {
    if (!r.custFound) continue
    const cust = byName.get(r.name.trim())!
    const emptyRow = emptyRows.find(e => e.rowNumber === r.rowNumber)!
    const logType = LOG_TYPE_MAP[emptyRow.logType] ?? 'CALL'
    const logDate = emptyRow.date ? new Date(emptyRow.date) : today
    await prisma.followUpLog.create({
      data: {
        customerId:   cust.id,
        createdById:  (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } }))!.id,
        logDate,
        logType:      logType as never,
        content:      r.aiContent,
        result:       emptyRow.result || null,
        nextFollowUpDate: emptyRow.nextDate ? new Date(emptyRow.nextDate) : null,
        isFollowUp:   true,
      },
    })
    written++
    console.log(`  ✅ Row ${r.rowNumber}: ${r.name} 已寫入`)
  }
  console.log(`\n完成，共寫入 ${written} 筆。`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
