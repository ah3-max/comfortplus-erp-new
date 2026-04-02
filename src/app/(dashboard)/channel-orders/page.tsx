'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import { Plus, Search, ShoppingBag, Store, Package, Link as LinkIcon, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'


interface ChannelOrderItem {
  id: string
  quantity: number
  unitPrice: number
  subtotal: number
  product: { sku: string; name: string; unit: string | null }
}

interface ChannelOrder {
  id: string
  channelOrderNo: string
  channel: { id: string; code: string; name: string; platform: string }
  salesOrder: { id: string; orderNo: string; status: string } | null
  buyerName: string | null
  buyerPhone: string | null
  buyerAddress: string | null
  orderAmount: number
  platformFee: number | null
  shippingFee: number | null
  netAmount: number | null
  status: string
  paymentStatus: string | null
  orderedAt: string
  notes: string | null
  items: ChannelOrderItem[]
}

interface SalesChannel { id: string; code: string; name: string; platform: string }
interface Product { id: string; sku: string; name: string; sellingPrice: number | null }

export default function ChannelOrdersPage() {
  const { dict } = useI18n()
  const d = dict.channelOrders
  type StatusKey = keyof typeof d.statuses
  const getStatusLabel = (s: string) => d.statuses[s as StatusKey] ?? s
  const getStatusColor = (s: string) => d.statusColors[s as StatusKey] ?? 'bg-gray-100 text-gray-500'
  const [orders, setOrders] = useState<ChannelOrder[]>([])
  const [channels, setChannels] = useState<SalesChannel[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [syncingChannelId, setSyncingChannelId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [selected, setSelected] = useState<ChannelOrder | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    channelId: '', channelOrderNo: '', buyerName: '', buyerPhone: '',
    buyerAddress: '', platformFee: '', shippingFee: '', orderedAt: new Date().toISOString().slice(0, 10), notes: '',
  })
  const [formItems, setFormItems] = useState([{ productId: '', quantity: '1', unitPrice: '' }])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterChannel) params.set('channelId', filterChannel)
      if (filterStatus) params.set('status', filterStatus)
      const [ordRes, chRes, prodRes] = await Promise.all([
        fetch(`/api/channel-orders?${params}`),
        fetch('/api/channels'),
        fetch('/api/products?pageSize=500'),
      ])
      if (ordRes.ok) { const d = await ordRes.json(); setOrders(Array.isArray(d) ? d : (d.data ?? [])) }
      if (chRes.ok) {
        const d = await chRes.json()
        setChannels(d.data ?? d)
      }
      if (prodRes.ok) {
        const d = await prodRes.json()
        setProducts(d.data ?? d)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [filterChannel, filterStatus])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    const items = formItems.filter(i => i.productId && i.quantity && i.unitPrice)
    if (!form.channelId || !form.channelOrderNo || items.length === 0) {
      toast.error(dict.channelOrders.fieldsRequired)
      return
    }
    try {
      const res = await fetch('/api/channel-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          platformFee: form.platformFee ? Number(form.platformFee) : null,
          shippingFee: form.shippingFee ? Number(form.shippingFee) : null,
          items: items.map(i => ({ productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? dict.common.createFailed)
      toast.success(dict.channelOrders.created)
      setShowCreate(false)
      setForm({ channelId: '', channelOrderNo: '', buyerName: '', buyerPhone: '', buyerAddress: '', platformFee: '', shippingFee: '', orderedAt: new Date().toISOString().slice(0, 10), notes: '' })
      setFormItems([{ productId: '', quantity: '1', unitPrice: '' }])
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : dict.common.createFailed) }
  }

  const handleSync = async (channelId: string, channelName: string) => {
    setSyncingChannelId(channelId)
    try {
      const res = await fetch(`/api/channels/${channelId}/sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (data.missingCredentials) {
          toast.error(`${channelName}：${d.missingCredentials}`)
        } else if (data.supported === false) {
          toast.info(`${channelName}：${d.unsupportedSync}`)
        } else {
          toast.error(data.error ?? d.syncFailed)
        }
      } else {
        toast.success(`${channelName} ${data.message}`)
        // Warn about unmatched SKUs
        if (data.unmatchedSkus?.length > 0) {
          const skus = `${data.unmatchedSkus.slice(0, 3).join('、')}${data.unmatchedSkus.length > 3 ? '…' : ''}`
          toast.warning(
            d.unmatchedSkuWarning.replace('{n}', String(data.unmatchedSkus.length)).replace('{skus}', skus),
            { duration: 8000 }
          )
        }
        load()
      }
    } catch { toast.error(d.syncError) }
    finally { setSyncingChannelId(null) }
  }

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/channel-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success(dict.common.statusUpdated)
      setSelected(null)
      load()
    } catch { toast.error(dict.common.updateFailed) }
  }

  const filtered = orders.filter(o =>
    o.channelOrderNo.toLowerCase().includes(search.toLowerCase()) ||
    (o.buyerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    o.channel.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalRevenue = filtered.reduce((s, o) => s + Number(o.orderAmount), 0)
  const pendingCount = filtered.filter(o => o.status === 'PENDING').length

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{d.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{d.subtitle}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {channels.filter(c => ['SHOPEE', 'MOMO'].includes(c.platform.toUpperCase())).map(c => (
            <Button key={c.id} variant="outline" size="sm"
              disabled={syncingChannelId === c.id}
              onClick={() => handleSync(c.id, c.name)}>
              {syncingChannelId === c.id
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                : <RefreshCw className="mr-1.5 h-4 w-4" />}
              {d.syncBtn.replace('{name}', c.name)}
            </Button>
          ))}
          <Button onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus size={16} />{d.newOrder}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">{d.totalOrders}</div>
          <div className="text-2xl font-bold">{filtered.length}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
            <ShoppingBag size={12} className="text-yellow-500" />{d.pending}
          </div>
          <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">{d.revenue}</div>
          <div className="text-xl font-bold">NT${totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">{d.channelCount}</div>
          <div className="text-2xl font-bold">{channels.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={d.searchPlaceholder} className="pl-8 h-9" />
        </div>
        <Select value={filterChannel || '_all'} onValueChange={v => setFilterChannel(v === '_all' ? '' : (v ?? ''))}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{d.allChannels}</SelectItem>
            {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus || '_all'} onValueChange={v => setFilterStatus(v === '_all' ? '' : (v ?? ''))}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{d.allStatuses}</SelectItem>
            {Object.keys(d.statuses).map(k => <SelectItem key={k} value={k}>{getStatusLabel(k)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {[d.platformOrderNo, d.channel, d.buyerName, d.orderAmount, d.platformFee, d.netAmount, dict.common.status, d.orderedAt, d.linkedOrder].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">{dict.common.loading}</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-gray-400">
                    <Store size={36} className="mx-auto mb-2 opacity-30" />
                    <p>{d.noOrders}</p>
                  </td>
                </tr>
              ) : filtered.map(o => (
                <tr key={o.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(o)}>
                  <td className="px-4 py-2.5 font-mono font-medium text-blue-700">{o.channelOrderNo}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Store size={13} className="text-gray-400" />
                      <span>{o.channel.name}</span>
                    </div>
                    <div className="text-xs text-gray-400">{o.channel.platform}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div>{o.buyerName ?? '-'}</div>
                    {o.buyerPhone && <div className="text-xs text-gray-400">{o.buyerPhone}</div>}
                  </td>
                  <td className="px-4 py-2.5 font-medium">NT${Number(o.orderAmount).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-500">{o.platformFee ? `NT$${Number(o.platformFee).toLocaleString()}` : '-'}</td>
                  <td className="px-4 py-2.5 text-emerald-700 font-medium">{o.netAmount ? `NT$${Number(o.netAmount).toLocaleString()}` : '-'}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={getStatusColor(o.status)}>{getStatusLabel(o.status)}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(o.orderedAt).toLocaleDateString('zh-TW')}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {o.salesOrder ? (
                      <span className="text-blue-600 flex items-center gap-1"><LinkIcon size={11} />{o.salesOrder.orderNo}</span>
                    ) : <span className="text-gray-300">{d.notLinked}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{d.newOrder}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{d.channel} *</div>
                <Select value={form.channelId} onValueChange={v => setForm(f => ({ ...f, channelId: v ?? '' }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={d.selectChannel} /></SelectTrigger>
                  <SelectContent>
                    {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{d.platformOrderNo} *</div>
                <Input value={form.channelOrderNo} onChange={e => setForm(f => ({ ...f, channelOrderNo: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{d.buyerName}</div>
                <Input value={form.buyerName} onChange={e => setForm(f => ({ ...f, buyerName: e.target.value }))} className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{d.buyerPhone}</div>
                <Input value={form.buyerPhone} onChange={e => setForm(f => ({ ...f, buyerPhone: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{d.buyerAddress}</div>
              <Input value={form.buyerAddress} onChange={e => setForm(f => ({ ...f, buyerAddress: e.target.value }))} className="h-9" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">{d.platformFee}</div>
                <Input type="number" value={form.platformFee} onChange={e => setForm(f => ({ ...f, platformFee: e.target.value }))} className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{d.shippingFee}</div>
                <Input type="number" value={form.shippingFee} onChange={e => setForm(f => ({ ...f, shippingFee: e.target.value }))} className="h-9" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{d.orderedAt}</div>
                <Input type="date" value={form.orderedAt} onChange={e => setForm(f => ({ ...f, orderedAt: e.target.value }))} className="h-9" />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                <Package size={12} />{d.itemsLabel} *
              </div>
              {formItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_90px_24px] gap-1.5 mb-1.5">
                  <Select value={item.productId} onValueChange={v => {
                    const safeV = v ?? ''
                    const prod = products.find(p => p.id === safeV)
                    setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, productId: safeV, unitPrice: prod?.sellingPrice ? String(prod.sellingPrice) : it.unitPrice } : it))
                  }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={d.selectProduct} /></SelectTrigger>
                    <SelectContent className="max-h-60 w-[300px]">
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" value={item.quantity} min="1"
                    onChange={e => setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))}
                    placeholder={dict.common.quantity} className="h-8 text-xs px-2" />
                  <Input type="number" value={item.unitPrice}
                    onChange={e => setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPrice: e.target.value } : it))}
                    placeholder={dict.common.price} className="h-8 text-xs px-2" />
                  <button onClick={() => setFormItems(prev => prev.filter((_, i) => i !== idx))}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-xs mt-0.5"
                onClick={() => setFormItems(prev => [...prev, { productId: '', quantity: '1', unitPrice: '' }])}>
                <Plus size={11} className="mr-1" />{d.addItem}
              </Button>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">{d.notesLabel}</div>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-9" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} className="flex-1">{dict.common.create}</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>{dict.common.cancel}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Store size={16} />{selected.channelOrderNo}
                  <Badge className={getStatusColor(selected.status)}>{getStatusLabel(selected.status)}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    [d.channel, selected.channel.name],
                    [d.platform, selected.channel.platform],
                    [d.buyerName, selected.buyerName ?? '-'],
                    [d.buyerPhone, selected.buyerPhone ?? '-'],
                    [d.orderAmount, `NT$${Number(selected.orderAmount).toLocaleString()}`],
                    [d.netAmount, selected.netAmount ? `NT$${Number(selected.netAmount).toLocaleString()}` : '-'],
                    [d.platformFee, selected.platformFee ? `NT$${Number(selected.platformFee).toLocaleString()}` : '-'],
                    [d.orderedAt, new Date(selected.orderedAt).toLocaleDateString('zh-TW')],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400">{k}</div>
                      <div className="font-medium">{v}</div>
                    </div>
                  ))}
                </div>
                {selected.buyerAddress && (
                  <div className="text-xs bg-gray-50 rounded p-2">
                    <div className="text-gray-400 mb-0.5">{d.buyerAddress}</div>
                    <div>{selected.buyerAddress}</div>
                  </div>
                )}
                {selected.salesOrder && (
                  <div className="text-xs bg-blue-50 text-blue-700 rounded p-2 flex items-center gap-1.5">
                    <LinkIcon size={11} />{d.linkedOrder}：{selected.salesOrder.orderNo}
                  </div>
                )}
                {selected.items.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-1.5">{d.itemsLabel}</div>
                    {selected.items.map(item => (
                      <div key={item.id} className="text-xs border rounded p-2 mb-1 flex justify-between">
                        <div>
                          <span className="font-medium">{item.product.name}</span>
                          <span className="text-gray-400 ml-1">({item.product.sku})</span>
                        </div>
                        <div className="text-right">
                          <div>{item.quantity} × NT${Number(item.unitPrice).toLocaleString()}</div>
                          <div className="text-gray-500">= NT${Number(item.subtotal).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selected.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">{selected.notes}</p>}

                {/* Status Actions */}
                {!['COMPLETED', 'CANCELLED', 'RETURNED'].includes(selected.status) && (
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-1.5">{d.updateStatus}</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(d.statuses)
                        .filter(k => k !== selected.status && !['PENDING'].includes(k))
                        .map(k => (
                          <Button key={k} size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => handleStatusUpdate(selected.id, k)}>
                            → {getStatusLabel(k)}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
