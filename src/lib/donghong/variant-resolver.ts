import { prisma } from '@/lib/prisma'

// TODO: resolve a ProductVariant by id with full relations
export async function resolveVariant(id: string) {
  return prisma.productVariant.findUnique({
    where: { id },
    include: {
      barcodes: true,
      costSnapshots: true,
      masterProduct: { select: { id: true, sku: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
  })
}
