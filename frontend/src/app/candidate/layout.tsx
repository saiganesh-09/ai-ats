'use client'
import type { ReactNode } from 'react'
import { RequireRole } from '@/lib/auth'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <RequireRole roles={['CANDIDATE']}>{children}</RequireRole>
}
