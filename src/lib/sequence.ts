import { prisma } from '@/lib/prisma'

/**
 * 產生下一個單號，格式：{PREFIX}{YYYYMMDD}{4位序號}
 * 例：Q202603170001、SO202603170001
 */
export async function generateSequenceNo(type: string): Promise<string> {
  const seq = await prisma.sequence.update({
    where: { type },
    data: { currentNo: { increment: 1 } },
  })

  const today = new Date()
  const date = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const no = String(seq.currentNo).padStart(4, '0')

  return `${seq.prefix}${date}${no}`
}
