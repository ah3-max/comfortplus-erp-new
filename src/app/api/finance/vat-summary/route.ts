import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/vat-summary?period=2025-01
 *
 * 雙月 VAT 試算
 * period 格式：YYYY-MM，奇數月為申報期起始（01/03/05/07/09/11）
 *
 * 銷項（output）：EInvoice（非作廢）
 * 進項（input）：InputTaxItem.taxPeriod === period
 * 應繳 = 銷項稅額 - 進項稅額
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period')

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: 'period 格式應為 YYYY-MM（如 2025-01）' },
        { status: 400 }
      )
    }

    const [year, month] = period.split('-').map(Number)

    // 雙月申報：01→1-2月, 03→3-4月 ... 11→11-12月
    // 若傳入偶數月，自動對齊到前一奇數月
    const startMonth = month % 2 === 0 ? month - 1 : month
    const endMonth   = startMonth + 1

    const startDate = new Date(year, startMonth - 1, 1)
    const endDate   = new Date(year, endMonth, 0, 23, 59, 59) // 該雙月末

    // 期別標示（如 2025-01/02）
    const periodLabel = `${year}-${String(startMonth).padStart(2, '0')}/${String(endMonth).padStart(2, '0')}`
    // 進項的 taxPeriod key（以起始奇數月表示）
    const inputPeriodKey = `${year}-${String(startMonth).padStart(2, '0')}`

    // ── 銷項：EInvoice（非作廢）────────────────────────────
    const outputInvoices = await prisma.eInvoice.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: { not: 'VOIDED' },
      },
      select: {
        id: true,
        invoiceNumber: true,
        date: true,
        customerName: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        invoiceType: true,
      },
      orderBy: { date: 'asc' },
    })

    const outputTaxBase = outputInvoices.reduce((s, i) => s + Number(i.subtotal), 0)
    const outputTax     = outputInvoices.reduce((s, i) => s + Number(i.taxAmount), 0)

    // ── 進項：InputTaxItem────────────────────────────────────
    const inputItems = await prisma.inputTaxItem.findMany({
      where: { taxPeriod: inputPeriodKey },
      select: {
        id: true,
        invoiceNo: true,
        invoiceDate: true,
        vendorName: true,
        sourceType: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
      },
      orderBy: { invoiceDate: 'asc' },
    })

    const inputTaxBase = inputItems.reduce((s, i) => s + Number(i.subtotal), 0)
    const inputTax     = inputItems.reduce((s, i) => s + Number(i.taxAmount), 0)

    const netTax = outputTax - inputTax  // 正數=應繳，負數=可退

    return NextResponse.json({
      period: periodLabel,
      startDate: startDate.toISOString().split('T')[0],
      endDate:   endDate.toISOString().split('T')[0],
      summary: {
        outputTaxBase: Math.round(outputTaxBase),
        outputTax:     Math.round(outputTax),
        inputTaxBase:  Math.round(inputTaxBase),
        inputTax:      Math.round(inputTax),
        netTax:        Math.round(netTax),
        status: netTax >= 0 ? 'PAYABLE' : 'REFUNDABLE',
      },
      detail: {
        outputInvoices,
        inputItems,
      },
    })
  } catch (error) {
    return handleApiError(error, 'vat-summary.GET')
  }
}
