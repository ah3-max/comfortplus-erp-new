'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Loader2, Truck, Package, Clock, Phone } from 'lucide-react'
import { toast } from 'sonner'

interface Provider {
  id: string; code: string; name: string
  regions: string | null; deliveryDays: number | null; paymentTerms: string | null
  rateCard: string | null; contactPerson: string | null; contactPhone: string | null
  contactEmail: string | null; claimRules: string | null; notes: string | null
  isActive: boolean
  _count: { shipments: number }
}

const emptyForm = {
  code: '', name: '', regions: '', deliveryDays: '', paymentTerms: '',
  rateCard: '', contactPerson: '', contactPhone: '', contactEmail: '',
  claimRules: '', notes: '',
}

export default function LogisticsPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading]     = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [open, setOpen]           = useState(false)
  const [editing, setEditing]     = useState<Provider | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(emptyForm)

  const fetchProviders = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/logistics?showAll=${showInactive}`)
    setProviders(await res.json())
    setLoading(false)
  }, [showInactive])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  function f(k: keyof typeof emptyForm, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function openCreate() {
    setEditing(null); setForm(emptyForm); setOpen(true)
  }
  function openEdit(p: Provider) {
    setEditing(p)
    setForm({
      code: p.code, name: p.name,
      regions:       p.regions      ?? '',
      deliveryDays:  p.deliveryDays?.toString() ?? '',
      paymentTerms:  p.paymentTerms ?? '',
      rateCard:      p.rateCard     ?? '',
      contactPerson: p.contactPerson ?? '',
      contactPhone:  p.contactPhone  ?? '',
      contactEmail:  p.contactEmail  ?? '',
      claimRules:    p.claimRules    ?? '',
      notes:         p.notes         ?? '',
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name) { toast.error('請填寫物流商名稱'); return }
    if (!editing && !form.code) { toast.error('請填寫物流商代碼'); return }
    setSaving(true)
    const url    = editing ? `/api/logistics/${editing.id}` : '/api/logistics'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        deliveryDays: form.deliveryDays ? Number(form.deliveryDays) : null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(editing ? '物流商已更新' : '物流商已新增')
      setOpen(false); fetchProviders()
    } else {
      const d = await res.json()
      toast.error(d.error ?? '儲存失敗')
    }
  }

  async function toggleActive(p: Provider) {
    const res = await fetch(`/api/logistics/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    if (res.ok) { toast.success(p.isActive ? '已停用' : '已啟用'); fetchProviders() }
    else toast.error('操作失敗')
  }

  const activeCount = providers.filter(p => p.isActive).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">物流商管理</h1>
          <p className="text-sm text-muted-foreground">共 {activeCount} 間物流商</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            顯示已停用
          </label>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />新增物流商</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-3 py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : providers.map(p => (
          <Card key={p.id} className={`group hover:shadow-md transition-shadow ${!p.isActive ? 'opacity-50' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-50 p-2.5">
                    <Truck className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{p.code}</span>
                    </div>
                    {p.regions && <p className="text-xs text-muted-foreground mt-0.5">{p.regions}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(p)}
                    className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {p.deliveryDays != null && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{p.deliveryDays} 天時效
                  </div>
                )}
                {p.contactPerson && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />{p.contactPerson}
                    {p.contactPhone && ` · ${p.contactPhone}`}
                  </div>
                )}
                {p.paymentTerms && (
                  <div className="flex items-center gap-1 col-span-2">
                    付款：{p.paymentTerms}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="h-3 w-3" />{p._count.shipments} 筆出貨
                </div>
                <div className="flex items-center gap-2">
                  {p.isActive
                    ? <Badge variant="outline" className="border-green-400 text-green-600 text-xs">啟用</Badge>
                    : <Badge variant="outline" className="border-red-400 text-red-600 text-xs">停用</Badge>
                  }
                  <button onClick={() => toggleActive(p)}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                    {p.isActive ? '停用' : '啟用'}
                  </button>
                </div>
              </div>

              {(p.rateCard || p.claimRules) && (
                <div className="mt-2 border-t pt-2 space-y-1">
                  {p.rateCard   && <p className="text-xs text-muted-foreground">運價：{p.rateCard}</p>}
                  {p.claimRules && <p className="text-xs text-muted-foreground">理賠：{p.claimRules}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && providers.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-16 text-center text-muted-foreground">
          尚無物流商資料，請新增第一間物流商
        </div>
      )}

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '編輯物流商' : '新增物流商'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            {!editing && (
              <div className="space-y-1.5">
                <Label>物流商代碼 <span className="text-red-500">*</span></Label>
                <Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())}
                  placeholder="HSINCHU / KERRY" maxLength={20} />
                <p className="text-xs text-muted-foreground">英數大寫，建立後不可更改</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>物流商名稱 <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="新竹物流" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>配送時效（天）</Label>
                <Input type="number" min={1} value={form.deliveryDays}
                  onChange={e => f('deliveryDays', e.target.value)} placeholder="2" />
              </div>
              <div className="space-y-1.5">
                <Label>付款條件</Label>
                <Input value={form.paymentTerms} onChange={e => f('paymentTerms', e.target.value)}
                  placeholder="月結30天" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>配送區域</Label>
              <Input value={form.regions} onChange={e => f('regions', e.target.value)}
                placeholder="全台灣 / 北部 / 中部 / 南部" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>聯絡窗口</Label>
                <Input value={form.contactPerson} onChange={e => f('contactPerson', e.target.value)}
                  placeholder="業務聯絡人" />
              </div>
              <div className="space-y-1.5">
                <Label>聯絡電話</Label>
                <Input value={form.contactPhone} onChange={e => f('contactPhone', e.target.value)}
                  placeholder="02-1234-5678" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>聯絡信箱</Label>
              <Input value={form.contactEmail} onChange={e => f('contactEmail', e.target.value)}
                placeholder="logistics@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>運價表</Label>
              <Textarea value={form.rateCard} onChange={e => f('rateCard', e.target.value)}
                rows={2} placeholder="重量/材積計費說明..." />
            </div>
            <div className="space-y-1.5">
              <Label>異常理賠規則</Label>
              <Textarea value={form.claimRules} onChange={e => f('claimRules', e.target.value)}
                rows={2} placeholder="損毀賠償條件..." />
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea value={form.notes} onChange={e => f('notes', e.target.value)}
                rows={2} placeholder="特殊說明..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? '儲存' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
