'use client'

import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Plus, Pencil, Trash2, Store, ShoppingBag, Power, PowerOff,
  Loader2, ExternalLink, Package,
} from 'lucide-react'
import { toast } from 'sonner'

/* ─── Types ─────────────────────────────────────────────── */
interface SalesChannel {
  id: string
  code: string
  name: string
  platform: string
  shopUrl: string | null
  commissionRate: number | null
  contact: string | null
  isActive: boolean
  _count: { channelOrders: number }
}

interface ChannelOrderItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

interface ChannelOrder {
  id: string
  channelOrderNo: string
  status: string
  buyerName: string
  buyerPhone: string | null
  buyerAddress: string | null
  totalAmount: number
  platformFee: number | null
  notes: string | null
  createdAt: string
  channel: { id: string; name: string; platform: string }
  linkedOrder: { id: string; orderNo: string } | null
  items: ChannelOrderItem[]
}

interface Product {
  id: string
  name: string
  code: string
  sellingPrice: number | null
}

/* ─── Constants ──────────────────────────────────────────── */
const PLATFORMS: Record<string, { label: string; color: string }> = {
  SHOPEE:    { label: '蝦皮購物',   color: 'bg-orange-100 text-orange-700' },
  MOMO:      { label: 'momo購物',   color: 'bg-pink-100 text-pink-700' },
  PCHOME:    { label: 'PChome',     color: 'bg-blue-100 text-blue-700' },
  YAHOO:     { label: 'Yahoo購物',  color: 'bg-purple-100 text-purple-700' },
  RAKUTEN:   { label: '樂天市場',   color: 'bg-red-100 text-red-700' },
  LINE_SHOP: { label: 'LINE購物',   color: 'bg-green-100 text-green-700' },
  OFFICIAL:  { label: '官方商城',   color: 'bg-slate-100 text-slate-700' },
  OTHER:     { label: '其他',       color: 'bg-gray-100 text-gray-600' },
}

const ORDER_STATUSES: Record<string, { label: string; color: string }> = {
  PENDING:    { label: '待處理', color: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED:  { label: '已確認', color: 'bg-blue-100 text-blue-700' },
  SHIPPED:    { label: '已出貨', color: 'bg-indigo-100 text-indigo-700' },
  DELIVERED:  { label: '已送達', color: 'bg-teal-100 text-teal-700' },
  COMPLETED:  { label: '已完成', color: 'bg-green-100 text-green-700' },
  CANCELLED:  { label: '已取消', color: 'bg-slate-100 text-slate-500' },
  RETURNED:   { label: '已退貨', color: 'bg-red-100 text-red-700' },
}

const emptyChannel = {
  code: '', name: '', platform: 'SHOPEE',
  shopUrl: '', commissionRate: '', contact: '',
}

const emptyOrderItem = { productId: '', quantity: 1, unitPrice: 0 }

const emptyOrder = {
  channelId: '', buyerName: '', buyerPhone: '', buyerAddress: '',
  platformFee: '', notes: '', status: 'PENDING',
  items: [{ ...emptyOrderItem }],
}

/* ─── Component ──────────────────────────────────────────── */
export default function ChannelsPage() {
  const { dict } = useI18n()
  const [channels, setChannels]       = useState<SalesChannel[]>([])
  const [orders, setOrders]           = useState<ChannelOrder[]>([])
  const [products, setProducts]       = useState<Product[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'channels' | 'orders'>('channels')

  // channel dialog
  const [chOpen, setChOpen]           = useState(false)
  const [chEdit, setChEdit]           = useState<SalesChannel | null>(null)
  const [chForm, setChForm]           = useState({ ...emptyChannel })

  // order dialog
  const [ordOpen, setOrdOpen]         = useState(false)
  const [ordEdit, setOrdEdit]         = useState<ChannelOrder | null>(null)
  const [ordForm, setOrdForm]         = useState<{
    channelId: string; buyerName: string; buyerPhone: string; buyerAddress: string
    platformFee: string; notes: string; status: string
    items: { productId: string; quantity: number; unitPrice: number }[]
  }>({ ...emptyOrder })

  // filters
  const [filterChannel, setFilterChannel] = useState('_none')
  const [filterStatus, setFilterStatus]   = useState('_none')

  const [saving, setSaving] = useState(false)

  /* ─── Data loading ──────────────────────────────────────── */
  const loadChannels = useCallback(async () => {
    const res = await fetch('/api/channels')
    const data = await res.json()
    setChannels(Array.isArray(data) ? data : [])
  }, [])

  const loadOrders = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterChannel !== '_none') params.set('channelId', filterChannel)
    if (filterStatus !== '_none') params.set('status', filterStatus)
    const res = await fetch(`/api/channel-orders?${params}`)
    const data = await res.json()
    setOrders(Array.isArray(data) ? data : [])
  }, [filterChannel, filterStatus])

  const loadProducts = useCallback(async () => {
    const res = await fetch('/api/products')
    const data = await res.json()
    setProducts(Array.isArray(data) ? data : [])
  }, [])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadChannels(), loadOrders(), loadProducts()])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading) loadOrders()
  }, [filterChannel, filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Channel CRUD ──────────────────────────────────────── */
  function openNewChannel() {
    setChEdit(null)
    setChForm({ ...emptyChannel })
    setChOpen(true)
  }

  function openEditChannel(ch: SalesChannel) {
    setChEdit(ch)
    setChForm({
      code:           ch.code,
      name:           ch.name,
      platform:       ch.platform,
      shopUrl:        ch.shopUrl ?? '',
      commissionRate: ch.commissionRate != null ? String(ch.commissionRate) : '',
      contact:        ch.contact ?? '',
    })
    setChOpen(true)
  }

  async function saveChannel() {
    setSaving(true)
    const body = {
      code:           chForm.code,
      name:           chForm.name,
      platform:       chForm.platform,
      shopUrl:        chForm.shopUrl || null,
      commissionRate: chForm.commissionRate ? parseFloat(chForm.commissionRate) : null,
      contact:        chForm.contact || null,
    }
    const url    = chEdit ? `/api/channels/${chEdit.id}` : '/api/channels'
    const method = chEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success(chEdit ? dict.common.updateSuccess : dict.common.createSuccess)
      setChOpen(false)
      loadChannels()
    } else {
      const err = await res.json().catch(() => null)
      toast.error(err?.error ?? dict.common.operationFailed)
    }
    setSaving(false)
  }

  async function toggleChannel(ch: SalesChannel) {
    const res = await fetch(`/api/channels/${ch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !ch.isActive }),
    })
    if (res.ok) {
      toast.success(dict.common.statusUpdated)
      loadChannels()
    } else {
      toast.error(dict.common.operationFailed)
    }
  }

  async function deleteChannel(ch: SalesChannel) {
    if (!confirm(`確定要刪除通路「${ch.name}」嗎？`)) return
    const res = await fetch(`/api/channels/${ch.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(dict.channels.deletedSuccess)
      loadChannels()
    } else {
      toast.error(dict.channels.deleteFailedLinked)
    }
  }

  /* ─── Order CRUD ────────────────────────────────────────── */
  function openNewOrder() {
    setOrdEdit(null)
    setOrdForm({ ...emptyOrder, items: [{ ...emptyOrderItem }] })
    setOrdOpen(true)
  }

  function openEditOrder(o: ChannelOrder) {
    setOrdEdit(o)
    setOrdForm({
      channelId:    o.channel.id,
      buyerName:    o.buyerName,
      buyerPhone:   o.buyerPhone ?? '',
      buyerAddress: o.buyerAddress ?? '',
      platformFee:  o.platformFee != null ? String(o.platformFee) : '',
      notes:        o.notes ?? '',
      status:       o.status,
      items: o.items.map(i => ({
        productId: i.productId,
        quantity:  i.quantity,
        unitPrice: i.unitPrice,
      })),
    })
    setOrdOpen(true)
  }

  function updateOrderItem(idx: number, field: string, value: string | number) {
    setOrdForm(f => {
      const items = [...f.items]
      items[idx] = { ...items[idx], [field]: value }
      return { ...f, items }
    })
  }

  function addOrderItem() {
    setOrdForm(f => ({ ...f, items: [...f.items, { ...emptyOrderItem }] }))
  }

  function removeOrderItem(idx: number) {
    setOrdForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  async function saveOrder() {
    setSaving(true)
    const body = {
      channelId:    ordForm.channelId,
      buyerName:    ordForm.buyerName,
      buyerPhone:   ordForm.buyerPhone || null,
      buyerAddress: ordForm.buyerAddress || null,
      platformFee:  ordForm.platformFee ? parseFloat(ordForm.platformFee) : null,
      notes:        ordForm.notes || null,
      status:       ordForm.status,
      items: ordForm.items
        .filter(i => i.productId)
        .map(i => ({
          productId: i.productId,
          quantity:  Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
    }
    const url    = ordEdit ? `/api/channel-orders/${ordEdit.id}` : '/api/channel-orders'
    const method = ordEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success(ordEdit ? dict.common.updateSuccess : dict.common.createSuccess)
      setOrdOpen(false)
      loadOrders()
    } else {
      const err = await res.json().catch(() => null)
      toast.error(err?.error ?? dict.common.operationFailed)
    }
    setSaving(false)
  }

  /* ─── Computed ──────────────────────────────────────────── */
  const activeChannels = channels.filter(c => c.isActive).length
  const totalOrders    = orders.length
  const orderTotal     = orders.reduce((s, o) => s + o.totalAmount, 0)

  const itemsTotal = ordForm.items.reduce(
    (s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0
  )

  const tabStyle = (t: string) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
      tab === t
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.channels.title}</h1>
          <p className="text-sm text-slate-500 mt-1">管理各電商平台通路與通路訂單</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Store className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{activeChannels}</p>
              <p className="text-sm text-slate-500">{dict.channels.channelMgmt}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{totalOrders}</p>
              <p className="text-sm text-slate-500">{dict.channels.channelOrders}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">
                ${orderTotal.toLocaleString()}
              </p>
              <p className="text-sm text-slate-500">訂單總金額</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="border-b flex gap-0">
        <button className={tabStyle('channels')} onClick={() => setTab('channels')}>{dict.channels.channelMgmt}</button>
        <button className={tabStyle('orders')}   onClick={() => setTab('orders')}>{dict.channels.channelOrders}</button>
      </div>

      {/* ─── Channels Tab ─────────────────────────────────── */}
      {tab === 'channels' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewChannel}>
              <Plus className="h-4 w-4 mr-2" />{dict.channelsExt.newChannel}
            </Button>
          </div>

          {/* Channel Form Dialog */}
          <Dialog open={chOpen} onOpenChange={setChOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{chEdit ? dict.common.edit : dict.channelsExt.newChannel}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>通路代碼 *</Label>
                    <Input
                      value={chForm.code}
                      onChange={e => setChForm(f => ({ ...f, code: e.target.value }))}
                      placeholder="例：SHOPEE-01"
                    />
                  </div>
                  <div>
                    <Label>通路名稱 *</Label>
                    <Input
                      value={chForm.name}
                      onChange={e => setChForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="例：蝦皮旗艦店"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>平台</Label>
                    <Select
                      value={chForm.platform}
                      onValueChange={v => setChForm(f => ({ ...f, platform: v ?? 'SHOPEE' }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PLATFORMS).map(([k, { label }]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>佣金費率 (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={chForm.commissionRate}
                      onChange={e => setChForm(f => ({ ...f, commissionRate: e.target.value }))}
                      placeholder="例：5.5"
                    />
                  </div>
                </div>
                <div>
                  <Label>商店網址</Label>
                  <Input
                    value={chForm.shopUrl}
                    onChange={e => setChForm(f => ({ ...f, shopUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>聯絡資訊</Label>
                  <Input
                    value={chForm.contact}
                    onChange={e => setChForm(f => ({ ...f, contact: e.target.value }))}
                    placeholder="聯絡人 / 電話 / Email"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setChOpen(false)}>{dict.common.cancel}</Button>
                <Button
                  onClick={saveChannel}
                  disabled={saving || !chForm.code || !chForm.name}
                >
                  {saving ? dict.common.saving : dict.common.save}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Channel Cards Grid */}
          {loading ? (
            <div className="text-center py-20">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Store className="h-10 w-10 mx-auto mb-2 opacity-30" />
              {dict.channelsExt.noChannels}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channels.map(ch => {
                const plt = PLATFORMS[ch.platform] ?? PLATFORMS.OTHER
                return (
                  <Card
                    key={ch.id}
                    className={`relative transition-opacity ${!ch.isActive ? 'opacity-60' : ''}`}
                  >
                    <CardContent className="p-5 space-y-3">
                      {/* Header: platform badge + status */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${plt.color}`}>
                          {plt.label}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            ch.isActive
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          {ch.isActive ? '啟用' : '停用'}
                        </Badge>
                      </div>

                      {/* Name + code */}
                      <div>
                        <p className="font-semibold text-slate-900 text-base">{ch.name}</p>
                        <p className="font-mono text-xs text-slate-400">{ch.code}</p>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <ShoppingBag className="h-3.5 w-3.5" />
                          {ch._count.channelOrders} 筆訂單
                        </span>
                        {ch.commissionRate != null && (
                          <span>佣金 {ch.commissionRate}%</span>
                        )}
                      </div>

                      {/* Contact */}
                      {ch.contact && (
                        <p className="text-sm text-slate-500 truncate">{ch.contact}</p>
                      )}

                      {/* Shop URL */}
                      {ch.shopUrl && (
                        <a
                          href={ch.shopUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          商店連結
                        </a>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditChannel(ch)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />編輯
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleChannel(ch)}
                          className={ch.isActive ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-green-600 border-green-200 hover:bg-green-50'}
                        >
                          {ch.isActive
                            ? <><PowerOff className="h-3.5 w-3.5 mr-1" />停用</>
                            : <><Power className="h-3.5 w-3.5 mr-1" />啟用</>
                          }
                        </Button>
                        {ch._count.channelOrders === 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteChannel(ch)}
                            className="text-red-500 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />刪除
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Orders Tab ───────────────────────────────────── */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* Filters + Add */}
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={filterChannel}
              onValueChange={v => setFilterChannel(v ?? '_none')}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="所有通路" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">所有通路</SelectItem>
                {channels.filter(c => c.isActive).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterStatus}
              onValueChange={v => setFilterStatus(v ?? '_none')}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="所有狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">所有狀態</SelectItem>
                {Object.entries(ORDER_STATUSES).map(([k, { label }]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Button onClick={openNewOrder}>
              <Plus className="h-4 w-4 mr-2" />{dict.channels.channelOrders}
            </Button>
          </div>

          {/* Order Form Dialog */}
          <Dialog open={ordOpen} onOpenChange={setOrdOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{ordEdit ? dict.common.edit : dict.channels.channelOrders}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
                {/* Channel + Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>通路 *</Label>
                    <Select
                      value={ordForm.channelId || '_none'}
                      onValueChange={v => setOrdForm(f => ({ ...f, channelId: v === '_none' ? '' : (v ?? '') }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="選擇通路" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">-- 選擇通路 --</SelectItem>
                        {channels.filter(c => c.isActive).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>狀態</Label>
                    <Select
                      value={ordForm.status}
                      onValueChange={v => setOrdForm(f => ({ ...f, status: v ?? 'PENDING' }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ORDER_STATUSES).map(([k, { label }]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Buyer Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>買家姓名 *</Label>
                    <Input
                      value={ordForm.buyerName}
                      onChange={e => setOrdForm(f => ({ ...f, buyerName: e.target.value }))}
                      placeholder="買家姓名"
                    />
                  </div>
                  <div>
                    <Label>買家電話</Label>
                    <Input
                      value={ordForm.buyerPhone}
                      onChange={e => setOrdForm(f => ({ ...f, buyerPhone: e.target.value }))}
                      placeholder="電話"
                    />
                  </div>
                </div>
                <div>
                  <Label>買家地址</Label>
                  <Input
                    value={ordForm.buyerAddress}
                    onChange={e => setOrdForm(f => ({ ...f, buyerAddress: e.target.value }))}
                    placeholder="配送地址"
                  />
                </div>

                {/* Order Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>訂單明細</Label>
                    <Button size="sm" variant="outline" onClick={addOrderItem}>
                      <Plus className="h-3.5 w-3.5 mr-1" />新增品項
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {ordForm.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          {idx === 0 && <Label className="text-xs text-slate-500">產品</Label>}
                          <Select
                            value={item.productId || '_none'}
                            onValueChange={v => {
                              const pid = v === '_none' ? '' : (v ?? '')
                              updateOrderItem(idx, 'productId', pid)
                              // auto-fill price
                              if (pid) {
                                const p = products.find(p => p.id === pid)
                                if (p?.sellingPrice) updateOrderItem(idx, 'unitPrice', p.sellingPrice)
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="選擇產品" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">-- 選擇產品 --</SelectItem>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  [{p.code}] {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          {idx === 0 && <Label className="text-xs text-slate-500">數量</Label>}
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateOrderItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="col-span-3">
                          {idx === 0 && <Label className="text-xs text-slate-500">單價</Label>}
                          <Input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={e => updateOrderItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-1">
                          <span className="text-sm text-slate-600 flex-1 text-right">
                            ${((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toLocaleString()}
                          </span>
                          {ordForm.items.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeOrderItem(idx)}
                              className="text-red-400 hover:text-red-600 px-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-right text-sm font-medium text-slate-700 mt-2">
                    小計：${itemsTotal.toLocaleString()}
                  </div>
                </div>

                {/* Platform fee + notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>平台手續費</Label>
                    <Input
                      type="number"
                      min="0"
                      value={ordForm.platformFee}
                      onChange={e => setOrdForm(f => ({ ...f, platformFee: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-slate-500">
                      實收金額：$
                      {(itemsTotal - (parseFloat(ordForm.platformFee) || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div>
                  <Label>備註</Label>
                  <Textarea
                    rows={2}
                    value={ordForm.notes}
                    onChange={e => setOrdForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="備註..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOrdOpen(false)}>{dict.common.cancel}</Button>
                <Button
                  onClick={saveOrder}
                  disabled={saving || !ordForm.channelId || !ordForm.buyerName || ordForm.items.every(i => !i.productId)}
                >
                  {saving ? dict.common.saving : dict.common.save}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>平台/通路</TableHead>
                    <TableHead>通路訂單編號</TableHead>
                    <TableHead>買家資訊</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead className="text-right">平台手續費</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>內部訂單</TableHead>
                    <TableHead>建立日期</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center text-slate-400">
                        <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        目前無通路訂單
                      </TableCell>
                    </TableRow>
                  ) : orders.map(o => {
                    const plt = PLATFORMS[o.channel.platform] ?? PLATFORMS.OTHER
                    const st  = ORDER_STATUSES[o.status] ?? ORDER_STATUSES.PENDING
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${plt.color}`}>
                              {plt.label}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">{o.channel.name}</span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{o.channelOrderNo}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{o.buyerName}</div>
                          <div className="text-xs text-slate-400">{o.buyerPhone ?? ''}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${o.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-500">
                          {o.platformFee != null ? `$${o.platformFee.toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {o.linkedOrder ? (
                            <span className="text-blue-600 font-mono text-xs">{o.linkedOrder.orderNo}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {o.createdAt.substring(0, 10)}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => openEditOrder(o)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
