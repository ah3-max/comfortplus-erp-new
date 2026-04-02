'use client'

import { PaymentSummaryView } from '../payment-summary/page'

export default function ReceiptSummaryPage() {
  return <PaymentSummaryView fixedType="INCOMING" />
}
