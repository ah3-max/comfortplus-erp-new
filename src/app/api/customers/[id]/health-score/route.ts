import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { calculateHealthScore, updateCustomerHealthScore } from '@/lib/health-score'
import { handleApiError } from '@/lib/api-error'

/** GET /api/customers/[id]/health-score — preview score without saving */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const result = await calculateHealthScore(id)
    return NextResponse.json(result)
  } catch (e) {
    return handleApiError(e, 'customers.healthScore.get')
  }
}

/** POST /api/customers/[id]/health-score — recalculate & persist */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const result = await updateCustomerHealthScore(id)
    return NextResponse.json(result)
  } catch (e) {
    return handleApiError(e, 'customers.healthScore.post')
  }
}
