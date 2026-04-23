'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import {
  Bot, X, Send, Loader2, Sparkles,
  BarChart3, Users, Package, ShoppingCart,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'

interface Message {
  role: 'user' | 'assistant'
  content: string
  /** Skill result actions (buttons with links) */
  actions?: { label: string; href: string }[]
  /** Is this a skill result? */
  isSkill?: boolean
}

interface AnalysisType {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

// ANALYSES moved inside component to access i18n dict

function getPageContext(pathname: string): 'dashboard' | 'orders' | 'customers' | 'inventory' | undefined {
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/orders')) return 'orders'
  if (pathname.startsWith('/customers')) return 'customers'
  if (pathname.startsWith('/inventory')) return 'inventory'
  return undefined
}

export function AiAssistant() {
  const { dict } = useI18n()

  const ANALYSES: AnalysisType[] = [
    { key: 'order', label: dict.ai.orderAnalysis, icon: ShoppingCart },
    { key: 'customer', label: dict.ai.customerInsight, icon: Users },
    { key: 'inventory', label: dict.ai.inventorySuggestion, icon: Package },
    { key: 'sales', label: dict.ai.salesAnalysis, icon: BarChart3 },
  ]

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pathname = usePathname()

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 100)
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  // Detect if the message looks like a skill command
  function looksLikeSkillCommand(msg: string): boolean {
    const skillKeywords = [
      '報價', '出報價', '報價單', '幫我報',
      '送貨', '出貨', '今天送', '要送哪',
      '庫存', '盤點', '缺貨',
      '找客戶', '搜尋客戶', '查客戶',
      'KPI', 'kpi', '目標', '達成率', '業績目標',
      // summarize-customer
      '介紹', '最近狀況', '現況', '摘要', '客戶資料',
      // draft-collection-email
      '催收', '催款', '催帳', '催信', '寫信', '寫一封',
      // create-task
      '提醒我', '安排', '記下', '加一個任務', '待辦',
      // top-customers
      '前幾大', '前幾名', '前 N', '排行', '最多訂單', '最多錢', '欠最多',
      // pipeline-health
      'pipeline', '卡住', '該跟進', '追蹤一下',
    ]
    return skillKeywords.some(k => msg.includes(k))
  }

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      // Try skill execution first for action-oriented messages
      if (looksLikeSkillCommand(msg)) {
        const skillRes = await fetch('/api/ai/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg }),
        })

        if (skillRes.ok) {
          const skillData = await skillRes.json()
          if (skillData.skill !== 'none' && skillData.skill !== 'error') {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: skillData.message,
              actions: skillData.actions,
              isSkill: true,
            }])
            setLoading(false)
            return
          }
        }
      }

      // Fallback to regular chat
      const context = getPageContext(pathname)
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history, context }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? dict.ai.connectionFailedShort)
      }

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `${dict.ai.connectionError}：${(e as Error).message}\n\n${dict.ai.checkOllama}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  async function runAnalysis(type: string) {
    setAnalyzing(type)
    setMessages(prev => [...prev, { role: 'user', content: `${dict.ai.runAnalysisPrefix}${ANALYSES.find(a => a.key === type)?.label}` }])

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? dict.ai.analysisFailed)
      }

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.analysis }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `${dict.ai.analysisError}：${(e as Error).message}`,
      }])
    } finally {
      setAnalyzing(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* FAB Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'fixed z-50 flex items-center justify-center rounded-full shadow-xl transition-all',
            'bg-gradient-to-br from-violet-600 to-indigo-700 text-white',
            'hover:from-violet-500 hover:to-indigo-600 active:scale-95',
            'h-14 w-14',
            'bottom-24 right-4 lg:bottom-6 lg:right-6',
          )}
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className={cn(
          'fixed z-50 flex flex-col bg-white dark:bg-gray-900 shadow-2xl',
          // Mobile: full screen
          'inset-0 lg:inset-auto',
          // Desktop: floating panel
          'lg:bottom-6 lg:right-6 lg:w-[420px] lg:h-[600px] lg:max-h-[80vh] lg:rounded-2xl lg:border',
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-violet-600 to-indigo-700 text-white lg:rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-semibold text-sm">{dict.ai.title}</span>
              <span className="text-xs text-violet-200">{dict.ai.provider}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <Sparkles className="h-10 w-10 mx-auto text-violet-400 mb-3" />
                  <p className="text-sm font-medium text-slate-700">{dict.ai.welcome}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dict.ai.welcomeDesc}
                  </p>
                </div>

                {/* Quick Analysis Buttons */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground px-1">{dict.ai.quickAnalysis}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ANALYSES.map(a => (
                      <button
                        key={a.key}
                        onClick={() => runAnalysis(a.key)}
                        disabled={!!analyzing}
                        className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-sm font-medium text-violet-700 hover:bg-violet-100 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        <a.icon className="h-4 w-4" />
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Skills */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground px-1">{dict.ai.quickCommands}</p>
                  <div className="space-y-1.5">
                    {[
                      { text: dict.ai.quickCmd1, emoji: '🚚' },
                      { text: dict.ai.quickCmd2, emoji: '📦' },
                      { text: dict.ai.quickCmd3, emoji: '📊' },
                      { text: dict.ai.quickCmd4, emoji: '👥' },
                      { text: 'Pipeline 有沒有卡住的？', emoji: '🔍' },
                      { text: '業績前 10 大客戶', emoji: '🏆' },
                      { text: '誰欠最多錢？', emoji: '💰' },
                    ].map(q => (
                      <button
                        key={q.text}
                        onClick={() => sendMessage(q.text)}
                        className="w-full text-left rounded-lg border px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 active:scale-[0.99] transition-all flex items-center gap-2"
                      >
                        <span>{q.emoji}</span>
                        {q.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : msg.isSkill
                      ? 'bg-emerald-50 text-slate-800 rounded-bl-md border border-emerald-200'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md',
                )}>
                  {msg.role === 'assistant' ? (
                    <>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-emerald-200 pt-3">
                          {msg.actions.map((action, j) => (
                            <a key={j} href={action.href}
                              className="inline-flex items-center gap-1 rounded-lg bg-white border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 active:scale-[0.97] transition-all shadow-sm"
                              onClick={() => setOpen(false)}
                            >
                              {action.label} →
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {(loading || analyzing) && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                  <span className="text-sm text-muted-foreground">
                    {analyzing ? dict.ai.analyzing : dict.ai.thinking}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3 pb-[env(safe-area-inset-bottom,12px)]">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={dict.ai.inputPlaceholder}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200 transition-all"
                style={{ maxHeight: '120px' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all',
                  input.trim() && !loading
                    ? 'bg-violet-600 text-white hover:bg-violet-500 active:scale-95'
                    : 'bg-slate-100 text-slate-400',
                )}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
