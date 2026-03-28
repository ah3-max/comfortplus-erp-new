'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Mic,
  MessageSquare,
  Camera,
  AlertOctagon,
  Upload,
  X,
  Loader2,
  Search,
  Send,
  StopCircle,
  ImageIcon,
  FileAudio,
  CheckCircle2,
  ChevronDown,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Customer {
  id: string
  name: string
  phone?: string
  code?: string
}

interface UploadedFile {
  id: string
  name: string
  type: 'image' | 'audio'
  url: string
  thumbnail?: string
}

type LogType =
  | 'CALL'
  | 'LINE'
  | 'MEETING'
  | 'FIRST_VISIT'
  | 'SECOND_VISIT'
  | 'FOLLOW_UP'
  | 'OTHER'

type IncidentType =
  | 'COMPLAINT'
  | 'SKIN_ISSUE'
  | 'PRODUCT_DEFECT'
  | 'DELIVERY_ISSUE'
  | 'SERVICE_ISSUE'
  | 'OTHER'

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

const LOG_TYPE_OPTIONS: { value: LogType; label: string }[] = [
  { value: 'CALL', label: '電話' },
  { value: 'LINE', label: 'LINE' },
  { value: 'MEETING', label: '會議' },
  { value: 'FIRST_VISIT', label: '初訪' },
  { value: 'SECOND_VISIT', label: '二訪' },
  { value: 'FOLLOW_UP', label: '追蹤' },
  { value: 'OTHER', label: '其他' },
]

const INCIDENT_TYPE_OPTIONS: { value: IncidentType; label: string }[] = [
  { value: 'COMPLAINT', label: '客訴' },
  { value: 'SKIN_ISSUE', label: '皮膚問題' },
  { value: 'PRODUCT_DEFECT', label: '產品瑕疵' },
  { value: 'DELIVERY_ISSUE', label: '配送問題' },
  { value: 'SERVICE_ISSUE', label: '服務問題' },
  { value: 'OTHER', label: '其他' },
]

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: 'LOW', label: '低', color: 'bg-gray-200 text-gray-700' },
  { value: 'MEDIUM', label: '中', color: 'bg-yellow-200 text-yellow-800' },
  { value: 'HIGH', label: '高', color: 'bg-orange-200 text-orange-800' },
  { value: 'CRITICAL', label: '嚴重', color: 'bg-red-200 text-red-800' },
]

// ---------------------------------------------------------------------------
// Customer Picker Component — loads all on open, filters as you type
// ---------------------------------------------------------------------------

function CustomerPicker({
  value,
  onChange,
  placeholder = '選擇或搜尋客戶...',
  allCustomers,
}: {
  value: Customer | null
  onChange: (c: Customer | null) => void
  placeholder?: string
  allCustomers: Customer[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? allCustomers.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          (c.phone && c.phone.includes(query)) ||
          (c.code && c.code.toLowerCase().includes(query.toLowerCase())),
      )
    : allCustomers

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [open])

  if (value) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">{value.name.slice(0, 1)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-blue-900 truncate">{value.name}</p>
          {value.phone && <p className="text-xs text-blue-500">{value.phone}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="p-1 text-blue-400 hover:text-blue-600 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 p-3 bg-white border-2 border-gray-200 rounded-xl text-left hover:border-blue-400 transition-colors active:bg-gray-50"
      >
        <Users className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="flex-1 text-gray-400 text-sm">{placeholder}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {/* Dropdown overlay */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown panel */}
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-2xl shadow-2xl border overflow-hidden max-h-[60vh] flex flex-col">
            {/* Search input */}
            <div className="p-3 border-b bg-gray-50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="搜尋客戶名稱、電話..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  找不到客戶
                </div>
              ) : (
                filtered.slice(0, 50).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 active:bg-blue-100 text-left border-b last:border-b-0 transition-colors"
                    onClick={() => {
                      onChange(c)
                      setOpen(false)
                    }}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-bold">{c.name.slice(0, 1)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">
                        {[c.code, c.phone].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detect Web Speech API support
// ---------------------------------------------------------------------------
function hasSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false
  return !!(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function QuickInputPage() {
  const { dict } = useI18n()
  // --- All customers (loaded once) ---
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])

  // --- Quick Note state ---
  const [notes, setNotes] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [logType, setLogType] = useState<LogType>('MEETING')
  const [submitting, setSubmitting] = useState(false)

  // --- Voice input state ---
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<unknown>(null)

  // --- Audio upload ---
  const audioInputRef = useRef<HTMLInputElement>(null)
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)

  // --- Photo upload ---
  const photoInputRef = useRef<HTMLInputElement>(null)

  // --- Session uploads ---
  const [sessionFiles, setSessionFiles] = useState<UploadedFile[]>([])

  // --- Complaint dialog ---
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [complaintCustomer, setComplaintCustomer] = useState<Customer | null>(null)
  const [complaintType, setComplaintType] = useState<IncidentType>('COMPLAINT')
  const [complaintSeverity, setComplaintSeverity] = useState<Severity>('MEDIUM')
  const [complaintDesc, setComplaintDesc] = useState('')
  const [complaintPhotos, setComplaintPhotos] = useState<File[]>([])
  const [complaintSubmitting, setComplaintSubmitting] = useState(false)
  const complaintPhotoRef = useRef<HTMLInputElement>(null)
  const [isComplaintListening, setIsComplaintListening] = useState(false)
  const complaintRecognitionRef = useRef<unknown>(null)

  // =========================================================================
  // Load all customers on mount
  // =========================================================================
  useEffect(() => {
    setSpeechSupported(hasSpeechRecognition())
    fetch('/api/customers')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.customers ?? [])
        setAllCustomers(
          list.map((c: Customer) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            code: c.code,
          })),
        )
      })
      .catch(() => {})
  }, [])

  // =========================================================================
  // Voice Input (Web Speech API) — only available on Chrome / Android Chrome
  // =========================================================================

  const startListening = useCallback(
    (target: 'note' | 'complaint') => {
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition
      if (!SpeechRecognition) {
        toast.error('此瀏覽器不支援語音輸入，請改用「錄音上傳」')
        return
      }

      const recognition = new (SpeechRecognition as new () => {
        lang: string
        continuous: boolean
        interimResults: boolean
        onresult: (e: unknown) => void
        onerror: () => void
        onend: () => void
        start: () => void
        stop: () => void
      })()
      recognition.lang = 'zh-TW'
      recognition.continuous = true
      recognition.interimResults = true

      let finalTranscript = ''

      recognition.onresult = (event: unknown) => {
        const e = event as { resultIndex: number; results: { isFinal: boolean; [0]: { transcript: string } }[] }
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript
          if (e.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interim = transcript
          }
        }
        if (target === 'note') {
          setNotes((prev) => (prev ? prev + ' ' : '') + finalTranscript + interim)
        } else {
          setComplaintDesc((prev) => (prev ? prev + ' ' : '') + finalTranscript + interim)
        }
      }

      recognition.onerror = () => {
        toast.error('語音辨識發生錯誤')
        if (target === 'note') setIsListening(false)
        else setIsComplaintListening(false)
      }

      recognition.onend = () => {
        if (target === 'note') setIsListening(false)
        else setIsComplaintListening(false)
      }

      recognition.start()

      if (target === 'note') {
        recognitionRef.current = recognition
        setIsListening(true)
      } else {
        complaintRecognitionRef.current = recognition
        setIsComplaintListening(true)
      }
    },
    [],
  )

  const stopListening = useCallback((target: 'note' | 'complaint') => {
    if (target === 'note') {
      (recognitionRef.current as { stop: () => void } | null)?.stop()
      setIsListening(false)
    } else {
      (complaintRecognitionRef.current as { stop: () => void } | null)?.stop()
      setIsComplaintListening(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      (recognitionRef.current as { stop: () => void } | null)?.stop()
      ;(complaintRecognitionRef.current as { stop: () => void } | null)?.stop()
    }
  }, [])

  // =========================================================================
  // Audio upload
  // =========================================================================

  const handleAudioUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setAudioUploading(true)
      setAudioProgress(0)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'audio')

        const progressInterval = setInterval(() => {
          setAudioProgress((p) => Math.min(p + 15, 90))
        }, 200)

        const res = await fetch('/api/upload', { method: 'POST', body: formData })

        clearInterval(progressInterval)
        setAudioProgress(100)

        if (res.ok) {
          const data = await res.json()
          setSessionFiles((prev) => [
            ...prev,
            {
              id: data.id ?? crypto.randomUUID(),
              name: file.name,
              type: 'audio',
              url: data.url ?? '',
            },
          ])
          toast.success('錄音上傳成功')
        } else {
          toast.error('錄音上傳失敗')
        }
      } catch {
        toast.error('錄音上傳失敗')
      } finally {
        setAudioUploading(false)
        setAudioProgress(0)
        if (audioInputRef.current) audioInputRef.current.value = ''
      }
    },
    [],
  )

  // =========================================================================
  // Photo upload
  // =========================================================================

  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'image')

        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData })
          if (res.ok) {
            const data = await res.json()
            const thumbnail = URL.createObjectURL(file)
            setSessionFiles((prev) => [
              ...prev,
              {
                id: data.id ?? crypto.randomUUID(),
                name: file.name,
                type: 'image',
                url: data.url ?? '',
                thumbnail,
              },
            ])
            toast.success(`照片已上傳`)
          } else {
            toast.error(`照片上傳失敗: ${file.name}`)
          }
        } catch {
          toast.error(`照片上傳失敗: ${file.name}`)
        }
      }

      if (photoInputRef.current) photoInputRef.current.value = ''
    },
    [],
  )

  // =========================================================================
  // Submit follow-up log
  // =========================================================================

  const handleSubmitNote = useCallback(async () => {
    if (!selectedCustomer) {
      toast.error('請先選擇客戶')
      return
    }
    if (!notes.trim()) {
      toast.error('請輸入紀錄內容')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/customers/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          logType,
          content: notes.trim(),
        }),
      })

      if (res.ok) {
        toast.success('紀錄已送出')
        setNotes('')
        setSelectedCustomer(null)
      } else {
        toast.error('送出失敗，請重試')
      }
    } catch {
      toast.error('送出失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }, [selectedCustomer, notes, logType])

  // =========================================================================
  // Submit complaint
  // =========================================================================

  const handleSubmitComplaint = useCallback(async () => {
    if (!complaintCustomer) {
      toast.error('請先選擇客戶')
      return
    }
    if (!complaintDesc.trim()) {
      toast.error('請輸入描述')
      return
    }

    setComplaintSubmitting(true)
    try {
      const photoUrls: string[] = []
      for (const photo of complaintPhotos) {
        const formData = new FormData()
        formData.append('file', photo)
        formData.append('type', 'image')
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          photoUrls.push(uploadData.url ?? '')
        }
      }

      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: complaintCustomer.id,
          type: complaintType,
          severity: complaintSeverity,
          description: complaintDesc.trim(),
          photos: photoUrls,
        }),
      })

      if (res.ok) {
        toast.success('客訴已建立')
        setComplaintOpen(false)
        resetComplaintForm()
      } else {
        toast.error('客訴建立失敗')
      }
    } catch {
      toast.error('客訴建立失敗')
    } finally {
      setComplaintSubmitting(false)
    }
  }, [complaintCustomer, complaintType, complaintSeverity, complaintDesc, complaintPhotos])

  const resetComplaintForm = () => {
    setComplaintCustomer(null)
    setComplaintType('COMPLAINT')
    setComplaintSeverity('MEDIUM')
    setComplaintDesc('')
    setComplaintPhotos([])
  }

  const removeSessionFile = (id: string) => {
    setSessionFiles((prev) => prev.filter((f) => f.id !== id))
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">{dict.quickInput.title}</h1>
        <p className="text-sm text-gray-500">拜訪後快速記錄資料</p>
      </div>

      <div className="p-4 space-y-5 max-w-lg mx-auto">
        {/* ============================================================= */}
        {/* Top Section: Quick Action Cards */}
        {/* ============================================================= */}
        <section>
          <div className="grid grid-cols-2 gap-3">
            {/* 錄音上傳 */}
            <Card
              className="cursor-pointer active:scale-95 transition-transform border-0 shadow-md hover:shadow-lg"
              onClick={() => audioInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl min-h-[120px] relative">
                {audioUploading ? (
                  <>
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-2" />
                    <span className="text-sm font-semibold text-blue-700">
                      上傳中 {audioProgress}%
                    </span>
                    <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${audioProgress}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center mb-2 shadow-md">
                      <Mic className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-blue-800">錄音上傳</span>
                    <span className="text-[11px] text-blue-500 mt-0.5">支援所有手機</span>
                  </>
                )}
              </CardContent>
            </Card>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleAudioUpload}
            />

            {/* 語音輸入 — shows only if supported, else shows fallback */}
            <Card
              className={`cursor-pointer active:scale-95 transition-transform border-0 shadow-md hover:shadow-lg ${
                isListening ? 'ring-2 ring-green-400 ring-offset-2' : ''
              } ${!speechSupported ? 'opacity-60' : ''}`}
              onClick={() => {
                if (!speechSupported) {
                  toast.error('iOS 不支援即時語音輸入，請改用「錄音上傳」', { duration: 3000 })
                  return
                }
                if (isListening) stopListening('note')
                else startListening('note')
              }}
            >
              <CardContent className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-green-50 to-green-100 rounded-xl min-h-[120px] relative">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 shadow-md ${
                    isListening ? 'bg-red-500 animate-pulse' : speechSupported ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                >
                  {isListening ? (
                    <StopCircle className="w-7 h-7 text-white" />
                  ) : (
                    <MessageSquare className="w-7 h-7 text-white" />
                  )}
                </div>
                <span className="text-sm font-semibold text-green-800">
                  {isListening ? '辨識中...' : '語音輸入'}
                </span>
                {!speechSupported && (
                  <span className="text-[11px] text-gray-500 mt-0.5 text-center">僅限 Android Chrome</span>
                )}
                {isListening && (
                  <div className="flex gap-1 mt-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 拍照/上傳照片 */}
            <Card
              className="cursor-pointer active:scale-95 transition-transform border-0 shadow-md hover:shadow-lg"
              onClick={() => photoInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl min-h-[120px]">
                <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center mb-2 shadow-md">
                  <Camera className="w-7 h-7 text-white" />
                </div>
                <span className="text-sm font-semibold text-orange-800">拍照/上傳照片</span>
              </CardContent>
            </Card>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />

            {/* 快速客訴 */}
            <Card
              className="cursor-pointer active:scale-95 transition-transform border-0 shadow-md hover:shadow-lg"
              onClick={() => setComplaintOpen(true)}
            >
              <CardContent className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-red-50 to-red-100 rounded-xl min-h-[120px]">
                <div className="w-14 h-14 rounded-2xl bg-red-500 flex items-center justify-center mb-2 shadow-md">
                  <AlertOctagon className="w-7 h-7 text-white" />
                </div>
                <span className="text-sm font-semibold text-red-800">快速客訴</span>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ============================================================= */}
        {/* Middle Section: Quick Note */}
        {/* ============================================================= */}
        <section>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 space-y-4">
              <h2 className="font-bold text-gray-900 text-lg">{dict.quickInput.visitRecord}</h2>

              {/* Customer picker */}
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">{dict.quickInput.customer}</Label>
                <CustomerPicker
                  value={selectedCustomer}
                  onChange={setSelectedCustomer}
                  allCustomers={allCustomers}
                />
              </div>

              {/* Log type selector */}
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">紀錄類型</Label>
                <div className="flex flex-wrap gap-2">
                  {LOG_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLogType(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        logType === opt.value
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes textarea with voice button */}
              <div className="relative">
                <Label className="text-sm text-gray-600 mb-1 block">{dict.quickInput.notes}</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="輸入拜訪紀錄、客戶需求、跟進事項..."
                  rows={5}
                  className="w-full rounded-lg border border-gray-200 p-3 pr-12 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {speechSupported && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isListening) stopListening('note')
                      else startListening('note')
                    }}
                    className={`absolute right-3 bottom-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    title={isListening ? '停止語音' : '語音輸入'}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Submit button */}
              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={handleSubmitNote}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Send className="w-5 h-5 mr-2" />
                )}
                {submitting ? '送出中...' : dict.quickInput.submitSuccess}
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* ============================================================= */}
        {/* Session uploads preview */}
        {/* ============================================================= */}
        {sessionFiles.length > 0 && (
          <section>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-900">本次上傳</h2>
                  <Badge variant="secondary">{sessionFiles.length} 個檔案</Badge>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {sessionFiles.map((file) => (
                    <div key={file.id} className="relative group">
                      {file.type === 'image' ? (
                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 border">
                          {file.thumbnail ? (
                            <img
                              src={file.thumbnail}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full aspect-square rounded-lg bg-blue-50 border border-blue-200 flex flex-col items-center justify-center p-1">
                          <FileAudio className="w-6 h-6 text-blue-500 mb-1" />
                          <span className="text-[10px] text-blue-600 truncate w-full text-center">
                            {file.name}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSessionFile(file.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-1 right-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500 drop-shadow" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>

      {/* ================================================================= */}
      {/* Complaint Dialog */}
      {/* ================================================================= */}
      <Dialog open={complaintOpen} onOpenChange={setComplaintOpen}>
        <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertOctagon className="w-5 h-5" />
              快速客訴
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer picker */}
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">客戶 *</Label>
              <CustomerPicker
                value={complaintCustomer}
                onChange={setComplaintCustomer}
                allCustomers={allCustomers}
              />
            </div>

            {/* Incident type */}
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">客訴類型</Label>
              <div className="flex flex-wrap gap-2">
                {INCIDENT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setComplaintType(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      complaintType === opt.value
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">嚴重程度</Label>
              <div className="flex gap-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setComplaintSeverity(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium text-center transition-all ${
                      complaintSeverity === opt.value
                        ? `${opt.color} ring-2 ring-offset-1 ring-current shadow-sm`
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Photos */}
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">照片 / LINE 截圖</Label>
              <div className="flex flex-wrap gap-2">
                {complaintPhotos.map((photo, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setComplaintPhotos((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-bl-lg flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => complaintPhotoRef.current?.click()}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5">新增</span>
                </button>
              </div>
              <input
                ref={complaintPhotoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files
                  if (files) {
                    setComplaintPhotos((prev) => [...prev, ...Array.from(files)])
                  }
                  if (complaintPhotoRef.current) complaintPhotoRef.current.value = ''
                }}
              />
            </div>

            {/* Description with voice button (only on supported browsers) */}
            <div className="relative">
              <Label className="text-sm text-gray-600 mb-1 block">描述 *</Label>
              <textarea
                value={complaintDesc}
                onChange={(e) => setComplaintDesc(e.target.value)}
                placeholder="描述客訴內容..."
                rows={4}
                className="w-full rounded-lg border border-gray-200 p-3 pr-12 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (isComplaintListening) stopListening('complaint')
                    else startListening('complaint')
                  }}
                  className={`absolute right-3 bottom-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isComplaintListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setComplaintOpen(false)
                resetComplaintForm()
              }}
            >
              {dict.common.cancel}
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleSubmitComplaint}
              disabled={complaintSubmitting}
            >
              {complaintSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {complaintSubmitting ? '送出中...' : '送出客訴'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
