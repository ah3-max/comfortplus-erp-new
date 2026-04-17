/**
 * Taiwan 401 VAT Filing TXT format utilities.
 *
 * Spec: 財政部營業稅申報媒體檔案格式（固定寬度文字檔）
 * - Record Type 2: 銷項明細 (58 chars per line)
 * - Record Type 3: 進項明細 (58 chars per line)
 * - Record Type 1: 彙總表頭 (80 chars, last line)
 */

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
 * Record Type 2: 銷項明細 (output/sales invoice line)
 * Total: 58 chars
 */
export function buildOutputLine(params: {
  sellerTaxId: string
  buyerTaxId: string
  invoiceNo: string
  invoiceDate: Date
  salesAmount: number
  taxAmount: number
  taxType?: '1' | '2' | '3' | '9'
}): string {
  const {
    sellerTaxId, buyerTaxId, invoiceNo, invoiceDate,
    salesAmount, taxAmount, taxType = '1',
  } = params

  return [
    '2',                                   // 1:  RecordType
    padRight(sellerTaxId, 8),              // 2-9:  SellerTaxId
    padRight(buyerTaxId || '00000000', 8), // 10-17: BuyerTaxId
    padRight(invoiceNo, 10),               // 18-27: InvoiceNo
    formatRocDate(invoiceDate),            // 28-34: InvoiceDate (YYYMMDD)
    padLeft(salesAmount, 12),              // 35-46: SalesAmount
    padLeft(taxAmount, 10),                // 47-56: TaxAmount
    taxType,                               // 57:   TaxType
    ' ',                                   // 58:   DeductionCode (blank for output)
  ].join('')
}

/**
 * Record Type 3: 進項明細 (input/purchase invoice line)
 * Total: 58 chars
 */
export function buildInputLine(params: {
  buyerTaxId: string
  sellerTaxId: string
  invoiceNo: string
  invoiceDate: Date
  purchaseAmount: number
  taxAmount: number
  deductionCode?: '1' | '2' | '3'
}): string {
  const {
    buyerTaxId, sellerTaxId, invoiceNo, invoiceDate,
    purchaseAmount, taxAmount, deductionCode = '1',
  } = params

  return [
    '3',                                   // 1:  RecordType
    padRight(buyerTaxId, 8),               // 2-9:  BuyerTaxId
    padRight(sellerTaxId || '00000000', 8),// 10-17: SellerTaxId
    padRight(invoiceNo, 10),               // 18-27: InvoiceNo
    formatRocDate(invoiceDate),            // 28-34: InvoiceDate (YYYMMDD)
    padLeft(purchaseAmount, 12),           // 35-46: PurchaseAmount
    padLeft(taxAmount, 10),                // 47-56: TaxAmount
    deductionCode,                         // 57:   DeductionCode
    ' ',                                   // 58:   TaxType (blank for input)
  ].join('')
}

/**
 * Record Type 1: 彙總表頭 (summary, last line of file)
 * Total: 80 chars
 */
export function buildSummaryLine(params: {
  taxId: string
  periodCode: string   // YYYMM format (ROC)
  outputCount: number
  outputAmount: number
  outputTax: number
  inputCount: number
  inputAmount: number
  inputTax: number
  netTax: number
}): string {
  const {
    taxId, periodCode,
    outputCount, outputAmount, outputTax,
    inputCount, inputAmount, inputTax,
    netTax,
  } = params

  return [
    '1',                              // 1:     RecordType
    padRight(taxId, 8),               // 2-9:   TaxId
    padRight(periodCode, 5),          // 10-14: PeriodCode (YYYMM)
    padLeft(outputCount, 6),          // 15-20: OutputCount
    padLeft(outputAmount, 12),        // 21-32: OutputAmount
    padLeft(outputTax, 10),           // 33-42: OutputTax
    padLeft(inputCount, 6),           // 43-48: InputCount
    padLeft(inputAmount, 12),         // 49-60: InputAmount
    padLeft(inputTax, 10),            // 61-70: InputTax
    padLeft(netTax, 10),              // 71-80: NetTax
  ].join('')
}
