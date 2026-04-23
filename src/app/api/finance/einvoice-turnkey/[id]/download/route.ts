import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/finance/einvoice-turnkey/[id]/download
 *
 * 下載已產生的 Turnkey XML 檔案
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const log = await prisma.eInvoiceTurnkeyLog.findUnique({
      where: { id },
      select: { fileName: true, xmlContent: true, messageType: true, invoiceNumber: true },
    })

    if (!log) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })
    if (!log.xmlContent) return NextResponse.json({ error: 'XML 內容不存在' }, { status: 404 })

    const fileName = log.fileName || `${log.messageType}_${log.invoiceNumber}.xml`

    return new Response(log.xmlContent, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    return handleApiError(error, 'einvoice-turnkey.download')
  }
}
