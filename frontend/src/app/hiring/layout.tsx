'use client'
import type { ReactNode } from 'react'
import { RequireRole } from '@/lib/auth'

export default function HiringLayout({ children }: { children: ReactNode }) {
  return <RequireRole roles={['HIRING_MANAGER']}>{children}</RequireRole>
}
