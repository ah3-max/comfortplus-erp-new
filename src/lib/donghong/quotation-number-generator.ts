import { prisma } from '@/lib/prisma'

// NOTE: 高並發時可能有競態條件；dev 階段可接受，生產級需改用 DB sequence 或 SELECT FOR UPDATE
export async function generateQuotationNumber(
  year: number = new Date().getFullYear(),
): Promise<string> {
  const prefix = `SQ-${year}-`
  const last = await prisma.supplierQuotation.findFirst({
    where: { quotationNumber: { startsWith: prefix } },
    orderBy: { quotationNumber: 'desc' },
    select: { quotationNumber: true },
  })

  let nextNum = 1
  if (last) {
    const lastNum = parseInt(last.quotationNumber.split('-').pop() ?? '0', 10)
    nextNum = lastNum + 1
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`
}
