import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/sea-freight/[id]/customs-steps
 * Returns customs clearance step-by-step progress checklist
 *
 * PUT /api/sea-freight/[id]/customs-steps
 * Update customs dates/status to advance the flow
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const sf = await prisma.seaFreight.findUnique({
      where: { id },
      select: {
        id: true,
        freightNo: true,
        customsStatus: true,
        customsDeclareDate: true,
        customsReleasedDate: true,
        customsCompletedDate: true,
        customsDeclarationNo: true,
        customsBroker: true,
        inspectionType: true,
        inspectionResult: true,
        blAttachment: true,
        customsDocAttachment: true,
        documentsStatus: true,
        dutyAmount: true,
        vatAmount: true,
        actualArrival: true,
        containerPickupDate: true,
        devanningDate: true,
        warehouseInDate: true,
      },
    })

    if (!sf) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Build step checklist
    const steps = [
      {
        step: 1,
        title: '船到港',
        description: '貨輪實際抵達目的港',
        completedAt: sf.actualArrival,
        isCompleted: !!sf.actualArrival,
        isRequired: true,
      },
      {
        step: 2,
        title: '文件齊備',
        description: '提單/商業發票/裝箱單等文件確認',
        completedAt: null,
        isCompleted: sf.documentsStatus === 'COMPLETE',
        isRequired: true,
        note: sf.documentsStatus,
      },
      {
        step: 3,
        title: '向海關報關',
        description: '遞交報關申報資料',
        completedAt: sf.customsDeclareDate,
        isCompleted: !!sf.customsDeclareDate,
        isRequired: true,
        note: sf.customsDeclarationNo ? `報關單號：${sf.customsDeclarationNo}` : undefined,
      },
      {
        step: 4,
        title: '海關審查',
        description: `${sf.inspectionType ? `查驗方式：${sf.inspectionType}` : '等待海關審查'}`,
        completedAt: null,
        isCompleted: ['RELEASED', 'COMPLETED'].includes(sf.customsStatus),
        isRequired: true,
        note: sf.inspectionResult ?? undefined,
      },
      {
        step: 5,
        title: '海關放行',
        description: '通關完成，貨物可提取',
        completedAt: sf.customsReleasedDate,
        isCompleted: !!sf.customsReleasedDate,
        isRequired: true,
      },
      {
        step: 6,
        title: '提領貨柜',
        description: '前往港口提領貨櫃',
        completedAt: sf.containerPickupDate,
        isCompleted: !!sf.containerPickupDate,
        isRequired: true,
      },
      {
        step: 7,
        title: '拆櫃',
        description: '貨櫃拆箱作業',
        completedAt: sf.devanningDate,
        isCompleted: !!sf.devanningDate,
        isRequired: false,
      },
      {
        step: 8,
        title: '入倉',
        description: '貨品入庫完成',
        completedAt: sf.warehouseInDate,
        isCompleted: !!sf.warehouseInDate,
        isRequired: true,
      },
    ]

    const completedCount = steps.filter(s => s.isCompleted).length
    const currentStep = steps.find(s => !s.isCompleted)?.step ?? steps.length + 1

    return NextResponse.json({
      freightNo: sf.freightNo,
      customsStatus: sf.customsStatus,
      customsBroker: sf.customsBroker,
      dutyAmount: sf.dutyAmount ? Number(sf.dutyAmount) : null,
      vatAmount: sf.vatAmount ? Number(sf.vatAmount) : null,
      completedSteps: completedCount,
      totalSteps: steps.length,
      currentStep,
      progressPct: Math.round((completedCount / steps.length) * 100),
      steps,
    })
  } catch (error) {
    return handleApiError(error, 'seaFreight.customsSteps.GET')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.seaFreight.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.seaFreight.update({
      where: { id },
      data: {
        ...(body.customsStatus        && { customsStatus: body.customsStatus }),
        ...(body.customsDeclareDate   && { customsDeclareDate: new Date(body.customsDeclareDate) }),
        ...(body.customsReleasedDate  && { customsReleasedDate: new Date(body.customsReleasedDate) }),
        ...(body.customsCompletedDate && { customsCompletedDate: new Date(body.customsCompletedDate) }),
        ...(body.customsDeclarationNo !== undefined && { customsDeclarationNo: body.customsDeclarationNo || null }),
        ...(body.inspectionType       !== undefined && { inspectionType: body.inspectionType || null }),
        ...(body.inspectionResult     !== undefined && { inspectionResult: body.inspectionResult || null }),
        ...(body.documentsStatus      !== undefined && { documentsStatus: body.documentsStatus || null }),
        ...(body.containerPickupDate  && { containerPickupDate: new Date(body.containerPickupDate) }),
        ...(body.devanningDate        && { devanningDate: new Date(body.devanningDate) }),
        ...(body.warehouseInDate      && { warehouseInDate: new Date(body.warehouseInDate) }),
        ...(body.dutyAmount           !== undefined && { dutyAmount: body.dutyAmount != null ? Number(body.dutyAmount) : null }),
        ...(body.vatAmount            !== undefined && { vatAmount: body.vatAmount != null ? Number(body.vatAmount) : null }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'seaFreight.customsSteps.PUT')
  }
}
