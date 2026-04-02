import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

type ReportType = 'trial-balance' | 'income-statement' | 'balance-sheet'
  | 'general-ledger' | 'journal-entries' | 'ar-aging' | 'ap-aging'

/**
 * GET /api/finance/export?report=trial-balance&startDate=&endDate=
 *
 * 通用財務報表 Excel 匯出。支援：
 *  - trial-balance（餘額試算表）
 *  - income-statement（損益表）
 *  - balance-sheet（資產負債表）
 *  - general-ledger（總分類帳）
 *  - journal-entries（傳票清單）
 *  - ar-aging（應收帳齡）
 *  - ap-aging（應付帳齡）
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const report = searchParams.get('report') as ReportType | null
    const startDate = searchParams.get('startDate') ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
    const endDate   = searchParams.get('endDate')   ?? new Date().toISOString().slice(0, 10)

    if (!report) {
      return NextResponse.json({ error: '請指定 report 參數' }, { status: 400 })
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'ComfortPlus ERP'
    wb.created = new Date()

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } },
      border: { bottom: { style: 'thin' } },
    }

    switch (report) {
      case 'trial-balance':
        await buildTrialBalance(wb, startDate, endDate, headerStyle)
        break
      case 'journal-entries':
        await buildJournalEntries(wb, startDate, endDate, headerStyle)
        break
      case 'ar-aging':
        await buildArAging(wb, headerStyle)
        break
      case 'ap-aging':
        await buildApAging(wb, headerStyle)
        break
      default:
        return NextResponse.json({ error: `不支援的報表類型: ${report}` }, { status: 400 })
    }

    const buffer = await wb.xlsx.writeBuffer()
    const filename = `${report}_${startDate}_${endDate}.xlsx`

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error, 'finance.export')
  }
}

// ── 餘額試算表 ────────────────────────────────────────────────────────────────
async function buildTrialBalance(wb: ExcelJS.Workbook, startDate: string, endDate: string, hs: Partial<ExcelJS.Style>) {
  const ws = wb.addWorksheet('餘額試算表')
  ws.columns = [
    { header: '科目代碼', key: 'code', width: 12 },
    { header: '科目名稱', key: 'name', width: 24 },
    { header: '類型',     key: 'type', width: 10 },
    { header: '期初借方', key: 'openDebit',  width: 14 },
    { header: '期初貸方', key: 'openCredit', width: 14 },
    { header: '本期借方', key: 'curDebit',   width: 14 },
    { header: '本期貸方', key: 'curCredit',  width: 14 },
    { header: '期末借方', key: 'endDebit',   width: 14 },
    { header: '期末貸方', key: 'endCredit',  width: 14 },
  ]
  ws.getRow(1).eachCell(c => { Object.assign(c.style, hs) })

  const sd = new Date(startDate)
  const ed = new Date(endDate)
  ed.setDate(ed.getDate() + 1)

  const accounts = await prisma.accountingAccount.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
  })

  for (const a of accounts) {
    const [opening] = await prisma.$queryRaw<[{ d: number; c: number }]>`
      SELECT COALESCE(SUM(l.debit),0)::float as d, COALESCE(SUM(l.credit),0)::float as c
      FROM "JournalEntryLine" l JOIN "JournalEntry" e ON e.id=l."entryId"
      WHERE l."accountId"=${a.id} AND e.status='POSTED' AND e."entryDate" < ${sd}
    `
    const [current] = await prisma.$queryRaw<[{ d: number; c: number }]>`
      SELECT COALESCE(SUM(l.debit),0)::float as d, COALESCE(SUM(l.credit),0)::float as c
      FROM "JournalEntryLine" l JOIN "JournalEntry" e ON e.id=l."entryId"
      WHERE l."accountId"=${a.id} AND e.status='POSTED' AND e."entryDate">=${sd} AND e."entryDate"<${ed}
    `

    ws.addRow({
      code: a.code, name: a.name, type: a.type,
      openDebit: opening.d, openCredit: opening.c,
      curDebit: current.d, curCredit: current.c,
      endDebit: opening.d + current.d, endCredit: opening.c + current.c,
    })
  }

  // Format numbers
  ws.eachRow((row, i) => { if (i > 1) row.eachCell((c, j) => { if (j >= 4) c.numFmt = '#,##0' }) })
}

// ── 傳票清單 ────────────────────────────────────────────────────────────────
async function buildJournalEntries(wb: ExcelJS.Workbook, startDate: string, endDate: string, hs: Partial<ExcelJS.Style>) {
  const ws = wb.addWorksheet('傳票清單')
  ws.columns = [
    { header: '傳票號',     key: 'entryNo', width: 18 },
    { header: '日期',       key: 'date',    width: 12 },
    { header: '摘要',       key: 'desc',    width: 30 },
    { header: '類型',       key: 'type',    width: 10 },
    { header: '狀態',       key: 'status',  width: 10 },
    { header: '借方合計',   key: 'debit',   width: 14 },
    { header: '貸方合計',   key: 'credit',  width: 14 },
    { header: '建立者',     key: 'creator', width: 12 },
  ]
  ws.getRow(1).eachCell(c => { Object.assign(c.style, hs) })

  const sd = new Date(startDate)
  const ed = new Date(endDate)
  ed.setDate(ed.getDate() + 1)

  const entries = await prisma.journalEntry.findMany({
    where: { entryDate: { gte: sd, lt: ed } },
    include: { createdBy: { select: { name: true } } },
    orderBy: { entryDate: 'asc' },
  })

  const STATUS_MAP: Record<string, string> = { DRAFT: '草稿', POSTED: '已過帳', REVERSED: '已沖正' }
  const TYPE_MAP: Record<string, string> = { MANUAL: '手動', AUTO: '自動', ADJUSTMENT: '調整', CLOSING: '結帳' }

  for (const e of entries) {
    ws.addRow({
      entryNo: e.entryNo,
      date: e.entryDate.toISOString().slice(0, 10),
      desc: e.description,
      type: TYPE_MAP[e.entryType] ?? e.entryType,
      status: STATUS_MAP[e.status] ?? e.status,
      debit: Number(e.totalDebit),
      credit: Number(e.totalCredit),
      creator: e.createdBy.name,
    })
  }
  ws.eachRow((row, i) => { if (i > 1) { row.getCell(6).numFmt = '#,##0'; row.getCell(7).numFmt = '#,##0' } })
}

// ── 應收帳齡 ────────────────────────────────────────────────────────────────
async function buildArAging(wb: ExcelJS.Workbook, hs: Partial<ExcelJS.Style>) {
  const ws = wb.addWorksheet('應收帳齡')
  ws.columns = [
    { header: '客戶',       key: 'customer', width: 24 },
    { header: '發票號',     key: 'invoice',  width: 16 },
    { header: '應收金額',   key: 'amount',   width: 14 },
    { header: '已收金額',   key: 'paid',     width: 14 },
    { header: '未收餘額',   key: 'balance',  width: 14 },
    { header: '到期日',     key: 'dueDate',  width: 12 },
    { header: '帳齡(天)',   key: 'days',     width: 10 },
    { header: '狀態',       key: 'status',   width: 10 },
  ]
  ws.getRow(1).eachCell(c => { Object.assign(c.style, hs) })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = await (prisma.accountsReceivable.findMany as any)({
    where: { status: { notIn: ['PAID'] } },
    include: { customer: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  })

  const now = Date.now()
  for (const r of records) {
    const balance = Number(r.amount) - Number(r.paidAmount)
    if (balance <= 0) continue
    const days = r.dueDate ? Math.floor((now - r.dueDate.getTime()) / 86400000) : 0
    ws.addRow({
      customer: r.customer.name,
      invoice: r.invoiceNo ?? '-',
      amount: Number(r.amount),
      paid: Number(r.paidAmount),
      balance,
      dueDate: r.dueDate?.toISOString().slice(0, 10) ?? '-',
      days: Math.max(0, days),
      status: r.status,
    })
  }
  ws.eachRow((row, i) => { if (i > 1) [3, 4, 5].forEach(c => { row.getCell(c).numFmt = '#,##0' }) })
}

// ── 應付帳齡 ────────────────────────────────────────────────────────────────
async function buildApAging(wb: ExcelJS.Workbook, hs: Partial<ExcelJS.Style>) {
  const ws = wb.addWorksheet('應付帳齡')
  ws.columns = [
    { header: '供應商',     key: 'supplier', width: 24 },
    { header: '發票號',     key: 'invoice',  width: 16 },
    { header: '應付金額',   key: 'amount',   width: 14 },
    { header: '已付金額',   key: 'paid',     width: 14 },
    { header: '未付餘額',   key: 'balance',  width: 14 },
    { header: '到期日',     key: 'dueDate',  width: 12 },
    { header: '帳齡(天)',   key: 'days',     width: 10 },
    { header: '狀態',       key: 'status',   width: 10 },
  ]
  ws.getRow(1).eachCell(c => { Object.assign(c.style, hs) })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = await (prisma.accountsPayable.findMany as any)({
    where: { status: { notIn: ['PAID'] } },
    include: { supplier: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  })

  const now = Date.now()
  for (const r of records) {
    const balance = Number(r.amount) - Number(r.paidAmount)
    if (balance <= 0) continue
    const days = r.dueDate ? Math.floor((now - r.dueDate.getTime()) / 86400000) : 0
    ws.addRow({
      supplier: r.supplier.name,
      invoice: r.invoiceNo ?? '-',
      amount: Number(r.amount),
      paid: Number(r.paidAmount),
      balance,
      dueDate: r.dueDate?.toISOString().slice(0, 10) ?? '-',
      days: Math.max(0, days),
      status: r.status,
    })
  }
  ws.eachRow((row, i) => { if (i > 1) [3, 4, 5].forEach(c => { row.getCell(c).numFmt = '#,##0' }) })
}
