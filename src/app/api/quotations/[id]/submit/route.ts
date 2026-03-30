import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Fetch quotation with items
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!quotation) {
      return NextResponse.json({ error: '找不到報價單' }, { status: 404 })
    }

    if (quotation.status !== 'DRAFT') {
      return NextResponse.json(
        { error: '只有草稿狀態的報價單才能送審' },
        { status: 400 },
      )
    }

    // Calculate max discount and total amount
    const maxDiscount =
      quotation.items.length > 0
        ? Math.max(...quotation.items.map((item) => Number(item.discount)))
        : 0

    const totalAmount = Number(quotation.totalAmount)

    // Determine approval levels needed
    const needsLevel1 = maxDiscount > 5 || totalAmount > 50000
    const needsLevel2 = maxDiscount > 15 || totalAmount > 200000

    // Build trigger reasons
    const triggerReasons: string[] = []
    if (maxDiscount > 5) {
      triggerReasons.push(`折扣 ${maxDiscount}% 超過門檻 5%`)
    }
    if (totalAmount > 50000) {
      triggerReasons.push(`金額 $${totalAmount.toLocaleString()} 超過門檻 $50,000`)
    }
    if (maxDiscount > 15) {
      triggerReasons.push(`折扣 ${maxDiscount}% 超過門檻 15%`)
    }
    if (totalAmount > 200000) {
      triggerReasons.push(`金額 $${totalAmount.toLocaleString()} 超過門檻 $200,000`)
    }

    // Deduplicate trigger reasons
    const uniqueReasons = [...new Set(triggerReasons)]

    if (!needsLevel1 && !needsLevel2) {
      // No approval needed — send directly
      await prisma.quotation.update({
        where: { id },
        data: { status: 'SENT' },
      })
      return NextResponse.json({ requiresApproval: false, status: 'SENT' })
    }

    // Build approval steps
    const levels: number[] = []
    const approvalSteps: {
      quotationId: string
      approvalLevel: number
      approverRole: string
      triggerReason: string
      status: string
    }[] = []

    if (needsLevel1) {
      levels.push(1)
      approvalSteps.push({
        quotationId: id,
        approvalLevel: 1,
        approverRole: 'SALES_MANAGER',
        triggerReason: uniqueReasons.join('；'),
        status: 'PENDING',
      })
    }

    if (needsLevel2) {
      levels.push(2)
      approvalSteps.push({
        quotationId: id,
        approvalLevel: 2,
        approverRole: 'GM',
        triggerReason: uniqueReasons.join('；'),
        status: 'PENDING',
      })
    }

    await prisma.$transaction(async (tx) => {
      // Delete existing PENDING approvals
      await tx.quotationApproval.deleteMany({
        where: { quotationId: id, status: 'PENDING' },
      })

      // Create approval steps
      await tx.quotationApproval.createMany({ data: approvalSteps })

      // Update quotation status
      await tx.quotation.update({
        where: { id },
        data: {
          status: 'PENDING_APPROVAL',
          requiresApproval: true,
          approvalStatus: 'PENDING',
        },
      })
    })

    return NextResponse.json({
      requiresApproval: true,
      status: 'PENDING_APPROVAL',
      levels,
    })
  } catch (error) {
    return handleApiError(error, 'quotations.submit')
  }
}
