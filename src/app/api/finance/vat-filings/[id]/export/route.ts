import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const filing = await prisma.vatFiling.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true } } },
    })
    if (!filing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Pull individual e-invoices in the filing period for detail sheet
    const startDate = new Date(filing.startDate)
    const endDate = new Date(filing.endDate)
    endDate.setHours(23, 59, 59, 999)

    const eInvoices = await prisma.eInvoice.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: { in: ['APPROVED', 'CREATED'] },
      },
      include: { customer: { select: { name: true, code: true } } },
      orderBy: { date: 'asc' },
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'ComfortPlus ERP'
    workbook.created = new Date()

    // ── Sheet 1: 401 申報書 ──
    const s = workbook.addWorksheet('401申報書')

    const titleStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 14 },
      alignment: { horizontal: 'center', vertical: 'middle' },
    }
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } },
      border: { bottom: { style: 'thin' } },
    }
    const labelStyle: Partial<ExcelJS.Style> = {
      font: { bold: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } },
    }
    const amountStyle: Partial<ExcelJS.Style> = {
      numFmt: '#,##0',
      alignment: { horizontal: 'right' },
    }
    const redStyle: Partial<ExcelJS.Style> = {
      numFmt: '#,##0',
      alignment: { horizontal: 'right' },
      font: { bold: true, color: { argb: 'FFCC0000' } },
    }

    s.columns = [
      { width: 32 }, { width: 20 }, { width: 20 }, { width: 20 },
    ]

    // Title
    s.mergeCells('A1:D1')
    const t1 = s.getCell('A1')
    t1.value = '401 一般稅額計算式營業稅申報書'
    Object.assign(t1.style, titleStyle)
    s.getRow(1).height = 28

    s.mergeCells('A2:D2')
    const t2 = s.getCell('A2')
    t2.value = `申報單號：${filing.filingNo}　　申報期間：${filing.periodCode}`
    t2.style.alignment = { horizontal: 'center' }
    t2.style.font = { size: 11 }

    s.addRow([])

    // Section A: 銷項
    const r4 = s.addRow(['【銷項稅額】', '稅基（銷售額）', '稅率', '稅額'])
    r4.eachCell(c => { Object.assign(c.style, headerStyle) })

    const r5 = s.addRow(['應稅（一般稅率5%）', Number(filing.outputTaxBase), '5%', Number(filing.outputTax)])
    r5.getCell(1).style = labelStyle
    r5.getCell(2).style = amountStyle
    r5.getCell(4).style = amountStyle

    const r6 = s.addRow(['零稅率', 0, '0%', 0])
    r6.getCell(1).style = labelStyle
    r6.getCell(2).style = amountStyle
    r6.getCell(4).style = amountStyle

    const r7 = s.addRow(['銷項稅額小計', Number(filing.outputTaxBase), '', Number(filing.outputTax)])
    r7.getCell(1).style = { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } } }
    r7.getCell(2).style = { ...amountStyle, font: { bold: true } }
    r7.getCell(4).style = { ...amountStyle, font: { bold: true } }

    s.addRow([])

    // Section B: 進項
    const r9 = s.addRow(['【進項稅額】', '稅基（進貨/費用）', '稅率', '稅額'])
    r9.eachCell(c => { Object.assign(c.style, headerStyle) })

    const r10 = s.addRow(['可扣抵進項（一般5%）', Number(filing.inputTaxBase), '5%', Number(filing.inputTax)])
    r10.getCell(1).style = labelStyle
    r10.getCell(2).style = amountStyle
    r10.getCell(4).style = amountStyle

    const r11 = s.addRow(['進項稅額小計', Number(filing.inputTaxBase), '', Number(filing.inputTax)])
    r11.getCell(1).style = { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } } }
    r11.getCell(2).style = { ...amountStyle, font: { bold: true } }
    r11.getCell(4).style = { ...amountStyle, font: { bold: true } }

    s.addRow([])

    // Net tax
    const netTaxVal = Number(filing.netTax)
    const r13 = s.addRow(['本期應納（退）稅額', '', '', netTaxVal])
    r13.getCell(1).style = { font: { bold: true, size: 12 } }
    r13.getCell(4).style = netTaxVal >= 0 ? redStyle : { ...amountStyle, font: { bold: true, color: { argb: 'FF006600' } } }
    s.getRow(r13.number).height = 22

    const r14 = s.addRow([netTaxVal >= 0 ? '▶ 本期應繳稅款' : '▶ 本期溢付稅額（可申請退稅）', '', '', Math.abs(netTaxVal)])
    r14.getCell(1).style = { font: { italic: true, color: { argb: netTaxVal >= 0 ? 'FFCC0000' : 'FF006600' } } }
    r14.getCell(4).style = amountStyle

    s.addRow([])

    // Filing info
    s.addRow(['申報資訊', '', '', ''])
    const infoRows = [
      ['申報日期', filing.filedAt ? new Date(filing.filedAt).toLocaleDateString('zh-TW') : '－'],
      ['繳款日期', filing.paidAt ? new Date(filing.paidAt).toLocaleDateString('zh-TW') : '－'],
      ['稅捐機關序號', filing.taxAuthRef ?? '－'],
      ['申報狀態', filing.status === 'DRAFT' ? '草稿' : filing.status === 'FILED' ? '已申報' : '已繳款'],
      ['建立人員', filing.createdBy.name],
      ['備註', filing.notes ?? ''],
    ]
    infoRows.forEach(([k, v]) => {
      const row = s.addRow([k, v])
      row.getCell(1).style = labelStyle
    })

    // ── Sheet 2: 發票明細 ──
    const d = workbook.addWorksheet('銷項發票明細')
    d.columns = [
      { header: '發票號碼', key: 'no', width: 16 },
      { header: '日期', key: 'date', width: 12 },
      { header: '客戶代碼', key: 'code', width: 14 },
      { header: '客戶名稱', key: 'name', width: 28 },
      { header: '類型', key: 'type', width: 8 },
      { header: '稅前金額', key: 'subtotal', width: 14 },
      { header: '稅額', key: 'tax', width: 12 },
      { header: '含稅合計', key: 'total', width: 14 },
      { header: '狀態', key: 'status', width: 10 },
    ]
    d.getRow(1).font = { bold: true }
    d.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

    let outputBase = 0
    let outputTaxSum = 0
    eInvoices.forEach(inv => {
      const sub = Number(inv.subtotal)
      const tax = Number(inv.taxAmount)
      outputBase += sub
      outputTaxSum += tax
      const row = d.addRow({
        no: inv.invoiceNumber,
        date: new Date(inv.date).toLocaleDateString('zh-TW'),
        code: inv.customer.code,
        name: inv.customerName,
        type: inv.invoiceType,
        subtotal: sub,
        tax,
        total: Number(inv.totalAmount),
        status: inv.status === 'APPROVED' ? '已核准' : '新增',
      })
      ;['subtotal', 'tax', 'total'].forEach(k => {
        row.getCell(k).numFmt = '#,##0'
        row.getCell(k).alignment = { horizontal: 'right' }
      })
    })

    // Summary row
    const totalRow = d.addRow({ no: '合計', subtotal: outputBase, tax: outputTaxSum, total: outputBase + outputTaxSum })
    totalRow.getCell('no').style = { font: { bold: true } }
    ;['subtotal', 'tax', 'total'].forEach(k => {
      totalRow.getCell(k).style = { font: { bold: true }, numFmt: '#,##0', alignment: { horizontal: 'right' } }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `vat_401_${filing.filingNo}_${filing.periodCode.replace('/', '-')}.xlsx`

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error, 'vat-filings.export')
  }
}
