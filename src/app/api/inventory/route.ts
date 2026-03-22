import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search      = searchParams.get('search')      ?? ''
  const category    = searchParams.get('category')    ?? ''   // product category (紙尿布 etc.)
  const invCategory = searchParams.get('invCategory') ?? ''   // InventoryCategory enum
  const warehouse   = searchParams.get('warehouse')   ?? ''
  const lowStock    = searchParams.get('lowStock') === 'true'

  const inventory = await prisma.inventory.findMany({
    where: {
      ...(warehouse   && { warehouse }),
      ...(invCategory && { category: invCategory as never }),
      product: {
        isActive: true,
        ...(category && { category }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku:  { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
    },
    include: {
      product: {
        select: {
          id: true, sku: true, name: true, category: true,
          unit: true, costPrice: true, sellingPrice: true,
        },
      },
    },
    orderBy: [{ warehouse: 'asc' }, { product: { category: 'asc' } }],
  })

  const result = lowStock
    ? inventory.filter(i => i.quantity <= i.safetyStock)
    : inventory

  return NextResponse.json(result)
}
