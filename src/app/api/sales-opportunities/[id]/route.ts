import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const opp = await prisma.salesOpportunity.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, code: true, type: true } },
        owner: { select: { id: true, name: true } },
        followUpLogs: {
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { logDate: 'desc' },
          take: 20,
        },
      },
    })
    if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(opp)
  } catch (error) {
    return handleApiError(error, 'sales-opportunities.GET')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const opp = await prisma.salesOpportunity.update({
      where: { id },
      data: {
        title:               body.title               ?? undefined,
        stage:               body.stage               ?? undefined,
        probability:         body.probability         !== undefined ? Number(body.probability)  : undefined,
        expectedAmount:      body.expectedAmount       !== undefined ? (body.expectedAmount ? Number(body.expectedAmount) : null) : undefined,
        expectedCloseDate:   body.expectedCloseDate    !== undefined ? (body.expectedCloseDate ? new Date(body.expectedCloseDate) : null) : undefined,
        productInterest:     body.productInterest      !== undefined ? (body.productInterest || null) : undefined,
        competitorInfo:      body.competitorInfo       !== undefined ? (body.competitorInfo || null) : undefined,
        lostReason:          body.lostReason           !== undefined ? (body.lostReason || null) : undefined,
        notes:               body.notes               !== undefined ? (body.notes || null) : undefined,
        isActive:            body.isActive             !== undefined ? Boolean(body.isActive) : undefined,
        ownerId:             body.ownerId              !== undefined ? (body.ownerId || null) : undefined,
      },
      include: {
        customer: { select: { id: true, name: true, code: true } },
        owner:    { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(opp)
  } catch (error) {
    return handleApiError(error, 'sales-opportunities.PUT')
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const { stage, probability, expectedAmount, expectedCloseDate,
            productInterest, competitorInfo, lostReason, notes, isActive, title } = body

    const data: Record<string, unknown> = { updatedAt: new Date() }
    if (stage !== undefined) data.stage = stage
    if (probability !== undefined) data.probability = probability
    if (expectedAmount !== undefined) data.expectedAmount = expectedAmount ? Number(expectedAmount) : null
    if (expectedCloseDate !== undefined) data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null
    if (productInterest !== undefined) data.productInterest = productInterest
    if (competitorInfo !== undefined) data.competitorInfo = competitorInfo
    if (lostReason !== undefined) data.lostReason = lostReason
    if (notes !== undefined) data.notes = notes
    if (isActive !== undefined) data.isActive = isActive
    if (title !== undefined) data.title = title
    if (stage === 'LOST' || stage === 'REGULAR_ORDER') data.closedAt = new Date()

    const opp = await prisma.salesOpportunity.update({ where: { id }, data })
    return NextResponse.json(opp)
  } catch (error) {
    return handleApiError(error, 'sales-opportunities.PATCH')
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const opp = await prisma.salesOpportunity.findUnique({ where: { id }, select: { stage: true } })
    if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const allowedStages = ['PROSPECTING', 'LOST']
    if (!allowedStages.includes(opp.stage)) {
      return NextResponse.json({ error: '只有「潛在開發」或「已失單」的商機才能刪除' }, { status: 400 })
    }

    await prisma.salesOpportunity.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, 'sales-opportunities.DELETE')
  }
}
