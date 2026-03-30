import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const FULL_INCLUDE = {
  customer:      { select: { id: true, name: true, code: true, phone: true } },
  order:         { select: { id: true, orderNo: true } },
  product:       { select: { id: true, name: true, sku: true } },
  reportedBy:    { select: { id: true, name: true } },
  assignedOwner: { select: { id: true, name: true } },
  attachments: {
    orderBy: { uploadedAt: 'desc' as const },
    include: { uploadedBy: { select: { id: true, name: true } } },
  },
  visitLogs: {
    orderBy: { visitDate: 'desc' as const },
    include: {
      visitedBy:   { select: { id: true, name: true } },
      attachments: { select: { id: true, fileUrl: true, attachmentType: true, isSensitive: true } },
    },
  },
  audioRecords: {
    orderBy: { createdAt: 'desc' as const },
    include: { uploadedBy: { select: { id: true, name: true } } },
  },
  trainingLogs: {
    orderBy: { trainingDate: 'desc' as const },
    include: {
      trainer:     { select: { id: true, name: true } },
      attachments: { select: { id: true, fileUrl: true, attachmentType: true } },
    },
  },
  actionItems: {
    orderBy: { createdAt: 'asc' as const },
    include: { owner: { select: { id: true, name: true } } },
  },
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const incident = await prisma.careIncident.findUnique({ where: { id }, include: FULL_INCLUDE })
    if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(incident)
  } catch (error) {
    return handleApiError(error, 'incidents.get')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const now  = new Date()

    const data: Record<string, unknown> = {
      assignedOwnerId:      body.assignedOwnerId      ?? undefined,
      severity:             body.severity             ?? undefined,
      status:               body.status               ?? undefined,
      symptomCategory:      body.symptomCategory      ?? undefined,
      issueSummary:         body.issueSummary         ?? undefined,
      detailedDescription:  body.detailedDescription  ?? undefined,
      suspectedCause:       body.suspectedCause       ?? undefined,
      immediateActionTaken: body.immediateActionTaken ?? undefined,
      requiresOnSiteVisit:  body.requiresOnSiteVisit  ?? undefined,
      scheduledVisitDate:   body.scheduledVisitDate ? new Date(body.scheduledVisitDate) : undefined,
      resolution:           body.resolution           ?? undefined,
      contactPerson:        body.contactPerson        ?? undefined,
    }

    if (body.status === 'RESOLVED') data.resolvedAt = body.resolvedAt ? new Date(body.resolvedAt) : now
    if (body.status === 'CLOSED') {
      data.closedAt        = body.closedAt ? new Date(body.closedAt) : now
      data.isKnowledgeBase = true   // auto-add to knowledge base
    }

    const incident = await prisma.careIncident.update({ where: { id }, data, include: FULL_INCLUDE })
    return NextResponse.json(incident)
  } catch (error) {
    return handleApiError(error, 'incidents.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await prisma.careIncident.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'incidents.delete')
  }
}
