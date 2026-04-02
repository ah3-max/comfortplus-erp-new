import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]
const MAX_SIZE = 20 * 1024 * 1024 // 20MB

const DOC_TYPE_LABELS: Record<string, string> = {
  BL:           '提單 (B/L)',
  INVOICE:      '商業發票',
  PACKING_LIST: '裝箱單',
  CERT_ORIGIN:  '產地證明',
  PHYTO:        '植物檢疫證',
  COA:          '品質證書 (CoA)',
  CUSTOMS:      '報關文件',
  OTHER:        '其他',
}

interface DocEntry {
  type: string
  url: string
  fileName: string
  uploadedAt: string
}

/**
 * POST /api/sea-freight/[id]/documents
 * L-13: Upload sea freight documents (B/L, invoice, packing list, COO, etc.)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const freight = await prisma.seaFreight.findUnique({
      where: { id },
      select: { id: true, documentsJson: true },
    })
    if (!freight) return NextResponse.json({ error: '找不到海運記錄' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const docType = (formData.get('docType') as string) || 'OTHER'

    if (!file) return NextResponse.json({ error: '請上傳文件' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: '文件不可超過 20MB' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|xls|xlsx)$/i)) {
      return NextResponse.json({ error: '僅接受 PDF、圖片、Excel 格式' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
    const safeName = `freight-${id}-${docType}-${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents')
    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, safeName), buffer)

    const docUrl = `/uploads/documents/${safeName}`
    const existing = (freight.documentsJson as unknown as DocEntry[]) ?? []

    const updated = await prisma.seaFreight.update({
      where: { id },
      data: {
        documentsJson: [
          ...existing,
          { type: docType, url: docUrl, fileName: file.name, uploadedAt: new Date().toISOString() },
        ] as unknown as never,
        // Also update legacy single-file fields for backward compatibility
        ...(docType === 'PACKING_LIST' ? { packingListAttachment: docUrl } : {}),
        ...(docType === 'COA' ? { coaAttachment: docUrl } : {}),
        ...(docType === 'CERT_ORIGIN' ? { originCertAttachment: docUrl } : {}),
      },
      select: { id: true, documentsJson: true },
    })

    return NextResponse.json({
      url: docUrl,
      type: docType,
      typeLabel: DOC_TYPE_LABELS[docType] ?? docType,
      fileName: file.name,
      documentsJson: updated.documentsJson,
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'seaFreight.documents.upload')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const { url } = await req.json()

    const freight = await prisma.seaFreight.findUnique({ where: { id }, select: { documentsJson: true } })
    if (!freight) return NextResponse.json({ error: '找不到海運記錄' }, { status: 404 })

    const existing = (freight.documentsJson as unknown as DocEntry[]) ?? []
    const updated = await prisma.seaFreight.update({
      where: { id },
      data: { documentsJson: existing.filter(d => d.url !== url) as unknown as never },
      select: { id: true, documentsJson: true },
    })

    return NextResponse.json({ documentsJson: updated.documentsJson })
  } catch (error) {
    return handleApiError(error, 'seaFreight.documents.delete')
  }
}
