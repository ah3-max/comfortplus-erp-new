import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { updateOrderPrediction } from '@/lib/order-prediction'
import { handleApiError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

// POST /api/customers/predict-next-order
// body: { customerId } or { all: true }
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (body.all) {
      const customers = await prisma.customer.findMany({
        where: { isActive: true },
        select: { id: true },
      })
      let success = 0; let failed = 0
      for (const c of customers) {
        try { await updateOrderPrediction(c.id); success++ }
        catch { failed++ }
      }
      return NextResponse.json({ success, failed, total: customers.length })
    }

    if (!body.customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 })
    }

    const result = await updateOrderPrediction(body.customerId)
    return NextResponse.json(result)
  } catch (err) {
    return handleApiError(err, 'customers.predictNextOrder')
  }
}
