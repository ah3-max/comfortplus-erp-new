'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Loader2, FileText } from 'lucide-react'

type InvoiceStatus = 'DRAFT' | 'CONFIRMED' | 'SHIPPED' | 'RETURNED' | 'CANCELLED'

interface InvoiceItem {
  id: string
  productId: string
  productName: string
  specification: string | null
  quantity: string
  unitPrice: string
  unitPriceTax: string
  subtotal: string
  taxAmount: string
  totalAmount: string
  unit: string | null
  memo: string | null
  serialNumber: string | null
  product: { sku: string; name: string; unit: string | null }
}

interface Invoice {
  id: string
  invoiceNumber: string
  date: string
  status: InvoiceStatus
  subtotal: string
  taxAmount: string
  totalAmount: string
  transactionType: string
  notes: string | null
  createdAt: string
  receiverName: string | null
  shippingAddress: string | null
  phone: string | null
  shippingNote: string | null
  sourceOrderId: string | null
  customer: { id: string; name: string; code: string }
  salesPerson: { id: string; name: string }
  handler: { id: string; name: string }
  warehouse: { id: string; name: string; code: string }
  createdBy: { id: string; name: string }
  sourceOrder: { id: string; orderNo: string; status: string } | null
  items: InvoiceItem[]
}

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(val))
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const STATUS_VARIANT: Record<InvoiceStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline', CONFIRMED: 'secondary', SHIPPED: 'default', RETURNED: 'default', CANCELLED: 'destructive',
}
const STATUS_CLASS: Partial<Record<InvoiceStatus, string>> = {
  SHIPPED:  'bg-blue-100 text-blue-700 border-blue-200',
  RETURNED: 'bg-amber-100 text-amber-700 border-amber-200',
}

export default function SalesInvoiceDetailPage() {
  const { dict } = useI18n()
  const p = dict.salesInvoiceDetail
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/sales-invoices/${id}`)
        if (res.status === 404 || res.status === 403) { setNotFound(true); return }
        if (!res.ok) throw new Error(dict.common.loadFailed)
        const data = await res.json()
        setInvoice(data)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <FileText className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">{p.notFound}</p>
        <Button variant="outline" onClick={() => router.push('/sales-invoices')}>
          <ArrowLeft className="mr-2 h-4 w-4" />{p.backToList}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/sales-invoices')}>
          <ArrowLeft className="mr-2 h-4 w-4" />{p.back}
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{invoice.invoiceNumber}</h1>
            <Badge variant={STATUS_VARIANT[invoice.status]} className={STATUS_CLASS[invoice.status]}>
              {p.statusLabels[invoice.status] ?? invoice.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {dict.salesInvoices.title} · {p.createdAt} {formatDate(invoice.createdAt)}
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Info */}
        <div className="rounded-lg border bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">{p.basicInfo}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{dict.common.customer}</dt>
              <dd className="font-medium">{invoice.customer.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.customerCode}</dt>
              <dd className="font-mono">{invoice.customer.code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{dict.common.date}</dt>
              <dd>{formatDate(invoice.date)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.transactionType}</dt>
              <dd>{invoice.transactionType === 'TAX' ? p.transactionTypeTax : p.transactionTypeOther}</dd>
            </div>
            {invoice.sourceOrder && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{p.sourceOrder}</dt>
                <dd className="font-mono text-blue-600">{invoice.sourceOrder.orderNo}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Staff & Warehouse */}
        <div className="rounded-lg border bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">{p.staffAndWarehouse}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{dict.common.salesRep}</dt>
              <dd className="font-medium">{invoice.salesPerson.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.handler}</dt>
              <dd>{invoice.handler.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{dict.common.warehouse}</dt>
              <dd>{invoice.warehouse.code} - {invoice.warehouse.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.createdBy}</dt>
              <dd>{invoice.createdBy.name}</dd>
            </div>
          </dl>
        </div>

        {/* Shipping Info */}
        {(invoice.receiverName || invoice.shippingAddress || invoice.phone) && (
          <div className="rounded-lg border bg-white p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">{p.shippingInfo}</h2>
            <dl className="space-y-2 text-sm">
              {invoice.receiverName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{p.receiver}</dt>
                  <dd>{invoice.receiverName}</dd>
                </div>
              )}
              {invoice.phone && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{p.phone}</dt>
                  <dd>{invoice.phone}</dd>
                </div>
              )}
              {invoice.shippingAddress && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground shrink-0">{p.shippingAddress}</dt>
                  <dd className="text-right">{invoice.shippingAddress}</dd>
                </div>
              )}
              {invoice.shippingNote && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground shrink-0">{p.shippingNote}</dt>
                  <dd className="text-right">{invoice.shippingNote}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Amount Summary */}
        <div className="rounded-lg border bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">{p.amountSummary}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.subtotalExTax}</dt>
              <dd>{formatCurrency(invoice.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.taxLine}</dt>
              <dd>{formatCurrency(invoice.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <dt className="font-semibold">{p.totalIncTax}</dt>
              <dd className="font-bold text-lg">{formatCurrency(invoice.totalAmount)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">{dict.common.notes}</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Line Items Table */}
      <div className="rounded-lg border bg-white">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-slate-700">{p.itemsHeader}（{invoice.items.length} 項）</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>{p.colProduct}</TableHead>
              <TableHead className="w-24">{p.colSpec}</TableHead>
              <TableHead className="w-16 text-right">{dict.common.quantity}</TableHead>
              <TableHead className="w-16 text-center">{dict.common.unit}</TableHead>
              <TableHead className="w-28 text-right">{p.colUnitPriceExTax}</TableHead>
              <TableHead className="w-28 text-right">{p.colSubtotalExTax}</TableHead>
              <TableHead className="w-28 text-right">{p.colAmountIncTax}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">{p.noItems}</TableCell>
              </TableRow>
            ) : (
              invoice.items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{item.product.sku}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.specification ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">{Number(item.quantity).toLocaleString()}</TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">{item.unit ?? item.product.unit ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.totalAmount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {/* Footer Totals */}
        <div className="px-5 py-4 border-t bg-slate-50 flex flex-col items-end gap-1 text-sm">
          <div className="flex gap-8">
            <span className="text-muted-foreground">{p.footerSubtotal}</span>
            <span className="w-32 text-right">{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex gap-8">
            <span className="text-muted-foreground">{p.footerTax}</span>
            <span className="w-32 text-right">{formatCurrency(invoice.taxAmount)}</span>
          </div>
          <div className="flex gap-8 font-bold text-base border-t pt-2 mt-1">
            <span>{p.footerTotal}</span>
            <span className="w-32 text-right">{formatCurrency(invoice.totalAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
