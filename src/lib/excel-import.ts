/**
 * excel-import.ts — 共用 Excel 匯入小工具
 *
 * 所有 /api/*-import 路由都用同一套 header 偵測 + cell 讀取，
 * 以便業務手邊 Excel 不管欄位順序都能匯入。
 */
import type ExcelJS from 'exceljs'

export type ColMap<K extends string> = Record<K, number | null>

/** Normalize string for fuzzy header matching (strip spaces/parens/emoji/caps). */
function normalize(s: string): string {
  return s.replace(/[\s（）()*\*・·:：、,，]/g, '').toLowerCase()
}

/**
 * Scan the first row and map each known field to a 1-based column index.
 * Aliases may be Chinese or English; first match wins per column.
 */
export function detectColumns<K extends string>(
  headerRow: ExcelJS.Row,
  aliases: Record<K, string[]>,
): ColMap<K> {
  const keys = Object.keys(aliases) as K[]
  const col = Object.fromEntries(keys.map(k => [k, null])) as ColMap<K>

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = cellStr(cell)
    const n = normalize(raw)
    if (!n) return
    for (const field of keys) {
      if (col[field] !== null) continue
      if (aliases[field].some(a => n.includes(normalize(a)))) {
        col[field] = colNumber
        break
      }
    }
  })

  return col
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cellStr(cell: any): string {
  const v = cell?.value
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text).trim()
  if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result).trim()
  if (typeof v === 'object' && 'richText' in v) {
    const parts = (v as { richText: Array<{ text: string }> }).richText
    return parts.map(p => p.text).join('').trim()
  }
  return String(v).trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cellDate(cell: any): Date | null {
  const v = cell?.value
  if (!v) return null
  if (v instanceof Date) return v
  const s = cellStr(cell)
  if (!s) return null
  // Accept YYYY-MM-DD, YYYY/MM/DD, ISO, Excel epoch numbers, etc.
  const d = new Date(s.replace(/\//g, '-'))
  return isNaN(d.getTime()) ? null : d
}

/** Read a specific column from a row, returning '' if column isn't mapped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readStr(row: any, col: number | null): string {
  if (!col) return ''
  return cellStr(row.getCell(col))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readDate(row: any, col: number | null): Date | null {
  if (!col) return null
  return cellDate(row.getCell(col))
}
