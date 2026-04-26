// TODO: 未來接台銀即期匯率 API (https://www.boc.tw/rate) 取代硬編匯率
const RATES: Record<string, number> = {
  TWD: 1,
  CNY: 4.5,
  USD: 32,
  THB: 0.92,
  EUR: 34,
}

export function toTwd(amount: number, currency: string): number {
  const rate = RATES[currency.toUpperCase()] ?? 1
  return Math.round(amount * rate * 100) / 100
}

export function getRate(currency: string): number {
  return RATES[currency.toUpperCase()] ?? 1
}
