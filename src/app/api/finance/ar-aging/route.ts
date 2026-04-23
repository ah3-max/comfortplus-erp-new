import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const allAR = await prisma.accountsReceivable.findMany({
    where: { status: { not: 'PAID' } },
    select: {
      id: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      status: true,
      invoiceNo: true,
      invoiceId: true,
      customer: { select: { id: true, name: true, code: true, salesRep: { select: { id: true, name: true } } } },
      order: { select: { id: true, orderNo: true } },
    },
  })

  // Bucket definitions
  interface ArAgingItem {
    id: string; customerName: string; customerCode: string; salesRep: string
    orderId: string | null; orderNo: string; invoiceId: string | null; invoiceNo: string
    amount: number; paid: number; balance: number; dueDate: string; overdueDays: number
  }
  const buckets = {
    current:  { label: '未到期', count: 0, amount: 0, items: [] as ArAgingItem[] },
    days30:   { label: '1-30天', count: 0, amount: 0, items: [] as ArAgingItem[] },
    days60:   { label: '31-60天', count: 0, amount: 0, items: [] as ArAgingItem[] },
    days90:   { label: '61-90天', count: 0, amount: 0, items: [] as ArAgingItem[] },
    over90:   { label: '90天以上', count: 0, amount: 0, items: [] as ArAgingItem[] },
  }

  for (const ar of allAR) {
    const balance = Number(ar.amount) - Number(ar.paidAmount)
    if (balance <= 0) continue

    const dueDate = ar.dueDate ? new Date(ar.dueDate) : today
    const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400_000))

    const item = {
      id: ar.id,
      customerName: ar.customer.name,
      customerCode: ar.customer.code,
      salesRep: ar.customer.salesRep?.name ?? '-',
      orderId: ar.order?.id ?? null,
      orderNo: ar.order?.orderNo ?? '-',
      invoiceId: ar.invoiceId ?? null,
      invoiceNo: ar.invoiceNo ?? '-',
      amount: Number(ar.amount),
      paid: Number(ar.paidAmount),
      balance,
      dueDate: ar.dueDate?.toISOString().slice(0, 10) ?? '-',
      overdueDays,
    }

    if (overdueDays <= 0) { buckets.current.count++; buckets.current.amount += balance; buckets.current.items.push(item) }
    else if (overdueDays <= 30) { buckets.days30.count++; buckets.days30.amount += balance; buckets.days30.items.push(item) }
    else if (overdueDays <= 60) { buckets.days60.count++; buckets.days60.amount += balance; buckets.days60.items.push(item) }
    else if (overdueDays <= 90) { buckets.days90.count++; buckets.days90.amount += balance; buckets.days90.items.push(item) }
    else { buckets.over90.count++; buckets.over90.amount += balance; buckets.over90.items.push(item) }
  }

  // Sort items within each bucket by balance descending
  for (const bucket of Object.values(buckets)) {
    bucket.items.sort((a, b) => b.balance - a.balance)
    bucket.amount = Math.round(bucket.amount)
  }

  const totalBalance = Object.values(buckets).reduce((s, b) => s + b.amount, 0)
  const totalOverdue = buckets.days30.amount + buckets.days60.amount + buckets.days90.amount + buckets.over90.amount
  const overdueRate = totalBalance > 0 ? Math.round((totalOverdue / totalBalance) * 100 * 10) / 10 : 0

  // Top overdue customers
  const customerMap = new Map<string, { name: string; code: string; balance: number }>()
  for (const ar of allAR) {
    const balance = Number(ar.amount) - Number(ar.paidAmount)
    if (balance <= 0) continue
    const existing = customerMap.get(ar.customer.id)
    if (existing) {
      existing.balance += balance
    } else {
      customerMap.set(ar.customer.id, { name: ar.customer.name, code: ar.customer.code, balance })
    }
  }
  const topCustomers = [...customerMap.values()].sort((a, b) => b.balance - a.balance).slice(0, 10)

  return NextResponse.json({
    buckets,
    summary: {
      totalBalance,
      totalOverdue,
      overdueRate,
      totalCount: allAR.length,
    },
    topCustomers,
    generatedAt: now.toISOString(),
  })
}
