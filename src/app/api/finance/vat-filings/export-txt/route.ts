import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import {
  buildOutputLine, buildInputLine,
  formatRocPeriod,
  resolveOutputFormatCode, resolveInputFormatCode, resolveDeductionCode,
  validateExportData,
} from '@/lib/vat-401-format'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/vat-filings/export-txt?period=2026-03
 * GET /api/finance/vat-filings/export-txt?period=2026-03&mode=validate
 *
 * mode=validate → returns JSON { outputCount, inputCount, warnings[] }
 * (default)     → returns 401 media TXT file (81-byte fixed-width, CRLF)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const period = url.searchParams.get('period')
    const mode = url.searchParams.get('mode')

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'period 格式應為 YYYY-MM（如 2026-03）' }, { status: 400 })
    }

    const [year, month] = period.split('-').map(Number)

    const startMonth = month % 2 === 0 ? month - 1 : month
    const endMonth = startMonth + 1
    const startDate = new Date(year, startMonth - 1, 1)
    const endDate = new Date(year, endMonth, 0, 23, 59, 59)
    const inputPeriodKey = `${year}-${String(startMonth).padStart(2, '0')}`

    const companyTaxId = process.env.COMPANY_TAX_ID ?? '00000000'

    const outputInvoices = await prisma.eInvoice.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: { not: 'VOIDED' },
      },
      select: {
        invoiceNumber: true,
        date: true,
        subtotal: true,
        taxAmount: true,
        invoiceType: true,
        buyerTaxId: true,
      },
      orderBy: { date: 'asc' },
    })

    const inputItems = await prisma.inputTaxItem.findMany({
      where: { taxPeriod: inputPeriodKey },
      select: {
        invoiceNo: true,
        invoiceDate: true,
        vendorTaxId: true,
        subtotal: true,
        taxAmount: true,
        sourceType: true,
      },
      orderBy: { invoiceDate: 'asc' },
    })

    // ── Validate mode ──
    if (mode === 'validate') {
      const warnings = validateExportData(outputInvoices, inputItems)
      const outputAmount = outputInvoices.reduce((s, i) => s + Number(i.subtotal), 0)
      const outputTax = outputInvoices.reduce((s, i) => s + Number(i.taxAmount), 0)
      const inputAmount = inputItems.reduce((s, i) => s + Number(i.subtotal), 0)
      const inputTax = inputItems.reduce((s, i) => s + Number(i.taxAmount), 0)

      return NextResponse.json({
        period: inputPeriodKey,
        companyTaxId,
        outputCount: outputInvoices.length,
        inputCount: inputItems.length,
        outputAmount: Math.round(outputAmount),
        outputTax: Math.round(outputTax),
        inputAmount: Math.round(inputAmount),
        inputTax: Math.round(inputTax),
        netTax: Math.round(outputTax - inputTax),
        warnings,
      })
    }

    // ── Build TXT lines (81-byte fixed-width) ──
    const lines: string[] = []

    for (const inv of outputInvoices) {
      lines.push(buildOutputLine({
        formatCode: resolveOutputFormatCode(inv.invoiceType, inv.buyerTaxId),
        sellerTaxId: companyTaxId,
        buyerTaxId: inv.buyerTaxId ?? '00000000',
        invoiceNo: inv.invoiceNumber,
        invoiceDate: new Date(inv.date),
        salesAmount: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        taxType: '1',
      }))
    }

    for (const item of inputItems) {
      lines.push(buildInputLine({
        formatCode: resolveInputFormatCode(item.sourceType),
        buyerTaxId: companyTaxId,
        sellerTaxId: item.vendorTaxId ?? '00000000',
        invoiceNo: item.invoiceNo,
        invoiceDate: new Date(item.invoiceDate),
        purchaseAmount: Number(item.subtotal),
        taxAmount: Number(item.taxAmount),
        deductionCode: resolveDeductionCode(item.sourceType),
      }))
    }

    if (lines.length === 0) {
      return NextResponse.json({ error: '本期無進銷項資料可匯出' }, { status: 404 })
    }

    const content = lines.join('\r\n')
    const rocPeriod = formatRocPeriod(year, startMonth)
    const fileName = `401_${rocPeriod}.txt`

    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Vat-Output-Count': String(outputInvoices.length),
        'X-Vat-Input-Count': String(inputItems.length),
      },
    })
  } catch (error) {
    return handleApiError(error, 'vat-filings.export-txt')
  }
}
