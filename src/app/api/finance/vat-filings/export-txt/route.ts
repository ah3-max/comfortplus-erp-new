import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import {
  buildOutputLine, buildInputLine, buildSummaryLine,
  formatRocPeriod,
} from '@/lib/vat-401-format'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/vat-filings/export-txt?period=2026-03
 *
 * Generates a Taiwan 401 VAT filing TXT media file for the given bimonthly period.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const period = new URL(req.url).searchParams.get('period')
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'period 格式應為 YYYY-MM（如 2026-03）' }, { status: 400 })
    }

    const [year, month] = period.split('-').map(Number)

    // Align to bimonthly: odd start month
    const startMonth = month % 2 === 0 ? month - 1 : month
    const endMonth = startMonth + 1
    const startDate = new Date(year, startMonth - 1, 1)
    const endDate = new Date(year, endMonth, 0, 23, 59, 59)
    const inputPeriodKey = `${year}-${String(startMonth).padStart(2, '0')}`

    // Company tax ID from env
    const companyTaxId = process.env.COMPANY_TAX_ID ?? '00000000'

    // ── Output invoices (銷項) ──
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

    // ── Input items (進項) ──
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

    // ── Build lines ──
    const lines: string[] = []

    // Output lines (Record Type 2)
    for (const inv of outputInvoices) {
      lines.push(buildOutputLine({
        sellerTaxId: companyTaxId,
        buyerTaxId: inv.buyerTaxId ?? '00000000',
        invoiceNo: inv.invoiceNumber,
        invoiceDate: new Date(inv.date),
        salesAmount: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        taxType: '1', // 應稅 5%
      }))
    }

    // Input lines (Record Type 3)
    for (const item of inputItems) {
      const deductionCode = item.sourceType === 'CUSTOMS' ? '1' as const
        : item.sourceType === 'DOMESTIC_INVOICE' ? '1' as const
        : '3' as const // RECEIPT → 不可扣抵（保守預設）
      lines.push(buildInputLine({
        buyerTaxId: companyTaxId,
        sellerTaxId: item.vendorTaxId ?? '00000000',
        invoiceNo: item.invoiceNo,
        invoiceDate: new Date(item.invoiceDate),
        purchaseAmount: Number(item.subtotal),
        taxAmount: Number(item.taxAmount),
        deductionCode,
      }))
    }

    // Summary (Record Type 1, last line)
    const outputAmount = outputInvoices.reduce((s, i) => s + Number(i.subtotal), 0)
    const outputTax = outputInvoices.reduce((s, i) => s + Number(i.taxAmount), 0)
    const inputAmount = inputItems.reduce((s, i) => s + Number(i.subtotal), 0)
    const inputTax = inputItems.reduce((s, i) => s + Number(i.taxAmount), 0)
    const netTax = outputTax - inputTax

    const rocPeriod = formatRocPeriod(year, startMonth)

    lines.push(buildSummaryLine({
      taxId: companyTaxId,
      periodCode: rocPeriod,
      outputCount: outputInvoices.length,
      outputAmount: Math.round(outputAmount),
      outputTax: Math.round(outputTax),
      inputCount: inputItems.length,
      inputAmount: Math.round(inputAmount),
      inputTax: Math.round(inputTax),
      netTax: Math.round(netTax),
    }))

    const content = lines.join('\r\n')
    const fileName = `401_${rocPeriod}.txt`

    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    return handleApiError(error, 'vat-filings.export-txt')
  }
}
