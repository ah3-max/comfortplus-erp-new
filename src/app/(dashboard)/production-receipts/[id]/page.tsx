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

type ReceiptStatus = 'DRAFT' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED'

interface ReceiptItem {
  id: string
  productId: string
  productName: string
  specification: string | null
  quantity: string
  bomVersion: string | null
  unit: string | null
  memo: string | null
  manufacturedItemId: string | null
  resourceInput: string | null
  productionTime: string | null
  product: { sku: string; name: string; unit: string | null }
}

interface Receipt {
  id: string
  receiptNumber: string
  date: string
  status: ReceiptStatus
  notes: string | null
  createdAt: string
  factoryId: string
  receivingWarehouseId: string
  handlerId: string
  productionOrderId: string | null
  factory: { id: string; name: string; code: string }
  receivingWarehouse: { id: string; name: string; code: string }
  handler: { id: string; name: string }
  productionOrder: { id: string; productionNo: string; status: string } | null
  createdBy: { id: string; name: string }
  items: ReceiptItem[]
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const STATUS_VARIANT: Record<ReceiptStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline', CONFIRMED: 'secondary', RECEIVED: 'default', CANCELLED: 'destructive',
}
const STATUS_CLASS: Partial<Record<ReceiptStatus, string>> = {
  RECEIVED: 'bg-green-100 text-green-700 border-green-200',
}

export default function ProductionReceiptDetailPage() {
  const { dict } = useI18n()
  const p = dict.productionReceiptDetail
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/production-receipts/${id}`)
        if (res.status === 404 || res.status === 403) {
          setNotFound(true)
          return
        }
        if (!res.ok) throw new Error(dict.common.loadFailed)
        const data = await res.json()
        setReceipt(data)
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

  if (notFound || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <FileText className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">{p.notFound}</p>
        <Button variant="outline" onClick={() => router.push('/production-receipts')}>
          <ArrowLeft className="mr-2 h-4 w-4" />{p.backToList}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/production-receipts')}>
          <ArrowLeft className="mr-2 h-4 w-4" />{p.back}
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{receipt.receiptNumber}</h1>
            <Badge variant={STATUS_VARIANT[receipt.status]} className={STATUS_CLASS[receipt.status]}>
              {p.statusLabels[receipt.status] ?? receipt.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {dict.productionReceipts.title} · {p.createdAt} {formatDate(receipt.createdAt)}
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Receipt Info */}
        <div className="rounded-lg border bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">{p.basicInfo}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.factory}</dt>
              <dd className="font-medium">{receipt.factory.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.factoryCode}</dt>
              <dd className="font-mono">{receipt.factory.code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{dict.common.date}</dt>
              <dd>{formatDate(receipt.date)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.itemCount}</dt>
              <dd>{receipt.items.length} 項</dd>
            </div>
          </dl>
        </div>

        {/* Warehouse & Handler */}
        <div className="rounded-lg border bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">{p.warehouseOrderStaff}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.receivingWarehouse}</dt>
              <dd>{receipt.receivingWarehouse.code} - {receipt.receivingWarehouse.name}</dd>
            </div>
            {receipt.productionOrder && (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{dict.productionReceipts.productionOrder}</dt>
                  <dd className="font-mono font-medium">{receipt.productionOrder.productionNo}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{p.orderStatus}</dt>
                  <dd>{receipt.productionOrder.status}</dd>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.handler}</dt>
              <dd className="font-medium">{receipt.handler.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{p.createdBy}</dt>
              <dd>{receipt.createdBy.name}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Notes */}
      {receipt.notes && (
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">{dict.common.notes}</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{receipt.notes}</p>
        </div>
      )}

      {/* Items Table */}
      <div className="rounded-lg border bg-white">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-slate-700">{p.itemsHeader}（{receipt.items.length} 項）</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>品項</TableHead>
              <TableHead className="w-24">{p.colSpec}</TableHead>
              <TableHead className="w-20 text-right">{dict.common.quantity}</TableHead>
              <TableHead className="w-16 text-center">{dict.common.unit}</TableHead>
              <TableHead className="w-24">{p.colBomVersion}</TableHead>
              <TableHead className="w-24">{p.colProductionTime}</TableHead>
              <TableHead>{dict.common.notes}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipt.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">{p.noItems}</TableCell>
              </TableRow>
            ) : (
              receipt.items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{item.product.sku}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.specification ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">{Number(item.quantity).toLocaleString()}</TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">{item.unit ?? item.product.unit ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{item.bomVersion ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.productionTime ? `${item.productionTime} ${p.minutesSuffix}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.memo ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
