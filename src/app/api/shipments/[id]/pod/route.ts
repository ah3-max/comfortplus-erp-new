import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/shipments/[id]/pod
 * Returns proof-of-delivery record including photo URL
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const pod = await prisma.proofOfDelivery.findFirst({
      where: { shipmentId: id },
      select: {
        id: true,
        signerName: true,
        signedAt: true,
        photoUrl: true,
        anomalyNote: true,
        deliveredAt: true,
        gpsLat: true,
        gpsLng: true,
        isCompleted: true,
        customerNotified: true,
        salesNotified: true,
      },
    })

    if (!pod) return NextResponse.json({ pod: null, message: '尚無簽收記錄' })

    return NextResponse.json({ pod })
  } catch (error) {
    return handleApiError(error, 'shipments.pod.GET')
  }
}
