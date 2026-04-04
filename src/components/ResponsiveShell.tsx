'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import MobileLayout from '@/components/MobileLayout'

interface Props {
  children: React.ReactNode
  /** Content to show on mobile instead of desktop layout. If not provided, children are used for both. */
  mobileContent?: React.ReactNode
  /** Hide sidebar on desktop (e.g. broker page has its own layout) */
  noSidebar?: boolean
}

export default function ResponsiveShell({ children, mobileContent, noSidebar }: Props) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (isMobile) {
    return <MobileLayout>{mobileContent ?? children}</MobileLayout>
  }

  if (noSidebar) {
    return <>{children}</>
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
        {children}
      </div>
    </div>
  )
}
