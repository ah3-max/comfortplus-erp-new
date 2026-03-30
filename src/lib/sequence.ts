import { prisma } from '@/lib/prisma'

/**
 * 產生下一個單號，格式：{PREFIX}{YYYYMMDD}{4位序號}
 * 例：Q202603170001、SO202603170001
 *
 * 安全性：
 *   - pg_advisory_xact_lock 確保同一 type 在同一時刻只有一個 transaction 執行
 *   - 每日自動從 0001 重置（依 updatedAt 判斷是否跨日）
 *   - 若當日序號超過 9999，自動擴充為 5 位（SO2026031710000）
 */
export async function generateSequenceNo(type: string): Promise<string> {
  const today = new Date()
  const dateStr =
    `${today.getFullYear()}` +
    `${String(today.getMonth() + 1).padStart(2, '0')}` +
    `${String(today.getDate()).padStart(2, '0')}`

  const { prefix, no } = await prisma.$transaction(async (tx) => {
    // Advisory lock：每個 type 對應唯一的 32-bit lock id
    // 保證高併發下同一 type 序列化執行，不產生重複或跳號
    const lockId = stableHash(type)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`

    const seq = await tx.sequence.findUnique({ where: { type } })
    if (!seq) throw new Error(`Sequence type "${type}" not found in database`)

    // 判斷是否跨日：取 updatedAt 的日期字串
    const lastUpdated = seq.updatedAt
    const lastDateStr =
      `${lastUpdated.getFullYear()}` +
      `${String(lastUpdated.getMonth() + 1).padStart(2, '0')}` +
      `${String(lastUpdated.getDate()).padStart(2, '0')}`

    // 跨日 → 從 1 重新開始；同日 → 繼續累加
    const newNo = lastDateStr === dateStr ? seq.currentNo + 1 : 1

    await tx.sequence.update({
      where: { type },
      data: { currentNo: newNo },
    })

    return { prefix: seq.prefix, no: newNo }
  })

  // 超過 4 位自動擴位（防止溢位截斷）
  const paddedNo = no > 9999 ? String(no) : String(no).padStart(4, '0')
  return `${prefix}${dateStr}${paddedNo}`
}

/**
 * 將字串穩定 hash 為 32-bit 正整數（用作 pg_advisory_xact_lock 的 lock id）
 * 同一字串在所有節點上永遠回傳相同值。
 */
function stableHash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(hash, 33) ^ str.charCodeAt(i)) >>> 0
  }
  return hash === 0 ? 1 : hash  // 避免使用 0（pg 保留）
}
