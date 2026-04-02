'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 不良品管理已整合到「內部使用/不良品」頁面
export default function DefectiveGoodsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/internal-use?tab=defective')
  }, [router])
  return null
}
