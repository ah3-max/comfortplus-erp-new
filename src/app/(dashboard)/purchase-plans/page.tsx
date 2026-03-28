'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Plus, ShoppingBag, ArrowRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface PlanItem {
  id: string; requiredQty: number; unitPrice: number | null; notes: string | null
  product: { name: string }; supplier?: { name: string } | null
}
interface Plan {
  id: string; planNo: string; planYear: number; planMonth: number; status: string
  totalBudget: number; notes: string | null; createdBy: { name: string }; items: PlanItem[]
}
interface FormItem { productId: string; supplierId: string; requiredQty: number; unitPrice: number; notes: string; lineNo: number }
interface Product { id: string; name: string; sku: string }
interface Supplier { id: string; name: string }

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: '已提交', color: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: '已核准', color: 'bg-green-100 text-green-700' },
  EXECUTED: { label: '已執行', color: 'bg-emerald-100 text-emerald-700' },
}

function fmt(n: number) { return n.toLocaleString('zh-TW') }

const now = new Date()
const DEFAULT_FORM = { planYear: now.getFullYear(), planMonth: now.getMonth() + 1, notes: '' }
const DEFAULT_ITEM = (): FormItem => ({ productId: '', supplierId: '', requiredQty: 1, unitPrice: 0, notes: '', lineNo: 1 })

export default function PurchasePlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(now.getFullYear())
  const [detail, setDetail] = useState<Plan | null>(null)
  const [createDialog, setCreateDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [items, setItems] = useState<FormItem[]>([DEFAULT_ITEM()])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/purchase-plans?planYear=${year}`).then(r => r.json()).then(d => setPlans(d.data ?? []))
      .finally(() => setLoading(false))
  }, [year])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/products?pageSize=200').then(r => r.json()).then(d => setProducts(d.data ?? []))
    fetch('/api/suppliers?pageSize=200').then(r => r.json()).then(d => setSuppliers(d.data ?? []))
  }, [])

  function openCreate() {
    setForm(DEFAULT_FORM)
    setItems([DEFAULT_ITEM()])
    setCreateDialog(true)
  }

  function addItem() {
    setItems(prev => [...prev, { ...DEFAULT_ITEM(), lineNo: prev.length + 1 }])
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, lineNo: idx + 1 })))
  }

  function updateItem(i: number, key: keyof FormItem, val: string | number) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }

  async function doCreate() {
    if (!items.some(i => i.productId)) { toast.error('至少需要一個品項'); return }
    setSaving(true)
    const res = await fetch('/api/purchase-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        items: items.filter(i => i.productId).map(i => ({
          ...i,
          unitPrice: i.unitPrice > 0 ? i.unitPrice : undefined,
          supplierId: i.supplierId || undefined,
          notes: i.notes || undefined,
        })),
      }),
    })
    setSaving(false)
    if (res.ok) { toast.success('採購計畫已建立'); setCreateDialog(false); load() }
    else { const d = await res.json(); toast.error(d.error ?? '建立失敗') }
  }

  async function doAction(id: string, action: string) {
    const res = await fetch(`/api/purchase-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) { toast.success('操作成功'); load(); setDetail(null) }
    else { const d = await res.json(); toast.error(d.error ?? '操作失敗') }
  }

  const totalBudget = items.reduce((s, i) => s + (i.unitPrice * i.requiredQty), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">採購計畫</h1>
          <p className="text-sm text-muted-foreground">月度採購計畫與預算管理</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />新增計畫</Button>
      </div>

      <div className="flex items-center gap-2">
        <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24" min={2020} max={2030} />
        <span className="text-sm">年</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">本年度無採購計畫</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map(p => {
            const st = STATUS_MAP[p.status] ?? { label: p.status, color: '' }
            return (
              <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetail(p)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      {p.planYear}/{String(p.planMonth).padStart(2, '0')}
                    </CardTitle>
                    <Badge variant="outline" className={st.color}>{st.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{p.planNo}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">${fmt(Number(p.totalBudget))}</span>
                    <span className="text-xs text-muted-foreground">{p.items.length} 品項</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.planYear}/{String(detail.planMonth).padStart(2, '0')} 採購計畫</DialogTitle>
                <p className="text-xs text-muted-foreground font-mono">{detail.planNo}</p>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={STATUS_MAP[detail.status]?.color}>{STATUS_MAP[detail.status]?.label}</Badge>
                  <span className="text-xl font-bold">${fmt(Number(detail.totalBudget))}</span>
                </div>
                <div className="rounded-md border divide-y">
                  {detail.items.map((item, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{item.product.name}</span>
                        {item.supplier && <span className="text-muted-foreground ml-2">({item.supplier.name})</span>}
                      </div>
                      <div className="text-right">
                        <span>{item.requiredQty} 件</span>
                        {item.unitPrice && <span className="text-muted-foreground ml-2">@${fmt(Number(item.unitPrice))}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end flex-wrap">
                  {detail.status === 'DRAFT' && (
                    <Button size="sm" onClick={() => doAction(detail.id, 'SUBMIT')}>提交 <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
                  )}
                  {detail.status === 'SUBMITTED' && (
                    <Button size="sm" onClick={() => doAction(detail.id, 'APPROVE')}>核准</Button>
                  )}
                  {detail.status === 'APPROVED' && (
                    <Button size="sm" onClick={() => doAction(detail.id, 'EXECUTE')}>執行</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle><ShoppingBag className="inline h-4 w-4 mr-2" />新增採購計畫</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>年度</Label>
                <Input type="number" value={form.planYear} onChange={e => setForm(f => ({ ...f, planYear: Number(e.target.value) }))} className="mt-1" min={2020} max={2030} />
              </div>
              <div>
                <Label>月份</Label>
                <Input type="number" value={form.planMonth} onChange={e => setForm(f => ({ ...f, planMonth: Math.min(12, Math.max(1, Number(e.target.value))) }))} className="mt-1" min={1} max={12} />
              </div>
            </div>
            <div>
              <Label>備註</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" placeholder="選填" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>採購品項</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" />新增</Button>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start rounded border p-2">
                    <div className="col-span-4">
                      <select
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={item.productId}
                        onChange={e => updateItem(i, 'productId', e.target.value)}
                      >
                        <option value="">選擇品項</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <select
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={item.supplierId}
                        onChange={e => updateItem(i, 'supplierId', e.target.value)}
                      >
                        <option value="">供應商(選填)</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <Input type="number" min={1} value={item.requiredQty} onChange={e => updateItem(i, 'requiredQty', Number(e.target.value))} placeholder="數量" className="text-sm" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" min={0} value={item.unitPrice || ''} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} placeholder="單價" className="text-sm" />
                    </div>
                    <div className="col-span-1 flex justify-center pt-1.5">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {totalBudget > 0 && (
                <div className="text-right text-sm font-medium mt-2">預估預算：${fmt(totalBudget)}</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>取消</Button>
            <Button onClick={doCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}建立計畫
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
