'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, TrendingUp, TrendingDown, SlidersHorizontal, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface InventoryItem {
  productId: string
  quantity: number
  product: { sku: string; name: string; unit: string }
}

interface AdjustFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  item: InventoryItem | null
}

type AdjustType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN'

const typeConfig: Record<AdjustType, {
  label: string
  description: string
  icon: React.ReactNode
  color: string
}> = {
  IN:         { label: '入庫',   description: '採購入庫、退貨入庫', icon: <TrendingUp className="h-4 w-4" />,        color: 'border-green-500 bg-green-50 text-green-700' },
  OUT:        { label: '出庫',   description: '手動出庫、樣品',      icon: <TrendingDown className="h-4 w-4" />,      color: 'border-red-500 bg-red-50 text-red-700' },
  ADJUSTMENT: { label: '盤點調整', description: '盤點後修正庫存數量', icon: <SlidersHorizontal className="h-4 w-4" />, color: 'border-blue-500 bg-blue-50 text-blue-700' },
  RETURN:     { label: '退貨入庫', description: '客戶退回商品',        icon: <RotateCcw className="h-4 w-4" />,         color: 'border-amber-500 bg-amber-50 text-amber-700' },
}

export function AdjustForm({ open, onClose, onSuccess, item }: AdjustFormProps) {
  const [type, setType] = useState<AdjustType>('IN')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const current = item?.quantity ?? 0
  const qty = Number(quantity)
  const preview = type === 'ADJUSTMENT'
    ? qty
    : type === 'OUT'
    ? current - qty
    : current + qty

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return
    if (!quantity || qty <= 0) { toast.error('請輸入有效數量'); return }

    setLoading(true)
    const res = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: item.productId,
        type,
        quantity: qty,
        notes,
      }),
    })
    setLoading(false)

    if (res.ok) {
      toast.success('庫存已調整')
      setQuantity('')
      setNotes('')
      onSuccess()
      onClose()
    } else {
      const data = await res.json()
      toast.error(data.error ?? '調整失敗')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>庫存調整</DialogTitle>
        </DialogHeader>
        {item && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 商品資訊 */}
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-medium">{item.product.name}</p>
              <p className="text-xs text-muted-foreground">{item.product.sku}</p>
              <p className="mt-1 text-sm">
                目前庫存：<span className="font-bold text-slate-900">{current} {item.product.unit}</span>
              </p>
            </div>

            {/* 異動類型 */}
            <div>
              <Label className="mb-2 block">異動類型</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(typeConfig) as AdjustType[]).map((t) => {
                  const cfg = typeConfig[t]
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all',
                        type === t ? cfg.color : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {cfg.icon}
                      <div className="text-left">
                        <div>{cfg.label}</div>
                        <div className="text-xs font-normal opacity-70">{cfg.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 數量 */}
            <div className="space-y-1.5">
              <Label>
                {type === 'ADJUSTMENT' ? '調整後數量' : '數量'}
                <span className="text-red-500"> *</span>
              </Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={type === 'ADJUSTMENT' ? '輸入盤點後的實際數量' : '輸入數量'}
                min={type === 'ADJUSTMENT' ? 0 : 1}
                required
              />
              {quantity && !isNaN(qty) && (
                <p className={cn(
                  'text-sm font-medium',
                  preview < 0 ? 'text-red-600' : preview < (current * 0.2) ? 'text-amber-600' : 'text-green-600'
                )}>
                  調整後庫存：{preview} {item.product.unit}
                  {preview < 0 && <span className="ml-1 text-red-600">（庫存不足）</span>}
                </p>
              )}
            </div>

            {/* 備註 */}
            <div className="space-y-1.5">
              <Label>備註</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="調整原因..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>取消</Button>
              <Button type="submit" disabled={loading || preview < 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                確認調整
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
