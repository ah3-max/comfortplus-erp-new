import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET /api/finance/e-invoice-ranges/next-number?year=114&period=03-04
// Returns the next available invoice number from the active range
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year'))
    const period = searchParams.get('period') ?? ''

    if (!year || !period) {
      return NextResponse.json({ error: 'year 和 period 為必填' }, { status: 400 })
    }

    const range = await prisma.eInvoiceNumberRange.findFirst({
      where: { year, period, isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!range) {
      return NextResponse.json({ error: '找不到可用的發票字軌' }, { status: 404 })
    }

    const nextNum = range.currentNumber + 1
    if (nextNum > range.endNumber) {
      return NextResponse.json({ error: '字軌號碼已用盡' }, { status: 409 })
    }

    const invoiceNumber = `${range.prefix}${String(nextNum).padStart(8, '0')}`
    return NextResponse.json({ invoiceNumber, rangeId: range.id, number: nextNum, remaining: range.endNumber - nextNum })
  } catch (error) {
    return handleApiError(error, 'e-invoice-ranges.next-number')
  }
}

// POST /api/finance/e-invoice-ranges/next-number
// Atomically assign the next number (use inside invoice creation)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { year, period } = body

    if (!year || !period) {
      return NextResponse.json({ error: 'year 和 period 為必填' }, { status: 400 })
    }

    // Use transaction to atomically reserve the number
    const result = await prisma.$transaction(async (tx) => {
      const range = await tx.eInvoiceNumberRange.findFirst({
        where: { year: Number(year), period, isActive: true },
        orderBy: { createdAt: 'asc' },
      })

      if (!range) throw new Error('找不到可用的發票字軌')

      const nextNum = range.currentNumber + 1
      if (nextNum > range.endNumber) throw new Error('字軌號碼已用盡')

      // Update currentNumber and deactivate if exhausted
      const isExhausted = nextNum >= range.endNumber
      await tx.eInvoiceNumberRange.update({
        where: { id: range.id },
        data: {
          currentNumber: nextNum,
          ...(isExhausted ? { isActive: false } : {}),
        },
      })

      return {
        invoiceNumber: `${range.prefix}${String(nextNum).padStart(8, '0')}`,
        rangeId: range.id,
        number: nextNum,
        remaining: range.endNumber - nextNum,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, 'e-invoice-ranges.next-number.POST')
  }
}
