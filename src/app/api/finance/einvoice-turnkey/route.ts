import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'
import { randomUUID } from 'crypto'
import {
  buildF0401Xml, buildF0501Xml, buildG0401Xml, buildG0501Xml,
  mapEInvoiceToF0401,
  validateF0401, validateF0501, validateG0401,
  type F0501Data, type G0401Data, type G0501Data,
  type MigMessageType,
} from '@/lib/einvoice-mig'
import {
  buildInvoiceEnvelope,
  generateTurnkeyFileName,
  formatTurnkeyFileName,
} from '@/lib/einvoice-turnkey'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/einvoice-turnkey
 *
 * 查詢 Turnkey 傳輸記錄
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const messageType = searchParams.get('messageType') ?? ''
    const status = searchParams.get('status') ?? ''
    const search = searchParams.get('search') ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

    const where = {
      ...(messageType && { messageType: messageType as never }),
      ...(status && { status: status as never }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
          { messageId: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [logs, total] = await Promise.all([
      prisma.eInvoiceTurnkeyLog.findMany({
        where,
        include: {
          eInvoice: { select: { id: true, invoiceNumber: true, status: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.eInvoiceTurnkeyLog.count({ where }),
    ])

    return NextResponse.json({
      data: logs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'einvoice-turnkey.GET')
  }
}

/**
 * POST /api/finance/einvoice-turnkey
 *
 * 產生 MIG V4.1 XML 並建立 Turnkey 記錄
 *
 * Body:
 *   { action: "generate", invoiceIds: string[] }           → F0401 批次產生
 *   { action: "void", invoiceId: string }                  → F0501 作廢
 *   { action: "credit-note", invoiceId: string }           → G0401 折讓
 *   { action: "void-credit-note", invoiceId: string }      → G0501 折讓作廢
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { action } = body
    const companyTaxId = process.env.COMPANY_TAX_ID ?? '00000000'
    const companyName = process.env.COMPANY_NAME ?? '舒適佳企業有限公司'
    const companyAddress = process.env.COMPANY_ADDRESS ?? ''

    switch (action) {
      case 'generate':
        return handleGenerate(body.invoiceIds, { companyTaxId, companyName, companyAddress }, session)
      case 'void':
        return handleVoid(body.invoiceId, companyTaxId, session)
      case 'credit-note':
        return handleCreditNote(body.invoiceId, companyTaxId, companyName, session)
      case 'void-credit-note':
        return handleVoidCreditNote(body.invoiceId, companyTaxId, session)
      default:
        return NextResponse.json({ error: `不支援的操作：${action}` }, { status: 400 })
    }
  } catch (error) {
    return handleApiError(error, 'einvoice-turnkey.POST')
  }
}

// ── F0401 Generate ─────────────────────────────────────

async function handleGenerate(
  invoiceIds: string[],
  seller: { companyTaxId: string; companyName: string; companyAddress: string },
  session: { user: { id: string; name?: string | null; role?: string } },
) {
  if (!invoiceIds || invoiceIds.length === 0) {
    return NextResponse.json({ error: '請選擇至少一張發票' }, { status: 400 })
  }

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

  if (invoices.length === 0) {
    return NextResponse.json({ error: '找不到指定的發票' }, { status: 404 })
  }

  const results: Array<{
    invoiceNumber: string
    messageId: string
    fileName: string
    success: boolean
    errors?: Array<{ field: string; message: string }>
  }> = []

  for (const invoice of invoices) {
    const messageId = randomUUID()
    const messageType: MigMessageType = 'F0401'

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
        taxId: seller.companyTaxId,
        name: seller.companyName,
        address: seller.companyAddress || undefined,
      },
    )

    const validationErrors = validateF0401(f0401Data)
    if (validationErrors.length > 0) {
      results.push({
        invoiceNumber: invoice.invoiceNumber,
        messageId,
        fileName: '',
        success: false,
        errors: validationErrors,
      })
      continue
    }

    const invoiceXml = buildF0401Xml(f0401Data)
    const envelopeXml = buildInvoiceEnvelope({
      fromPartyId: seller.companyTaxId,
      toPartyId: invoice.buyerTaxId || '0000000000',
      messageType,
      invoiceXml,
    })

    const fileInfo = generateTurnkeyFileName(messageType)
    const fileName = formatTurnkeyFileName(fileInfo)

    await prisma.eInvoiceTurnkeyLog.create({
      data: {
        messageId,
        messageType: 'F0401',
        invoiceNumber: invoice.invoiceNumber,
        eInvoiceId: invoice.id,
        sellerTaxId: seller.companyTaxId,
        buyerTaxId: invoice.buyerTaxId ?? '00000000',
        fileName,
        xmlContent: envelopeXml,
        status: 'GENERATED',
        createdById: session.user.id,
      },
    })

    results.push({
      invoiceNumber: invoice.invoiceNumber,
      messageId,
      fileName,
      success: true,
    })
  }

  const successCount = results.filter(r => r.success).length

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? '',
    userRole: session.user.role ?? '',
    module: 'einvoice-turnkey',
    action: 'GENERATE_F0401',
    entityType: 'EInvoiceTurnkeyLog',
    entityId: '',
    entityLabel: `批次產生 ${successCount}/${invoices.length} 筆 F0401`,
  }).catch(() => {})

  return NextResponse.json({
    total: invoices.length,
    success: successCount,
    failed: invoices.length - successCount,
    results,
  })
}

// ── F0501 Void ─────────────────────────────────────────

async function handleVoid(
  invoiceId: string,
  companyTaxId: string,
  session: { user: { id: string; name?: string | null; role?: string } },
) {
  if (!invoiceId) {
    return NextResponse.json({ error: '請指定發票 ID' }, { status: 400 })
  }

  const invoice = await prisma.eInvoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return NextResponse.json({ error: '找不到發票' }, { status: 404 })
  if (invoice.status !== 'VOIDED') {
    return NextResponse.json({ error: '發票尚未作廢，請先在系統作廢後再產生 XML' }, { status: 400 })
  }

  const now = new Date()
  const messageId = randomUUID()

  const data: F0501Data = {
    cancelInvoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.date,
    buyerIdentifier: invoice.buyerTaxId ?? '00000000',
    sellerIdentifier: companyTaxId,
    cancelDate: invoice.voidedAt ?? now,
    cancelTime: invoice.voidedAt ?? now,
    cancelReason: invoice.voidReason ?? '作廢',
  }

  const validationErrors = validateF0501(data)
  if (validationErrors.length > 0) {
    return NextResponse.json({ errors: validationErrors }, { status: 400 })
  }

  const invoiceXml = buildF0501Xml(data)
  const envelopeXml = buildInvoiceEnvelope({
    fromPartyId: companyTaxId,
    toPartyId: invoice.buyerTaxId || '0000000000',
    messageType: 'F0501',
    invoiceXml,
  })

  const fileInfo = generateTurnkeyFileName('F0501')
  const fileName = formatTurnkeyFileName(fileInfo)

  const log = await prisma.eInvoiceTurnkeyLog.create({
    data: {
      messageId,
      messageType: 'F0501',
      invoiceNumber: invoice.invoiceNumber,
      eInvoiceId: invoice.id,
      sellerTaxId: companyTaxId,
      buyerTaxId: invoice.buyerTaxId ?? '00000000',
      fileName,
      xmlContent: envelopeXml,
      status: 'GENERATED',
      createdById: session.user.id,
    },
  })

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? '',
    userRole: session.user.role ?? '',
    module: 'einvoice-turnkey',
    action: 'GENERATE_F0501',
    entityType: 'EInvoiceTurnkeyLog',
    entityId: log.id,
    entityLabel: `作廢 ${invoice.invoiceNumber}`,
  }).catch(() => {})

  return NextResponse.json({
    messageId,
    fileName,
    invoiceNumber: invoice.invoiceNumber,
    messageType: 'F0501',
  })
}

// ── G0401 Credit Note ──────────────────────────────────

async function handleCreditNote(
  invoiceId: string,
  companyTaxId: string,
  companyName: string,
  session: { user: { id: string; name?: string | null; role?: string } },
) {
  if (!invoiceId) {
    return NextResponse.json({ error: '請指定發票 ID' }, { status: 400 })
  }

  const invoice = await prisma.eInvoice.findUnique({
    where: { id: invoiceId },
    include: { customer: { select: { name: true } } },
  })
  if (!invoice) return NextResponse.json({ error: '找不到發票' }, { status: 404 })
  if (invoice.status !== 'CREDIT_NOTE') {
    return NextResponse.json({ error: '發票尚未開立折讓，請先在系統建立折讓後再產生 XML' }, { status: 400 })
  }
  if (!invoice.creditNoteNumber) {
    return NextResponse.json({ error: '缺少折讓證明單號碼' }, { status: 400 })
  }

  const messageId = randomUUID()
  const creditAmount = Number(invoice.creditNoteAmount ?? 0)
  const creditTax = Math.round(creditAmount * 5 / 105)
  const creditSubtotal = creditAmount - creditTax

  const data: G0401Data = {
    allowanceNumber: invoice.creditNoteNumber,
    allowanceDate: invoice.creditNoteDate ?? new Date(),
    seller: { identifier: companyTaxId, name: companyName },
    buyer: {
      identifier: invoice.buyerTaxId ?? '00000000',
      name: invoice.buyerName ?? invoice.customer.name,
    },
    allowanceType: '2',
    details: [{
      originalInvoiceDate: invoice.date,
      originalInvoiceNumber: invoice.invoiceNumber,
      originalSequenceNumber: '1',
      originalDescription: '折讓',
      quantity: 1,
      unitPrice: creditSubtotal,
      amount: creditSubtotal,
      tax: creditTax,
      allowanceSequenceNumber: '1',
      taxType: '1',
    }],
    taxAmount: creditTax,
    totalAmount: creditAmount,
  }

  const validationErrors = validateG0401(data)
  if (validationErrors.length > 0) {
    return NextResponse.json({ errors: validationErrors }, { status: 400 })
  }

  const invoiceXml = buildG0401Xml(data)
  const envelopeXml = buildInvoiceEnvelope({
    fromPartyId: companyTaxId,
    toPartyId: invoice.buyerTaxId || '0000000000',
    messageType: 'G0401',
    invoiceXml,
  })

  const fileInfo = generateTurnkeyFileName('G0401')
  const fileName = formatTurnkeyFileName(fileInfo)

  const log = await prisma.eInvoiceTurnkeyLog.create({
    data: {
      messageId,
      messageType: 'G0401',
      invoiceNumber: invoice.invoiceNumber,
      eInvoiceId: invoice.id,
      sellerTaxId: companyTaxId,
      buyerTaxId: invoice.buyerTaxId ?? '00000000',
      fileName,
      xmlContent: envelopeXml,
      status: 'GENERATED',
      createdById: session.user.id,
    },
  })

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? '',
    userRole: session.user.role ?? '',
    module: 'einvoice-turnkey',
    action: 'GENERATE_G0401',
    entityType: 'EInvoiceTurnkeyLog',
    entityId: log.id,
    entityLabel: `折讓 ${invoice.creditNoteNumber}`,
  }).catch(() => {})

  return NextResponse.json({
    messageId,
    fileName,
    invoiceNumber: invoice.invoiceNumber,
    creditNoteNumber: invoice.creditNoteNumber,
    messageType: 'G0401',
  })
}

// ── G0501 Void Credit Note ─────────────────────────────

async function handleVoidCreditNote(
  invoiceId: string,
  companyTaxId: string,
  session: { user: { id: string; name?: string | null; role?: string } },
) {
  if (!invoiceId) {
    return NextResponse.json({ error: '請指定發票 ID' }, { status: 400 })
  }

  const invoice = await prisma.eInvoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return NextResponse.json({ error: '找不到發票' }, { status: 404 })
  if (!invoice.creditNoteNumber) {
    return NextResponse.json({ error: '該發票無折讓記錄' }, { status: 400 })
  }

  const now = new Date()
  const messageId = randomUUID()

  const data: G0501Data = {
    cancelAllowanceNumber: invoice.creditNoteNumber,
    allowanceDate: invoice.creditNoteDate ?? now,
    buyerIdentifier: invoice.buyerTaxId ?? '00000000',
    sellerIdentifier: companyTaxId,
    cancelDate: now,
    cancelTime: now,
    cancelReason: '折讓作廢',
  }

  const invoiceXml = buildG0501Xml(data)
  const envelopeXml = buildInvoiceEnvelope({
    fromPartyId: companyTaxId,
    toPartyId: invoice.buyerTaxId || '0000000000',
    messageType: 'G0501',
    invoiceXml,
  })

  const fileInfo = generateTurnkeyFileName('G0501')
  const fileName = formatTurnkeyFileName(fileInfo)

  const log = await prisma.eInvoiceTurnkeyLog.create({
    data: {
      messageId,
      messageType: 'G0501',
      invoiceNumber: invoice.invoiceNumber,
      eInvoiceId: invoice.id,
      sellerTaxId: companyTaxId,
      buyerTaxId: invoice.buyerTaxId ?? '00000000',
      fileName,
      xmlContent: envelopeXml,
      status: 'GENERATED',
      createdById: session.user.id,
    },
  })

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? '',
    userRole: session.user.role ?? '',
    module: 'einvoice-turnkey',
    action: 'GENERATE_G0501',
    entityType: 'EInvoiceTurnkeyLog',
    entityId: log.id,
    entityLabel: `折讓作廢 ${invoice.creditNoteNumber}`,
  }).catch(() => {})

  return NextResponse.json({
    messageId,
    fileName,
    invoiceNumber: invoice.invoiceNumber,
    creditNoteNumber: invoice.creditNoteNumber,
    messageType: 'G0501',
  })
}
