import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/pickup/[id] — Get pickup detail
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const pickup = await prisma.warehousePickup.findUnique({
    where: { id },
    include: {
      pickedBy: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, code: true, address: true } },
      order: { select: { id: true, orderNo: true } },
      items: {
        include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
      },
    },
  })

  if (!pickup) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(pickup)
}

// PUT /api/pickup/[id] — Update pickup (upload photos, verify, deduct)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const pickup = await prisma.warehousePickup.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!pickup) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── Action: Upload photos (業務拍照) ───────────────────
  if (body.action === 'upload_photos') {
    const photos = body.photos as { url: string; uploadedAt: string; note?: string }[]
    const existingPhotos = (pickup.photos as unknown[]) ?? []
    const updatedPhotos = [...existingPhotos, ...photos]

    const updated = await prisma.warehousePickup.update({
      where: { id },
      data: {
        photos: updatedPhotos as never,
        photoCount: updatedPhotos.length,
        status: 'PENDING_VERIFY',
      },
    })

    return NextResponse.json(updated)
  }

  // ── Action: Verify (助理核對) ──────────────────────────
  if (body.action === 'verify') {
    const updated = await prisma.warehousePickup.update({
      where: { id },
      data: {
        status: body.approved ? 'VERIFIED' : 'REJECTED',
        verifiedById: session.user.id,
        verifiedAt: new Date(),
        verifyNotes: body.notes || null,
      },
    })

    return NextResponse.json(updated)
  }

  // ── Action: Deduct inventory (扣庫存) ──────────────────
  if (body.action === 'deduct_inventory') {
    if (pickup.status !== 'VERIFIED') {
      return NextResponse.json({ error: '請先完成核對' }, { status: 400 })
    }
    if (pickup.inventoryDeducted) {
      return NextResponse.json({ error: '庫存已扣除' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      for (const item of pickup.items) {
        // Find inventory record
        const inv = await tx.inventory.findFirst({
          where: {
            productId: item.productId,
            warehouse: pickup.warehouse,
            category: 'FINISHED_GOODS',
          },
        })

        if (inv) {
          // Deduct
          await tx.inventory.update({
            where: { id: inv.id },
            data: {
              quantity: { decrement: item.quantity },
              availableQty: { decrement: item.quantity },
            },
          })

          // Record transaction
          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              warehouse: pickup.warehouse,
              category: 'FINISHED_GOODS',
              type: 'OUT',
              quantity: item.quantity,
              beforeQty: inv.quantity,
              afterQty: inv.quantity - item.quantity,
              referenceType: 'PICKUP',
              referenceId: pickup.id,
              notes: `行銷倉取貨 ${pickup.pickupNo}`,
              createdById: session.user.id,
            },
          })
        }
      }

      // Update pickup status
      await tx.warehousePickup.update({
        where: { id },
        data: {
          status: 'DEDUCTED',
          inventoryDeducted: true,
        },
      })
    })

    return NextResponse.json({ ok: true, message: '庫存已扣除' })
  }

  return NextResponse.json({ error: '無效的操作' }, { status: 400 })
}
