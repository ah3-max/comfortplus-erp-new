import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import {
  mapEInvoiceToF0401,
  validateF0401,
  type MigValidationError,
} from '@/lib/einvoice-mig'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * POST /api/finance/einvoice-turnkey/validate
 *
 * 驗證發票資料是否符合 MIG V4.1 規格
 *
 * Body: { invoiceIds: string[] }
 *
 * Returns: 每張發票的驗證結果
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { invoiceIds } = await req.json()

    if (!invoiceIds || invoiceIds.length === 0) {
      return NextResponse.json({ error: '請選擇至少一張發票' }, { status: 400 })
    }

    const companyTaxId = process.env.COMPANY_TAX_ID ?? '00000000'
    const companyName = process.env.COMPANY_NAME ?? '舒適佳企業有限公司'
    const companyAddress = process.env.COMPANY_ADDRESS ?? ''

    const invoices = await prisma.eInvoice.findMany({
      where: { id: { in: invoiceIds } },
      include: {
        salesInvoice: {
          include: {
            items: {
              select: {
                productName: true,
                specification: true,
                quantity: true,
                unit: true,
                unitPrice: true,
                subtotal: true,
                taxAmount: true,
                totalAmount: true,
                memo: true,
              },
            },
          },
        },
      },
    })

    const results: Array<{
      invoiceId: string
      invoiceNumber: string
      valid: boolean
      errors: MigValidationError[]
      warnings: string[]
    }> = []

    for (const invoice of invoices) {
      const warnings: string[] = []

      if (invoice.status === 'VOIDED') {
        warnings.push('發票已作廢')
      }
      if (invoice.transmitStatus === 'TRANSMITTED') {
        warnings.push('發票已傳送至平台')
      }

      const existingLog = await prisma.eInvoiceTurnkeyLog.findFirst({
        where: {
          eInvoiceId: invoice.id,
          messageType: 'F0401',
          status: { in: ['GENERATED', 'UPLOADED', 'PROCESSING', 'SUCCESS'] },
        },
      })
      if (existingLog) {
        warnings.push(`已有 F0401 記錄（狀態：${existingLog.status}）`)
      }

      const f0401Data = mapEInvoiceToF0401(
        {
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          invoiceType: invoice.invoiceType as 'B2B' | 'B2C',
          subtotal: Number(invoice.subtotal),
          taxAmount: Number(invoice.taxAmount),
          totalAmount: Number(invoice.totalAmount),
          buyerTaxId: invoice.buyerTaxId,
          buyerName: invoice.buyerName,
          customerName: invoice.customerName,
          salesInvoice: invoice.salesInvoice
            ? {
                items: invoice.salesInvoice.items.map(item => ({
                  productName: item.productName,
                  specification: item.specification,
                  quantity: Number(item.quantity),
                  unit: item.unit,
                  unitPrice: Number(item.unitPrice),
                  subtotal: Number(item.subtotal),
                  taxAmount: Number(item.taxAmount),
                  totalAmount: Number(item.totalAmount),
                  memo: item.memo,
                })),
              }
            : null,
        },
        {
          taxId: companyTaxId,
          name: companyName,
          address: companyAddress || undefined,
        },
      )

      const errors = validateF0401(f0401Data)

      if (invoice.invoiceType === 'B2B' && (!invoice.buyerTaxId || invoice.buyerTaxId === '00000000')) {
        warnings.push('B2B 發票缺少買方統編')
      }
      if (!invoice.salesInvoice?.items?.length) {
        warnings.push('無銷貨單明細，將使用簡化格式')
      }

      results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        valid: errors.length === 0,
        errors,
        warnings,
      })
    }

    const validCount = results.filter(r => r.valid).length

    return NextResponse.json({
      total: results.length,
      valid: validCount,
      invalid: results.length - validCount,
      results,
    })
  } catch (error) {
    return handleApiError(error, 'einvoice-turnkey.validate')
  }
}
