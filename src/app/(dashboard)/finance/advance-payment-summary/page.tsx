'use client'

// 暫付款單合計 — 直接重導向至 payment-summary?type=ADVANCE
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function AdvancePaymentSummaryPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/finance/payment-summary?type=ADVANCE')
  }, [router])
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}
