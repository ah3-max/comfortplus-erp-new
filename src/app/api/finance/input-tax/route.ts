import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/input-tax
 * Query: period, sourceType, page, pageSize
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const period     = searchParams.get('period') ?? ''
    const sourceType = searchParams.get('sourceType') ?? ''
    const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize   = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'))

    const where = {
      ...(period     && { taxPeriod: period }),
      ...(sourceType && { sourceType: sourceType as 'CUSTOMS' | 'DOMESTIC_INVOICE' | 'RECEIPT' }),
    }

    const [data, total] = await Promise.all([
      prisma.inputTaxItem.findMany({
        where,
        include: { ap: { select: { id: true, invoiceNo: true } } },
        orderBy: [{ taxPeriod: 'desc' }, { invoiceDate: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.inputTaxItem.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'input-tax.GET')
  }
}

/**
 * POST /api/finance/input-tax
 * Body: { vendorName, vendorTaxId?, invoiceNo, invoiceDate, subtotal,
 *         taxAmount, totalAmount, sourceType, taxPeriod, attachmentUrl?, apId? }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!FINANCE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      vendorName, vendorTaxId, invoiceNo, invoiceDate,
      subtotal, taxAmount, totalAmount,
      sourceType, taxPeriod, attachmentUrl, apId,
    } = body

    if (!vendorName || !invoiceNo || !invoiceDate || !sourceType || !taxPeriod) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }
    if (!['CUSTOMS', 'DOMESTIC_INVOICE', 'RECEIPT'].includes(sourceType)) {
      return NextResponse.json({ error: '無效的 sourceType' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}$/.test(taxPeriod)) {
      return NextResponse.json({ error: 'taxPeriod 格式應為 YYYY-MM（如 2025-01）' }, { status: 400 })
    }

    // ── 統一編號格式驗證 ──
    if (vendorTaxId && !/^\d{8}$/.test(vendorTaxId)) {
      return NextResponse.json({ error: '統一編號格式錯誤（需8位數字）' }, { status: 400 })
    }

    // ── 自動試算：只提供含稅總額時，自動拆分未稅額+稅額 ──
    let finalSubtotal = subtotal != null ? Number(subtotal) : 0
    let finalTaxAmount = taxAmount != null ? Number(taxAmount) : 0
    let finalTotalAmount = totalAmount != null ? Number(totalAmount) : 0

    if (finalTotalAmount > 0 && finalSubtotal === 0 && finalTaxAmount === 0) {
      finalTaxAmount = Math.round(finalTotalAmount / 1.05 * 0.05)
      finalSubtotal = finalTotalAmount - finalTaxAmount
    } else if (finalSubtotal > 0 && finalTaxAmount > 0 && finalTotalAmount === 0) {
      finalTotalAmount = finalSubtotal + finalTaxAmount
    }

    // ── 金額容差驗證（允許四捨五入差 ±1 元） ──
    if (finalTotalAmount > 0 && finalSubtotal > 0) {
      const diff = Math.abs(finalSubtotal + finalTaxAmount - finalTotalAmount)
      if (diff > 1) {
        return NextResponse.json(
          { error: `金額不一致：未稅額(${finalSubtotal}) + 稅額(${finalTaxAmount}) ≠ 含稅總額(${finalTotalAmount})` },
          { status: 400 },
        )
      }
    }

    // ── 重複發票檢查 ──
    if (invoiceNo && vendorTaxId) {
      const dup = await prisma.inputTaxItem.findFirst({
        where: { invoiceNo, vendorTaxId, taxPeriod },
        select: { id: true },
      })
      if (dup) {
        return NextResponse.json(
          { error: `此發票已登錄（${vendorTaxId} / ${invoiceNo} / ${taxPeriod}）`, duplicate: true, existingId: dup.id },
          { status: 409 },
        )
      }
    }

    const item = await prisma.inputTaxItem.create({
      data: {
        vendorName,
        vendorTaxId: vendorTaxId ?? null,
        invoiceNo,
        invoiceDate: new Date(invoiceDate),
        subtotal:    finalSubtotal,
        taxAmount:   finalTaxAmount,
        totalAmount: finalTotalAmount,
        sourceType,
        taxPeriod,
        attachmentUrl: attachmentUrl ?? null,
        apId:          apId ?? null,
      },
    })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'input-tax', action: 'CREATE', entityType: 'InputTaxItem',
      entityId: item.id, entityLabel: `${invoiceNo} ${vendorName} ${taxPeriod}`,
    }).catch(() => {})

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'input-tax.POST')
  }
}
