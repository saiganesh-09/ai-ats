'use client'
import type { ReactNode } from 'react'
import { RequireRole } from '@/lib/auth'

export default function RecruiterLayout({ children }: { children: ReactNode }) {
  return <RequireRole roles={['RECRUITER', 'ADMIN']}>{children}</RequireRole>
}
