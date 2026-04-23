import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/vendor-lookup?taxId=12345678
 *
 * 1. 查 Supplier.taxId → 回傳供應商名稱
 * 2. fallback: 查 InputTaxItem 最近一筆同統編 → 回傳歷史廠商名稱
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const taxId = new URL(req.url).searchParams.get('taxId')
    if (!taxId || !/^\d{8}$/.test(taxId)) {
      return NextResponse.json({ error: '統一編號需為 8 位數字' }, { status: 400 })
    }

    const supplier = await prisma.supplier.findFirst({
      where: { taxId, isActive: true },
      select: { id: true, name: true, code: true },
    })

    if (supplier) {
      return NextResponse.json({
        source: 'supplier',
        vendorName: supplier.name,
        supplierCode: supplier.code,
        supplierId: supplier.id,
      })
    }

    const recent = await prisma.inputTaxItem.findFirst({
      where: { vendorTaxId: taxId },
      orderBy: { createdAt: 'desc' },
      select: { vendorName: true },
    })

    if (recent) {
      return NextResponse.json({
        source: 'history',
        vendorName: recent.vendorName,
      })
    }

    return NextResponse.json({ source: 'none', vendorName: null })
  } catch (error) {
    return handleApiError(error, 'vendor-lookup.GET')
  }
}
