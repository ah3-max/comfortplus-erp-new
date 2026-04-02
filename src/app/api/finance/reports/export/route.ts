import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

// ─── helpers ────────────────────────────────────────────────────────────────
function applyHeader(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, title: string, subtitle: string) {
  ws.mergeCells('A1:E1')
  const t = ws.getCell('A1')
  t.value = title
  t.style = { font: { bold: true, size: 14 }, alignment: { horizontal: 'center', vertical: 'middle' } }
  ws.getRow(1).height = 28

  ws.mergeCells('A2:E2')
  const s = ws.getCell('A2')
  s.value = subtitle
  s.style = { font: { italic: true, size: 10, color: { argb: 'FF666666' } }, alignment: { horizontal: 'center' } }

  ws.addRow([])
}

function applySection(ws: ExcelJS.Worksheet, label: string, fgColor = 'FFD9E1F2') {
  const row = ws.addRow([label])
  row.getCell(1).style = {
    font: { bold: true, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } },
  }
  ws.mergeCells(`A${row.number}:E${row.number}`)
}

function applyDataRow(ws: ExcelJS.Worksheet, indent: string, label: string, value: number | null, bold = false) {
  const row = ws.addRow([indent + label, '', '', '', value])
  row.getCell(1).style = { font: { bold } }
  if (value !== null) {
    row.getCell(5).style = {
      numFmt: '#,##0',
      alignment: { horizontal: 'right' },
      font: { bold, color: value < 0 ? { argb: 'FFCC0000' } : undefined },
    }
  }
}

// ─── Income Statement ────────────────────────────────────────────────────────
async function buildIncomeStatement(year: number, month: number | null, wb: ExcelJS.Workbook) {
  let startDate: Date, endDate: Date
  if (month) {
    startDate = new Date(year, month - 1, 1)
    endDate = new Date(year, month, 0, 23, 59, 59)
  } else {
    startDate = new Date(year, 0, 1)
    endDate = new Date(year, 11, 31, 23, 59, 59)
  }

  const [invoices, disbursements, receipts] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { status: { in: ['CONFIRMED', 'SHIPPED'] }, date: { gte: startDate, lte: endDate } },
      select: { totalAmount: true, taxAmount: true, subtotal: true },
    }),
    prisma.disbursementRecord.findMany({
      where: { paymentDate: { gte: startDate, lte: endDate } },
      include: { ap: { select: { apCategory: true, amount: true } } },
    }),
    prisma.receiptRecord.findMany({
      where: { receiptDate: { gte: startDate, lte: endDate } },
      select: { amount: true },
    }),
  ])

  const revenueExcludeTax = invoices.reduce((s, i) => s + Number(i.subtotal ?? i.totalAmount), 0)
  const taxCollected = invoices.reduce((s, i) => s + Number(i.taxAmount ?? 0), 0)
  const cashReceived = receipts.reduce((s, r) => s + Number(r.amount), 0)
  const cogs = disbursements.filter(d => d.ap.apCategory === 'PRODUCT').reduce((s, d) => s + Number(d.amount), 0)
  const freight = disbursements.filter(d => d.ap.apCategory === 'FREIGHT').reduce((s, d) => s + Number(d.amount), 0)
  const other = disbursements.filter(d => !['PRODUCT', 'FREIGHT'].includes(d.ap.apCategory ?? '')).reduce((s, d) => s + Number(d.amount), 0)
  const grossProfit = revenueExcludeTax - cogs
  const operatingProfit = grossProfit - freight - other

  const ws = wb.addWorksheet('損益表')
  ws.columns = [{ width: 36 }, { width: 6 }, { width: 6 }, { width: 6 }, { width: 18 }]

  const periodLabel = month ? `${year}年 ${String(month).padStart(2, '0')}月` : `${year}年度`
  applyHeader(wb, ws, '損益表 / Income Statement', `期間：${periodLabel}　　產生時間：${new Date().toLocaleString('zh-TW')}`)

  applySection(ws, '一、營業收入', 'FFE2EFDA')
  applyDataRow(ws, '　', '應稅銷售額（未稅）', revenueExcludeTax)
  applyDataRow(ws, '　', '銷項稅額', taxCollected)
  applyDataRow(ws, '　', '實收現金（AR 已收款）', cashReceived)
  applyDataRow(ws, '', '營業收入合計', revenueExcludeTax, true)

  ws.addRow([])
  applySection(ws, '二、銷貨成本', 'FFFFF2CC')
  applyDataRow(ws, '　', '商品進貨成本', cogs)
  applyDataRow(ws, '', '銷貨成本合計', cogs, true)

  ws.addRow([])
  applyDataRow(ws, '', '毛利', grossProfit, true)
  ws.lastRow!.getCell(1).style = { font: { bold: true, size: 12 } }

  ws.addRow([])
  applySection(ws, '三、營業費用', 'FFFCE4D6')
  applyDataRow(ws, '　', '運費', freight)
  applyDataRow(ws, '　', '其他費用', other)
  applyDataRow(ws, '', '費用合計', freight + other, true)

  ws.addRow([])
  applyDataRow(ws, '', '營業利益', operatingProfit, true)
  ws.lastRow!.getCell(1).style = { font: { bold: true, size: 12 } }
  ws.lastRow!.getCell(5).style = {
    numFmt: '#,##0',
    font: { bold: true, size: 12, color: operatingProfit < 0 ? { argb: 'FFCC0000' } : { argb: 'FF006600' } },
    alignment: { horizontal: 'right' },
  }

  return ws
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────
async function buildBalanceSheet(wb: ExcelJS.Workbook) {
  const [totalReceived, totalDisbursed, arData, inventoryItems, apData, invoicesOut] = await Promise.all([
    prisma.receiptRecord.aggregate({ _sum: { amount: true } }),
    prisma.disbursementRecord.aggregate({ _sum: { amount: true } }),
    prisma.accountsReceivable.findMany({
      where: { status: { in: ['NOT_DUE', 'DUE', 'PARTIAL_PAID'] } },
      select: { amount: true, paidAmount: true },
    }),
    prisma.inventory.findMany({
      where: { quantity: { gt: 0 } },
      include: { product: { select: { costPrice: true, costStructure: { select: { totalCost: true } } } } },
    }),
    prisma.accountsPayable.findMany({
      where: { status: { in: ['NOT_DUE', 'DUE', 'PARTIAL_PAID'] } },
      select: { amount: true, paidAmount: true },
    }),
    prisma.salesInvoice.aggregate({
      where: { status: { in: ['CONFIRMED', 'SHIPPED'] } },
      _sum: { totalAmount: true },
    }),
  ])

  const cash = Math.max(0, Number(totalReceived._sum.amount ?? 0) - Number(totalDisbursed._sum.amount ?? 0))
  const arBalance = arData.reduce((s, a) => s + Number(a.amount) - Number(a.paidAmount), 0)
  const inventoryValue = inventoryItems.reduce((s, i) => {
    const cost = Number(i.product.costStructure?.totalCost ?? i.product.costPrice ?? 0)
    return s + i.quantity * cost
  }, 0)
  const siOut = Number(invoicesOut._sum.totalAmount ?? 0)
  const apBalance = apData.reduce((s, a) => s + Number(a.amount) - Number(a.paidAmount), 0)
  const totalAssets = cash + arBalance + inventoryValue
  const equity = totalAssets - apBalance

  const ws = wb.addWorksheet('資產負債表')
  ws.columns = [{ width: 36 }, { width: 6 }, { width: 6 }, { width: 6 }, { width: 18 }]
  applyHeader(wb, ws, '資產負債表 / Balance Sheet', `截至 ${new Date().toLocaleDateString('zh-TW')}　　產生時間：${new Date().toLocaleString('zh-TW')}`)

  applySection(ws, '資產（Assets）', 'FFE2EFDA')
  applyDataRow(ws, '　【流動資產】', '', null)
  applyDataRow(ws, '　　', '現金及約當現金（估算）', cash)
  applyDataRow(ws, '　　', '應收帳款（未收餘額）', arBalance)
  applyDataRow(ws, '　　', '存貨（帳面價值）', inventoryValue)
  applyDataRow(ws, '　　', '待確認銷貨收款', siOut)
  applyDataRow(ws, '　', '流動資產合計', totalAssets, true)
  applyDataRow(ws, '', '資產總計', totalAssets, true)
  ws.lastRow!.height = 20

  ws.addRow([])
  applySection(ws, '負債（Liabilities）', 'FFFFF2CC')
  applyDataRow(ws, '　【流動負債】', '', null)
  applyDataRow(ws, '　　', '應付帳款（未付餘額）', apBalance)
  applyDataRow(ws, '　', '流動負債合計', apBalance, true)
  applyDataRow(ws, '', '負債總計', apBalance, true)
  ws.lastRow!.height = 20

  ws.addRow([])
  applySection(ws, '股東權益（Equity）', 'FFD9E1F2')
  applyDataRow(ws, '　', '業主權益（估算值）', equity, true)
  ws.addRow([])
  applyDataRow(ws, '', '負債及權益總計', apBalance + equity, true)
  ws.lastRow!.height = 20

  ws.addRow([])
  const noteRow = ws.addRow(['＊ 本表為由現有交易資料推算之估計值，不含折舊、攤銷等會計調整項目。'])
  noteRow.getCell(1).style = { font: { italic: true, color: { argb: 'FF888888' } } }

  return ws
}

// ─── Trial Balance ────────────────────────────────────────────────────────────
async function buildTrialBalance(startDate: string | null, endDate: string | null, wb: ExcelJS.Workbook) {
  const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const periodEnd = endDate ? new Date(endDate) : new Date()
  periodEnd.setHours(23, 59, 59, 999)

  const accounts = await prisma.accountingAccount.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } })
  const lines = await prisma.journalEntryLine.findMany({
    include: { entry: { select: { entryDate: true, status: true } } },
  })
  const postedLines = lines.filter(l => l.entry.status === 'POSTED')

  const ws = wb.addWorksheet('試算表')
  ws.columns = [
    { header: '科目代碼', key: 'code', width: 14 },
    { header: '科目名稱', key: 'name', width: 28 },
    { header: '期間借方', key: 'debit', width: 14 },
    { header: '期間貸方', key: 'credit', width: 14 },
    { header: '期末餘額（借）', key: 'balDebit', width: 16 },
    { header: '期末餘額（貸）', key: 'balCredit', width: 16 },
  ]
  ws.columns = [{ width: 14 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 16 }]

  const hRow = ws.getRow(1)
  hRow.values = ['科目代碼', '科目名稱', '期間借方', '期間貸方', '累計借方', '累計貸方']
  hRow.font = { bold: true }
  hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  const periodLines = postedLines.filter(l => l.entry.entryDate >= periodStart && l.entry.entryDate <= periodEnd)
  let totalDebit = 0, totalCredit = 0, totalBalDebit = 0, totalBalCredit = 0

  accounts.forEach(acc => {
    const pLines = periodLines.filter(l => l.accountId === acc.id)
    const allLines = postedLines.filter(l => l.accountId === acc.id)
    const debit = pLines.reduce((s, l) => s + Number(l.debit), 0)
    const credit = pLines.reduce((s, l) => s + Number(l.credit), 0)
    const allDebit = allLines.reduce((s, l) => s + Number(l.debit), 0)
    const allCredit = allLines.reduce((s, l) => s + Number(l.credit), 0)
    if (debit === 0 && credit === 0 && allDebit === 0 && allCredit === 0) return

    const row = ws.addRow([acc.code, acc.name, debit || null, credit || null, allDebit || null, allCredit || null])
    ;[3, 4, 5, 6].forEach(col => {
      if (row.getCell(col).value !== null) {
        row.getCell(col).numFmt = '#,##0'
        row.getCell(col).alignment = { horizontal: 'right' }
      }
    })
    totalDebit += debit; totalCredit += credit; totalBalDebit += allDebit; totalBalCredit += allCredit
  })

  const sumRow = ws.addRow(['合計', '', totalDebit, totalCredit, totalBalDebit, totalBalCredit])
  sumRow.font = { bold: true }
  ;[3, 4, 5, 6].forEach(i => { sumRow.getCell(i).numFmt = '#,##0'; sumRow.getCell(i).alignment = { horizontal: 'right' } })

  return ws
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') ?? 'income-statement'
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const wb = new ExcelJS.Workbook()
    wb.creator = 'ComfortPlus ERP'
    wb.created = new Date()

    let filename = 'report.xlsx'

    if (type === 'income-statement') {
      await buildIncomeStatement(year, month, wb)
      filename = `income_statement_${year}${month ? '_' + String(month).padStart(2, '0') : ''}.xlsx`
    } else if (type === 'balance-sheet') {
      await buildBalanceSheet(wb)
      filename = `balance_sheet_${new Date().toISOString().slice(0, 10)}.xlsx`
    } else if (type === 'trial-balance') {
      await buildTrialBalance(startDate, endDate, wb)
      const sLabel = (startDate ?? new Date().toISOString().slice(0, 7)).slice(0, 7)
      filename = `trial_balance_${sLabel}.xlsx`
    } else if (type === 'all') {
      await buildIncomeStatement(year, month, wb)
      await buildBalanceSheet(wb)
      await buildTrialBalance(startDate, endDate, wb)
      filename = `financial_reports_${year}.xlsx`
    } else {
      return NextResponse.json({ error: '不支援的報表類型' }, { status: 400 })
    }

    const buffer = await wb.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error, 'finance.reports.export')
  }
}
