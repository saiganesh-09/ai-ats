'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Spec path — the dashboard index lives at /candidate.
export default function Redirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/candidate') }, [router])
  return null
}
