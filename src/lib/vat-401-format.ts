/**
 * Taiwan 401 VAT Filing media file format utilities.
 *
 * Spec: 財政部營業稅進銷項憑證明細資料媒體檔案格式
 * - 每筆紀錄固定 81 字元
 * - 行尾 CRLF
 *
 * 格式代號:
 *   銷項 31(三聯式) 32(二聯式/收銀機) 33(退回折讓三聯) 34(退回折讓二聯) 35(免用統一發票)
 *   進項 21(三聯式) 22(二聯式/收銀機/載有稅額憑證) 23(退出折讓三聯) 24(退出折讓二聯)
 *        25(海關代徵) 26(固定資產退稅) 28(海關退還)
 */

export type OutputFormatCode = '31' | '32' | '33' | '34' | '35'
export type InputFormatCode = '21' | '22' | '23' | '24' | '25' | '26' | '28'

const RECORD_LENGTH = 81

/** Convert AD year to ROC year (e.g., 2026 → 115) */
export function toRocYear(date: Date): number {
  return date.getFullYear() - 1911
}

/** Format date as YYYMMDD (ROC, 7 chars, no separator) */
export function formatRocDate(date: Date): string {
  const y = String(toRocYear(date)).padStart(3, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/** Format period as YYYMM (ROC, 5 chars) */
export function formatRocPeriod(year: number, month: number): string {
  const rocYear = year - 1911
  return `${String(rocYear).padStart(3, '0')}${String(month).padStart(2, '0')}`
}

/** Right-align number, zero-padded to `len` chars */
export function padLeft(value: number, len: number): string {
  return String(Math.round(Math.abs(value))).padStart(len, '0').slice(-len)
}

/** Left-align string, space-padded to `len` chars */
export function padRight(str: string, len: number): string {
  return str.padEnd(len, ' ').slice(0, len)
}

/**
 * 銷項明細 — 81 chars
 *
 *  1-2   格式代號 (31/32/33/34/35)
 *  3-10  賣方統一編號 (8)
 * 11-18  買方統一編號 (8)
 * 19-28  發票號碼 (10)
 * 29-35  發票日期 YYYMMDD (7)
 * 36-47  銷售額 (12)
 * 48-57  稅額 (10)
 * 58     營業稅稅率類別 (1=應稅5% 2=零稅率 3=免稅 9=其他)
 * 59     扣抵代號 (空白)
 * 60-81  保留 (22 spaces)
 */
export function buildOutputLine(params: {
  formatCode?: OutputFormatCode
  sellerTaxId: string
  buyerTaxId: string
  invoiceNo: string
  invoiceDate: Date
  salesAmount: number
  taxAmount: number
  taxType?: '1' | '2' | '3' | '9'
}): string {
  const {
    formatCode = '31',
    sellerTaxId, buyerTaxId, invoiceNo, invoiceDate,
    salesAmount, taxAmount, taxType = '1',
  } = params

  const core = [
    formatCode,
    padRight(sellerTaxId, 8),
    padRight(buyerTaxId || '00000000', 8),
    padRight(invoiceNo, 10),
    formatRocDate(invoiceDate),
    padLeft(salesAmount, 12),
    padLeft(taxAmount, 10),
    taxType,
    ' ',
  ].join('')

  return core.padEnd(RECORD_LENGTH, ' ')
}

/**
 * 進項明細 — 81 chars
 *
 *  1-2   格式代號 (21/22/23/24/25/26/28)
 *  3-10  買方統一編號 (8, 本公司)
 * 11-18  賣方統一編號 (8, 供應商)
 * 19-28  發票號碼 (10)
 * 29-35  發票日期 YYYMMDD (7)
 * 36-47  進貨額 (12)
 * 48-57  稅額 (10)
 * 58     扣抵代號 (1=可扣抵 2=不可扣 3=不可扣+其他)
 * 59     營業稅稅率類別 (空白)
 * 60-81  保留 (22 spaces)
 */
export function buildInputLine(params: {
  formatCode?: InputFormatCode
  buyerTaxId: string
  sellerTaxId: string
  invoiceNo: string
  invoiceDate: Date
  purchaseAmount: number
  taxAmount: number
  deductionCode?: '1' | '2' | '3'
}): string {
  const {
    formatCode = '21',
    buyerTaxId, sellerTaxId, invoiceNo, invoiceDate,
    purchaseAmount, taxAmount, deductionCode = '1',
  } = params

  const core = [
    formatCode,
    padRight(buyerTaxId, 8),
    padRight(sellerTaxId || '00000000', 8),
    padRight(invoiceNo, 10),
    formatRocDate(invoiceDate),
    padLeft(purchaseAmount, 12),
    padLeft(taxAmount, 10),
    deductionCode,
    ' ',
  ].join('')

  return core.padEnd(RECORD_LENGTH, ' ')
}

/** Map EInvoice.invoiceType → 銷項格式代號 */
export function resolveOutputFormatCode(
  invoiceType: string,
  buyerTaxId: string | null,
): OutputFormatCode {
  if (invoiceType === 'B2B' || (buyerTaxId && buyerTaxId !== '00000000')) return '31'
  return '32'
}

/** Map InputTaxItem.sourceType → 進項格式代號 */
export function resolveInputFormatCode(sourceType: string): InputFormatCode {
  switch (sourceType) {
    case 'CUSTOMS': return '25'
    case 'DOMESTIC_INVOICE': return '21'
    case 'RECEIPT': return '22'
    default: return '21'
  }
}

/** Map InputTaxItem.sourceType → 扣抵代號 */
export function resolveDeductionCode(sourceType: string): '1' | '2' | '3' {
  switch (sourceType) {
    case 'CUSTOMS': return '1'
    case 'DOMESTIC_INVOICE': return '1'
    case 'RECEIPT': return '3'
    default: return '1'
  }
}

export interface VatExportWarning {
  line: number
  field: string
  message: string
}

/** Validate a batch of output/input records, return warnings */
export function validateExportData(
  outputInvoices: Array<{ invoiceNumber: string; buyerTaxId: string | null; invoiceType: string }>,
  inputItems: Array<{ invoiceNo: string; vendorTaxId: string | null; sourceType: string }>,
): VatExportWarning[] {
  const warnings: VatExportWarning[] = []
  let line = 0

  for (const inv of outputInvoices) {
    line++
    if (inv.invoiceType === 'B2B' && (!inv.buyerTaxId || inv.buyerTaxId === '00000000')) {
      warnings.push({ line, field: 'buyerTaxId', message: `銷項 ${inv.invoiceNumber} 為 B2B 但缺少買方統編` })
    }
  }

  for (const item of inputItems) {
    line++
    if (item.sourceType === 'DOMESTIC_INVOICE' && (!item.vendorTaxId || item.vendorTaxId === '00000000')) {
      warnings.push({ line, field: 'vendorTaxId', message: `進項 ${item.invoiceNo} 為國內發票但缺少賣方統編` })
    }
  }

  return warnings
}
