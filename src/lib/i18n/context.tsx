'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import zhTW from './locales/zh-TW'
import en from './locales/en'
import th from './locales/th'

export type Locale = 'zh-TW' | 'en' | 'th'
// Deep string record type for dictionaries
type DeepStringRecord = { [key: string]: string | DeepStringRecord }
export type Dictionary = typeof zhTW

const dictionaries: Record<Locale, DeepStringRecord> = { 'zh-TW': zhTW, en, th }

export const LOCALE_OPTIONS: { value: Locale; label: string; flag: string }[] = [
  { value: 'zh-TW', label: '中文',    flag: '🇹🇼' },
  { value: 'en',    label: 'English', flag: '🇺🇸' },
  { value: 'th',    label: 'ไทย',     flag: '🇹🇭' },
]

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
  dict: Dictionary
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-TW',
  setLocale: () => {},
  t: (k) => k,
  dict: zhTW,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh-TW')

  useEffect(() => {
    const saved = localStorage.getItem('erp-locale') as Locale | null
    if (saved && dictionaries[saved]) {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('erp-locale', l)
  }, [])

  const dict = dictionaries[locale] as unknown as Dictionary

  const t = useCallback((key: string): string => {
    const parts = key.split('.')
    let current: unknown = dictionaries[locale]
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part]
      } else {
        return key
      }
    }
    return typeof current === 'string' ? current : key
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dict }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
