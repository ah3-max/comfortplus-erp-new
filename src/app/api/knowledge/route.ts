import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/knowledge - Search knowledge base
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const entryType = searchParams.get('type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  const where: any = {}
  if (entryType) where.entryType = entryType
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { tags: { hasSome: [q] } },
      { relatedSkus: { hasSome: [q] } },
    ]
  }

  const [entries, total] = await Promise.all([
    prisma.knowledgeBaseEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { incident: { select: { id: true, incidentNo: true, severity: true, status: true } } },
    }),
    prisma.knowledgeBaseEntry.count({ where }),
  ])

  // Get stats
  const stats = await prisma.knowledgeBaseEntry.groupBy({
    by: ['entryType'],
    _count: { id: true },
  })

  return NextResponse.json({ entries, total, stats })
}

// POST /api/knowledge - Create knowledge base entry (or auto-generate from closed incident)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Auto-generate from incident
  if (body.incidentId) {
    const incident = await prisma.careIncident.findUnique({
      where: { id: body.incidentId },
      include: {
        customer: { select: { type: true } },
        product: { select: { sku: true } },
      },
    })
    if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 })

    const entry = await prisma.knowledgeBaseEntry.create({
      data: {
        incidentId: incident.id,
        entryType: 'INCIDENT_CASE',
        title: `[${incident.incidentNo}] ${incident.issueSummary}`,
        summary: [incident.detailedDescription, incident.resolution].filter(Boolean).join('\n\n解決方案：'),
        tags: [incident.incidentType, incident.symptomCategory].filter(Boolean) as string[],
        relatedSkus: incident.product?.sku ? [incident.product.sku] : [],
        relatedBatchNos: incident.batchNo ? [incident.batchNo] : [],
        customerTypes: incident.customer?.type ? [incident.customer.type] : [],
        symptomCodes: incident.symptomCategory ? [incident.symptomCategory] : [],
      },
    })
    return NextResponse.json(entry, { status: 201 })
  }

  // Manual create
  const entry = await prisma.knowledgeBaseEntry.create({
    data: {
      entryType: body.entryType ?? 'PRODUCT_FAQ',
      title: body.title,
      summary: body.summary,
      tags: body.tags ?? [],
      relatedSkus: body.relatedSkus ?? [],
      relatedBatchNos: body.relatedBatchNos ?? [],
      customerTypes: body.customerTypes ?? [],
      symptomCodes: body.symptomCodes ?? [],
    },
  })
  return NextResponse.json(entry, { status: 201 })
}
