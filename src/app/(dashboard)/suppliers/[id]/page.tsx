'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SupplierForm } from '@/components/purchases/supplier-form'
import { ArrowLeft, Pencil, Plus, Trash2, Loader2, Building2, Package, History } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_CLS: Record<string, string> = {
  DRAFT:            'border-slate-300 text-slate-600',
  PENDING_APPROVAL: 'bg-orange-100 text-orange-700 border-orange-200',
  SOURCING:         'bg-purple-100 text-purple-700 border-purple-200',
  CONFIRMED:        'bg-blue-100 text-blue-700 border-blue-200',
  PARTIAL:          'bg-amber-100 text-amber-700 border-amber-200',
  RECEIVED:         'bg-green-100 text-green-700 border-green-200',
  CANCELLED:        'bg-red-100 text-red-700 border-red-200',
}

interface PriceHistory {
  id: string; itemName: string; unitCost: string; currency: string
  effectiveDate: string; notes: string | null
  product: { id: string; sku: string; name: string; unit: string } | null
}
interface PurchaseOrder {
  id: string; poNo: string; status: string; orderType: string
  totalAmount: string; paidAmount: string; expectedDate: string | null; createdAt: string
}
interface Supplier {
  id: string; code: string; name: string; contactPerson: string | null
  phone: string | null; email: string | null; address: string | null
  taxId: string | null; paymentTerms: string | null
  leadTimeDays: number | null; supplyCategories: string | null
  supplyItems: string | null; notes: string | null; isActive: boolean
  purchaseOrders: PurchaseOrder[]
  priceHistory: PriceHistory[]
  _count: { purchaseOrders: number }
}

function fmt(v: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(v))
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW')
}

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { dict } = useI18n()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'info' | 'orders' | 'price'>('info')
  const [editOpen, setEditOpen] = useState(false)

  // 歷史採購價格 dialog
  const [priceOpen, setPriceOpen]   = useState(false)
  const [pItemName, setPItemName]   = useState('')
  const [pUnitCost, setPUnitCost]   = useState('')
  const [pDate, setPDate]           = useState(new Date().toISOString().slice(0, 10))
  const [pNotes, setPNotes]         = useState('')
  const [pSaving, setPSaving]       = useState(false)

  async function fetchSupplier() {
    setLoading(true)
    const res = await fetch(`/api/suppliers/${id}`)
    if (res.ok) setSupplier(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchSupplier() }, [id])

  async function handleAddPrice(e: React.FormEvent) {
    e.preventDefault()
    if (!pItemName || !pUnitCost) { toast.error(dict.suppliersPage.priceItemRequired); return }
    setPSaving(true)
    const res = await fetch(`/api/suppliers/${id}/price-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName: pItemName, unitCost: pUnitCost, effectiveDate: pDate, notes: pNotes }),
    })
    setPSaving(false)
    if (res.ok) {
      toast.success(dict.suppliersPage.priceAdded)
      setPriceOpen(false)
      setPItemName(''); setPUnitCost(''); setPNotes('')
      setPDate(new Date().toISOString().slice(0, 10))
      fetchSupplier()
    } else {
      const d = await res.json(); toast.error(d.error ?? dict.common.createFailed)
    }
  }

  async function handleDeletePrice(recordId: string) {
    if (!confirm(dict.supplierDetail.confirmDeletePrice)) return
    const res = await fetch(`/api/suppliers/${id}/price-history?recordId=${recordId}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.common.deleteSuccess); fetchSupplier() }
    else toast.error(dict.common.deleteFailed)
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
  if (!supplier) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">{dict.suppliers.noSuppliers}</div>
  )

  const purchaseTypeLabels: Record<string, string> = {
    FINISHED_GOODS:     dict.supplierDetail.ptFinishedGoods,
    OEM:                dict.supplierDetail.ptOem,
    PACKAGING:          dict.supplierDetail.ptPackaging,
    RAW_MATERIAL:       dict.supplierDetail.ptRawMaterial,
    GIFT_PROMO:         dict.supplierDetail.ptGiftPromo,
    LOGISTICS_SUPPLIES: dict.supplierDetail.ptLogisticsSupplies,
  }
  const statusConfig: Record<string, { label: string; cls: string }> = {
    DRAFT:            { label: dict.supplierDetail.stDraft,           cls: STATUS_CLS.DRAFT },
    PENDING_APPROVAL: { label: dict.supplierDetail.stPendingApproval, cls: STATUS_CLS.PENDING_APPROVAL },
    SOURCING:         { label: dict.supplierDetail.stSourcing,        cls: STATUS_CLS.SOURCING },
    CONFIRMED:        { label: dict.supplierDetail.stConfirmed,       cls: STATUS_CLS.CONFIRMED },
    PARTIAL:          { label: dict.supplierDetail.stPartial,         cls: STATUS_CLS.PARTIAL },
    RECEIVED:         { label: dict.supplierDetail.stReceived,        cls: STATUS_CLS.RECEIVED },
    CANCELLED:        { label: dict.supplierDetail.stCancelled,       cls: STATUS_CLS.CANCELLED },
  }

  const categories = supplier.supplyCategories ? JSON.parse(supplier.supplyCategories) as string[] : []
  const totalPurchased = supplier.purchaseOrders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((s, o) => s + Number(o.totalAmount), 0)

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()}
          className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <Building2 className="h-5 w-5 text-slate-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{supplier.name}</h1>
            <span className="text-sm font-mono text-muted-foreground">{supplier.code}</span>
            {!supplier.isActive && <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500">{dict.supplierDetail.inactive}</Badge>}
          </div>
          {categories.length > 0 && (
            <div className="flex gap-1 mt-1">
              {categories.map(c => (
                <Badge key={c} variant="outline" className="text-xs px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                  {purchaseTypeLabels[c] ?? c}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />{dict.common.edit}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">{dict.purchasesExt.totalAmount}</div>
            <div className="text-xl font-bold text-slate-900">{fmt(totalPurchased)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{supplier._count.purchaseOrders} {dict.supplierDetail.purchaseOrdersCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">{dict.supplierDetail.leadTimeCard}</div>
            <div className="text-xl font-bold text-slate-900">
              {supplier.leadTimeDays != null ? `${supplier.leadTimeDays}${dict.supplierDetail.leadTimeUnit}` : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{dict.supplierDetail.paymentPrefix}{supplier.paymentTerms ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">{dict.supplierDetail.priceHistoryCount}</div>
            <div className="text-xl font-bold text-slate-900">{supplier.priceHistory.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{dict.supplierDetail.priceHistoryDesc}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {[
          { id: 'info',   label: dict.supplierDetail.tabInfo,  icon: <Building2 className="h-4 w-4" /> },
          { id: 'orders', label: dict.nav.purchases,           icon: <Package className="h-4 w-4" /> },
          { id: 'price',  label: dict.supplierDetail.tabPrice, icon: <History className="h-4 w-4" /> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* 基本資料 */}
      {tab === 'info' && (
        <div className="grid grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{dict.supplierDetail.contactCard}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: dict.suppliers.contact, value: supplier.contactPerson },
                { label: dict.suppliers.phone, value: supplier.phone },
                { label: dict.suppliers.email, value: supplier.email },
                { label: dict.suppliers.address, value: supplier.address },
                { label: dict.customersExt.taxId, value: supplier.taxId },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right max-w-[60%]">{value ?? '—'}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{dict.supplierDetail.coopCard}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{dict.suppliers.paymentTerms}</span>
                <span className="font-medium">{supplier.paymentTerms ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{dict.supplierDetail.leadTimeDaysLabel}</span>
                <span className="font-medium">{supplier.leadTimeDays != null ? `${supplier.leadTimeDays}${dict.supplierDetail.leadTimeUnit}` : '—'}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground">{dict.supplierDetail.supplyCategories}</span>
                <div className="flex flex-wrap gap-1">
                  {categories.length > 0
                    ? categories.map(c => (
                      <Badge key={c} variant="outline" className="text-xs">{purchaseTypeLabels[c] ?? c}</Badge>
                    ))
                    : <span className="text-muted-foreground">—</span>}
                </div>
              </div>
              {supplier.supplyItems && (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{dict.supplierDetail.supplyItems}</span>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{supplier.supplyItems}</p>
                </div>
              )}
            </CardContent>
          </Card>
          {supplier.notes && (
            <Card className="col-span-2">
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{dict.supplierDetail.notesCard}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{supplier.notes}</p></CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 採購紀錄 */}
      {tab === 'orders' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{dict.supplierDetail.ordersCard}</CardTitle>
            <Button size="sm" onClick={() => router.push('/purchases')}>
              <Package className="mr-2 h-4 w-4" />{dict.supplierDetail.goToPurchases}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.purchases.poNo}</TableHead>
                  <TableHead>{dict.common.type}</TableHead>
                  <TableHead>{dict.common.status}</TableHead>
                  <TableHead className="text-right">{dict.purchasesExt.totalAmount}</TableHead>
                  <TableHead className="text-right">{dict.purchasesExt.paidAmount}</TableHead>
                  <TableHead>{dict.purchasesExt.expectedDate}</TableHead>
                  <TableHead>{dict.common.createdAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.purchaseOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{dict.supplierDetail.noOrders}</TableCell>
                  </TableRow>
                ) : supplier.purchaseOrders.map(o => {
                  const sc = statusConfig[o.status] ?? { label: o.status, cls: '' }
                  return (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/purchases/${o.id}`)}>
                      <TableCell className="font-mono text-sm font-medium">{o.poNo}</TableCell>
                      <TableCell className="text-sm">{purchaseTypeLabels[o.orderType] ?? o.orderType}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-xs ${sc.cls}`}>{sc.label}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{fmt(o.totalAmount)}</TableCell>
                      <TableCell className="text-right text-sm text-green-600">
                        {Number(o.paidAmount) > 0 ? fmt(o.paidAmount) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {o.expectedDate ? fmtDate(o.expectedDate) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(o.createdAt)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 歷史採購價格 */}
      {tab === 'price' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{dict.supplierDetail.priceCard}</CardTitle>
            <Button size="sm" onClick={() => setPriceOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />{dict.common.add}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.supplierDetail.priceItemName}</TableHead>
                  <TableHead className="text-right w-32">{dict.supplierDetail.priceUnitCost}</TableHead>
                  <TableHead className="w-24">{dict.supplierDetail.priceCurrency}</TableHead>
                  <TableHead className="w-28">{dict.supplierDetail.priceEffectiveDate}</TableHead>
                  <TableHead>{dict.common.notes}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.priceHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      {dict.supplierDetail.noPrice}
                    </TableCell>
                  </TableRow>
                ) : supplier.priceHistory.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{p.itemName}</div>
                      {p.product && (
                        <div className="text-xs text-muted-foreground font-mono">{p.product.sku}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">{fmt(p.unitCost)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.currency}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(p.effectiveDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.notes ?? '—'}</TableCell>
                    <TableCell>
                      <button onClick={() => handleDeletePrice(p.id)}
                        className="text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit supplier dialog */}
      <SupplierForm open={editOpen} onClose={() => setEditOpen(false)}
        onSuccess={fetchSupplier} supplier={supplier} />

      {/* Add price dialog */}
      <Dialog open={priceOpen} onOpenChange={(o) => !o && setPriceOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{dict.common.add}{dict.supplierDetail.addPriceTitle}</DialogTitle></DialogHeader>
          <form onSubmit={handleAddPrice} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{dict.supplierDetail.priceItemLabel}</Label>
              <Input value={pItemName} onChange={e => setPItemName(e.target.value)} placeholder={dict.supplierDetail.priceItemPlaceholder} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{dict.supplierDetail.priceUnitLabel}</Label>
                <Input type="number" value={pUnitCost} onChange={e => setPUnitCost(e.target.value)} placeholder="0" min={0} step={0.01} required />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.supplierDetail.priceEffectiveDateLabel}</Label>
                <Input type="date" value={pDate} onChange={e => setPDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.supplierDetail.priceNotesLabel}</Label>
              <Input value={pNotes} onChange={e => setPNotes(e.target.value)} placeholder={dict.supplierDetail.priceNotesPlaceholder} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPriceOpen(false)} disabled={pSaving}>{dict.common.cancel}</Button>
              <Button type="submit" disabled={pSaving}>
                {pSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.add}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
