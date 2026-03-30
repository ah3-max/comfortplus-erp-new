import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getOverdueVisits } from '@/lib/order-prediction'
import { handleApiError } from '@/lib/api-error'

// GET /api/customers/visit-schedule
// Returns overdue/due visit list for the current sales rep
// ?salesRepId=xxx  (managers can query for specific reps)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const role = session.user.role as string
    const MANAGER_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER']

    let salesRepId: string
    if (MANAGER_ROLES.includes(role) && searchParams.get('salesRepId')) {
      salesRepId = searchParams.get('salesRepId')!
    } else {
      salesRepId = session.user.id
    }

    const results = await getOverdueVisits(salesRepId)
    return NextResponse.json(results)
  } catch (err) {
    return handleApiError(err, 'customers.visitSchedule')
  }
}
