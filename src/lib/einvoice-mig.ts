/**
 * Taiwan MIG V4.1 E-Invoice XML Generation
 *
 * 財政部電子發票整合服務平台 — 媒體交換訊息實作指引 (MIG) V4.1
 *
 * 訊息類型：
 *   F0401 — B2S 發票開立存證
 *   F0501 — B2S 發票作廢存證
 *   F0701 — B2S 發票註銷存證 (v4.1 新增)
 *   G0401 — B2S 折讓開立存證
 *   G0501 — B2S 折讓作廢存證
 *
 * XML 規格遵循 urn:GEINV:eInvoiceMessage:{type}:4.0 schema
 */

// ── Types ──────────────────────────────────────────────

export type MigMessageType = 'F0401' | 'F0501' | 'F0701' | 'G0401' | 'G0501'

/** InvoiceType 發票類別 (01–08) */
export type InvoiceTypeCode = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08'

/** TaxType 課稅別 (per item in v4.1) */
export type TaxTypeCode = '1' | '2' | '3' | '4' | '9'

/** TaxRate 稅率 (枚舉值) */
export type TaxRateValue = '0' | '0.01' | '0.02' | '0.05' | '0.15' | '0.25'

// ── F0401 Invoice ──────────────────────────────────────

export interface F0401Main {
  invoiceNumber: string       // 發票號碼 (10碼: 2英文+8數字)
  invoiceDate: Date           // 發票日期
  seller: {
    identifier: string        // 賣方統編 (8碼)
    name: string              // 賣方名稱
    address?: string
    emailAddress?: string     // max 400
  }
  buyer: {
    identifier: string        // 買方統編 (8碼, B2C=00000000)
    name: string
    address?: string
    emailAddress?: string     // max 400
  }
  invoiceType: InvoiceTypeCode
  donateMark: '0' | '1'      // 0=非捐贈 1=捐贈
  carrierType?: string        // 載具類別
  carrierId1?: string         // 載具顯碼 ID
  carrierId2?: string         // 載具隱碼 ID
  printMark: 'Y' | 'N'       // 是否列印
  npoban?: string             // 愛心碼
  relateNumber?: string       // 相關號碼 (max 50)
  buyerRemark?: '1' | '2' | '3' | '4' // 1=非會員 2=會員 3=非會員二聯 4=其他
}

export interface F0401DetailItem {
  description: string         // 品名 (max 500)
  quantity: number
  unit?: string               // 單位
  unitPrice: number
  amount: number              // 金額 (= quantity * unitPrice)
  sequenceNumber: string      // 序號 (max 4碼)
  taxType: TaxTypeCode        // v4.1 新增：逐項課稅別
  remark?: string             // 備註 (max 100)
  relateNumber?: string       // 相關號碼 (max 50)
}

export interface F0401Amount {
  salesAmount: number         // 應稅銷售額
  freeTaxSalesAmount: number  // 免稅銷售額
  zeroTaxSalesAmount: number  // 零稅率銷售額
  taxType: TaxTypeCode        // 整張稅別 (1=應稅5%)
  taxRate: TaxRateValue       // 稅率
  taxAmount: number           // 稅額
  totalAmount: number         // 含稅總額
  discountAmount?: number     // 折扣金額
  originalCurrencyAmount?: number
  exchangeRate?: number       // 匯率
}

export interface F0401Data {
  main: F0401Main
  details: F0401DetailItem[]
  amount: F0401Amount
}

// ── F0501 Void ─────────────────────────────────────────

export interface F0501Data {
  cancelInvoiceNumber: string  // 作廢發票號碼
  invoiceDate: Date            // 原發票日期
  buyerIdentifier: string      // 買方統編
  sellerIdentifier: string     // 賣方統編
  cancelDate: Date             // 作廢日期
  cancelTime: Date             // 作廢時間
  cancelReason: string         // 作廢原因
}

// ── F0701 Cancel (v4.1) ────────────────────────────────

export interface F0701Data {
  cancelInvoiceNumber: string
  invoiceDate: Date
  buyerIdentifier: string
  sellerIdentifier: string
  cancelDate: Date
  cancelTime: Date
  cancelReason: string
}

// ── G0401 Allowance ────────────────────────────────────

export interface G0401ProductItem {
  originalInvoiceDate: Date
  originalInvoiceNumber: string
  originalSequenceNumber: string // 原明細序號
  originalDescription: string    // 原品名
  quantity: number
  unitPrice: number
  amount: number
  tax: number
  allowanceSequenceNumber: string
  taxType: TaxTypeCode
}

export interface G0401Data {
  allowanceNumber: string        // 折讓證明單號碼
  allowanceDate: Date
  seller: {
    identifier: string
    name: string
  }
  buyer: {
    identifier: string
    name: string
  }
  allowanceType: '1' | '2'      // 1=買方開立 2=賣方開立
  details: G0401ProductItem[]
  taxAmount: number
  totalAmount: number
}

// ── G0501 Allowance Void ───────────────────────────────

export interface G0501Data {
  cancelAllowanceNumber: string
  allowanceDate: Date
  buyerIdentifier: string
  sellerIdentifier: string
  cancelDate: Date
  cancelTime: Date
  cancelReason: string
}

// ── Validation ─────────────────────────────────────────

export interface MigValidationError {
  field: string
  message: string
}

const TAX_ID_RE = /^\d{8}$/
const INVOICE_NO_RE = /^[A-Z]{2}\d{8}$/

function validateTaxId(value: string, field: string): MigValidationError[] {
  if (!TAX_ID_RE.test(value)) {
    return [{ field, message: `統一編號格式錯誤（需8位數字）：${value}` }]
  }
  return []
}

function validateInvoiceNumber(value: string): MigValidationError[] {
  if (!INVOICE_NO_RE.test(value)) {
    return [{ field: 'invoiceNumber', message: `發票號碼格式錯誤（需2英文+8數字）：${value}` }]
  }
  return []
}

export function validateF0401(data: F0401Data): MigValidationError[] {
  const errors: MigValidationError[] = []

  errors.push(...validateInvoiceNumber(data.main.invoiceNumber))
  errors.push(...validateTaxId(data.main.seller.identifier, 'seller.identifier'))

  if (data.main.buyer.identifier !== '00000000' && data.main.buyer.identifier !== '0000000000') {
    errors.push(...validateTaxId(data.main.buyer.identifier, 'buyer.identifier'))
  }

  if (!data.main.seller.name) {
    errors.push({ field: 'seller.name', message: '賣方名稱為必填' })
  }
  if (!data.main.buyer.name) {
    errors.push({ field: 'buyer.name', message: '買方名稱為必填' })
  }

  if (data.details.length === 0) {
    errors.push({ field: 'details', message: '至少需要一筆明細' })
  }

  for (let i = 0; i < data.details.length; i++) {
    const item = data.details[i]
    if (!item.description || item.description.length > 500) {
      errors.push({ field: `details[${i}].description`, message: '品名為必填且不超過500字' })
    }
    if (item.sequenceNumber.length > 4) {
      errors.push({ field: `details[${i}].sequenceNumber`, message: '序號不超過4碼' })
    }
    if (item.remark && item.remark.length > 100) {
      errors.push({ field: `details[${i}].remark`, message: '備註不超過100字' })
    }
    if (!['1', '2', '3', '4', '9'].includes(item.taxType)) {
      errors.push({ field: `details[${i}].taxType`, message: `無效的課稅別：${item.taxType}` })
    }
  }

  if (!['0', '0.01', '0.02', '0.05', '0.15', '0.25'].includes(data.amount.taxRate)) {
    errors.push({ field: 'amount.taxRate', message: `無效的稅率：${data.amount.taxRate}` })
  }

  const computedTotal = data.amount.salesAmount + data.amount.freeTaxSalesAmount
    + data.amount.zeroTaxSalesAmount + data.amount.taxAmount
    - (data.amount.discountAmount ?? 0)
  if (Math.abs(computedTotal - data.amount.totalAmount) > 1) {
    errors.push({
      field: 'amount.totalAmount',
      message: `總額驗算不符：計算值=${computedTotal}，填報值=${data.amount.totalAmount}`,
    })
  }

  if (data.main.relateNumber && data.main.relateNumber.length > 50) {
    errors.push({ field: 'main.relateNumber', message: '相關號碼不超過50字' })
  }

  return errors
}

export function validateF0501(data: F0501Data): MigValidationError[] {
  const errors: MigValidationError[] = []
  errors.push(...validateInvoiceNumber(data.cancelInvoiceNumber))
  errors.push(...validateTaxId(data.sellerIdentifier, 'sellerIdentifier'))
  if (data.buyerIdentifier !== '00000000') {
    errors.push(...validateTaxId(data.buyerIdentifier, 'buyerIdentifier'))
  }
  if (!data.cancelReason) {
    errors.push({ field: 'cancelReason', message: '作廢原因為必填' })
  }
  return errors
}

export function validateG0401(data: G0401Data): MigValidationError[] {
  const errors: MigValidationError[] = []
  if (!data.allowanceNumber) {
    errors.push({ field: 'allowanceNumber', message: '折讓證明單號碼為必填' })
  }
  errors.push(...validateTaxId(data.seller.identifier, 'seller.identifier'))
  if (data.buyer.identifier !== '00000000') {
    errors.push(...validateTaxId(data.buyer.identifier, 'buyer.identifier'))
  }
  if (data.details.length === 0) {
    errors.push({ field: 'details', message: '至少需要一筆折讓明細' })
  }
  for (let i = 0; i < data.details.length; i++) {
    const item = data.details[i]
    errors.push(...validateInvoiceNumber(item.originalInvoiceNumber))
  }
  return errors
}

// ── XML Helpers ────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlTag(tag: string, value: string | number | undefined | null, optional = false): string {
  if (value === undefined || value === null || value === '') {
    if (optional) return ''
    return `<${tag}></${tag}>`
  }
  return `<${tag}>${escapeXml(String(value))}</${tag}>`
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${min}:${s}`
}

function formatAmount(value: number): string {
  return String(Math.round(value))
}

// ── F0401 XML Builder ──────────────────────────────────

export function buildF0401Xml(data: F0401Data): string {
  const { main, details, amount } = data

  const detailsXml = details.map(item => `
    <ProductItem>
      ${xmlTag('Description', item.description)}
      ${xmlTag('Quantity', item.quantity)}
      ${xmlTag('Unit', item.unit, true)}
      ${xmlTag('UnitPrice', item.unitPrice)}
      ${xmlTag('Amount', formatAmount(item.amount))}
      ${xmlTag('SequenceNumber', item.sequenceNumber)}
      ${xmlTag('TaxType', item.taxType)}
      ${xmlTag('Remark', item.remark, true)}
      ${xmlTag('RelateNumber', item.relateNumber, true)}
    </ProductItem>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:GEINV:eInvoiceMessage:F0401:4.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:GEINV:eInvoiceMessage:F0401:4.0 F0401.xsd">
  <Main>
    ${xmlTag('InvoiceNumber', main.invoiceNumber)}
    ${xmlTag('InvoiceDate', formatDate(main.invoiceDate))}
    ${xmlTag('InvoiceTime', formatTime(main.invoiceDate))}
    <Seller>
      ${xmlTag('Identifier', main.seller.identifier)}
      ${xmlTag('Name', main.seller.name)}
      ${xmlTag('Address', main.seller.address, true)}
      ${xmlTag('EmailAddress', main.seller.emailAddress, true)}
    </Seller>
    <Buyer>
      ${xmlTag('Identifier', main.buyer.identifier)}
      ${xmlTag('Name', main.buyer.name)}
      ${xmlTag('Address', main.buyer.address, true)}
      ${xmlTag('EmailAddress', main.buyer.emailAddress, true)}
    </Buyer>
    ${xmlTag('BuyerRemark', main.buyerRemark, true)}
    ${xmlTag('InvoiceType', main.invoiceType)}
    ${xmlTag('DonateMark', main.donateMark)}
    ${xmlTag('CarrierType', main.carrierType, true)}
    ${xmlTag('CarrierId1', main.carrierId1, true)}
    ${xmlTag('CarrierId2', main.carrierId2, true)}
    ${xmlTag('PrintMark', main.printMark)}
    ${xmlTag('NPOBAN', main.npoban, true)}
    ${xmlTag('RelateNumber', main.relateNumber, true)}
  </Main>
  <Details>${detailsXml}
  </Details>
  <Amount>
    ${xmlTag('SalesAmount', formatAmount(amount.salesAmount))}
    ${xmlTag('FreeTaxSalesAmount', formatAmount(amount.freeTaxSalesAmount))}
    ${xmlTag('ZeroTaxSalesAmount', formatAmount(amount.zeroTaxSalesAmount))}
    ${xmlTag('TaxType', amount.taxType)}
    ${xmlTag('TaxRate', amount.taxRate)}
    ${xmlTag('TaxAmount', formatAmount(amount.taxAmount))}
    ${xmlTag('TotalAmount', formatAmount(amount.totalAmount))}
    ${xmlTag('DiscountAmount', amount.discountAmount != null ? formatAmount(amount.discountAmount) : null, true)}
    ${xmlTag('OriginalCurrencyAmount', amount.originalCurrencyAmount != null ? formatAmount(amount.originalCurrencyAmount) : null, true)}
    ${xmlTag('ExchangeRate', amount.exchangeRate, true)}
  </Amount>
</Invoice>`
}

// ── F0501 XML Builder ──────────────────────────────────

export function buildF0501Xml(data: F0501Data): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<CancelInvoice xmlns="urn:GEINV:eInvoiceMessage:F0501:4.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:GEINV:eInvoiceMessage:F0501:4.0 F0501.xsd">
  ${xmlTag('CancelInvoiceNumber', data.cancelInvoiceNumber)}
  ${xmlTag('InvoiceDate', formatDate(data.invoiceDate))}
  ${xmlTag('BuyerIdentifier', data.buyerIdentifier)}
  ${xmlTag('SellerIdentifier', data.sellerIdentifier)}
  ${xmlTag('CancelDate', formatDate(data.cancelDate))}
  ${xmlTag('CancelTime', formatTime(data.cancelTime))}
  ${xmlTag('CancelReason', data.cancelReason)}
</CancelInvoice>`
}

// ── F0701 XML Builder (v4.1 新增) ──────────────────────

export function buildF0701Xml(data: F0701Data): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<VoidInvoice xmlns="urn:GEINV:eInvoiceMessage:F0701:4.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:GEINV:eInvoiceMessage:F0701:4.0 F0701.xsd">
  ${xmlTag('VoidInvoiceNumber', data.cancelInvoiceNumber)}
  ${xmlTag('InvoiceDate', formatDate(data.invoiceDate))}
  ${xmlTag('BuyerIdentifier', data.buyerIdentifier)}
  ${xmlTag('SellerIdentifier', data.sellerIdentifier)}
  ${xmlTag('VoidDate', formatDate(data.cancelDate))}
  ${xmlTag('VoidTime', formatTime(data.cancelTime))}
  ${xmlTag('VoidReason', data.cancelReason)}
</VoidInvoice>`
}

// ── G0401 XML Builder ──────────────────────────────────

export function buildG0401Xml(data: G0401Data): string {
  const detailsXml = data.details.map(item => `
    <ProductItem>
      ${xmlTag('OriginalInvoiceDate', formatDate(item.originalInvoiceDate))}
      ${xmlTag('OriginalInvoiceNumber', item.originalInvoiceNumber)}
      ${xmlTag('OriginalSequenceNumber', item.originalSequenceNumber)}
      ${xmlTag('OriginalDescription', item.originalDescription)}
      ${xmlTag('Quantity', item.quantity)}
      ${xmlTag('UnitPrice', item.unitPrice)}
      ${xmlTag('Amount', formatAmount(item.amount))}
      ${xmlTag('Tax', formatAmount(item.tax))}
      ${xmlTag('AllowanceSequenceNumber', item.allowanceSequenceNumber)}
      ${xmlTag('TaxType', item.taxType)}
    </ProductItem>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Allowance xmlns="urn:GEINV:eInvoiceMessage:G0401:4.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:GEINV:eInvoiceMessage:G0401:4.0 G0401.xsd">
  <Main>
    ${xmlTag('AllowanceNumber', data.allowanceNumber)}
    ${xmlTag('AllowanceDate', formatDate(data.allowanceDate))}
    <Seller>
      ${xmlTag('Identifier', data.seller.identifier)}
      ${xmlTag('Name', data.seller.name)}
    </Seller>
    <Buyer>
      ${xmlTag('Identifier', data.buyer.identifier)}
      ${xmlTag('Name', data.buyer.name)}
    </Buyer>
    ${xmlTag('AllowanceType', data.allowanceType)}
  </Main>
  <Details>${detailsXml}
  </Details>
  <Amount>
    ${xmlTag('TaxAmount', formatAmount(data.taxAmount))}
    ${xmlTag('TotalAmount', formatAmount(data.totalAmount))}
  </Amount>
</Allowance>`
}

// ── G0501 XML Builder ──────────────────────────────────

export function buildG0501Xml(data: G0501Data): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<CancelAllowance xmlns="urn:GEINV:eInvoiceMessage:G0501:4.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:GEINV:eInvoiceMessage:G0501:4.0 G0501.xsd">
  ${xmlTag('CancelAllowanceNumber', data.cancelAllowanceNumber)}
  ${xmlTag('AllowanceDate', formatDate(data.allowanceDate))}
  ${xmlTag('BuyerIdentifier', data.buyerIdentifier)}
  ${xmlTag('SellerIdentifier', data.sellerIdentifier)}
  ${xmlTag('CancelDate', formatDate(data.cancelDate))}
  ${xmlTag('CancelTime', formatTime(data.cancelTime))}
  ${xmlTag('CancelReason', data.cancelReason)}
</CancelAllowance>`
}

// ── Data Mapping from EInvoice + SalesInvoiceItem ──────

export interface EInvoiceWithItems {
  invoiceNumber: string
  date: Date
  invoiceType: 'B2B' | 'B2C'
  subtotal: number
  taxAmount: number
  totalAmount: number
  buyerTaxId: string | null
  buyerName: string | null
  customerName: string
  salesInvoice?: {
    items: Array<{
      productName: string
      specification: string | null
      quantity: number
      unit: string | null
      unitPrice: number
      subtotal: number
      taxAmount: number
      totalAmount: number
      memo: string | null
    }>
  } | null
}

export function mapEInvoiceToF0401(
  invoice: EInvoiceWithItems,
  sellerInfo: { taxId: string; name: string; address?: string },
): F0401Data {
  const isB2B = invoice.invoiceType === 'B2B'
  const buyerId = invoice.buyerTaxId || '00000000'
  const items = invoice.salesInvoice?.items ?? []

  const details: F0401DetailItem[] = items.length > 0
    ? items.map((item, idx) => ({
        description: item.productName + (item.specification ? ` ${item.specification}` : ''),
        quantity: Number(item.quantity),
        unit: item.unit ?? undefined,
        unitPrice: Number(item.unitPrice),
        amount: Math.round(Number(item.subtotal)),
        sequenceNumber: String(idx + 1),
        taxType: '1' as TaxTypeCode,
        remark: item.memo ?? undefined,
      }))
    : [{
        description: invoice.customerName,
        quantity: 1,
        unitPrice: Number(invoice.subtotal),
        amount: Math.round(Number(invoice.subtotal)),
        sequenceNumber: '1',
        taxType: '1' as TaxTypeCode,
      }]

  const invoiceTypeCode: InvoiceTypeCode = isB2B ? '07' : '08'

  return {
    main: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: new Date(invoice.date),
      seller: {
        identifier: sellerInfo.taxId,
        name: sellerInfo.name,
        address: sellerInfo.address,
      },
      buyer: {
        identifier: buyerId,
        name: invoice.buyerName || invoice.customerName,
      },
      invoiceType: invoiceTypeCode,
      donateMark: '0',
      printMark: isB2B ? 'Y' : 'N',
    },
    details,
    amount: {
      salesAmount: Math.round(Number(invoice.subtotal)),
      freeTaxSalesAmount: 0,
      zeroTaxSalesAmount: 0,
      taxType: '1',
      taxRate: '0.05',
      taxAmount: Math.round(Number(invoice.taxAmount)),
      totalAmount: Math.round(Number(invoice.totalAmount)),
    },
  }
}
