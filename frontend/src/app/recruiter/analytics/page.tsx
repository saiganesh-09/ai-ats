'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Analytics IS the recruiter dashboard — same page.
export default function Redirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/recruiter/dashboard') }, [router])
  return null
}
