'use client'
import type { ReactNode } from 'react'
import { RequireRole } from '@/lib/auth'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireRole roles={['ADMIN']}>{children}</RequireRole>
}
