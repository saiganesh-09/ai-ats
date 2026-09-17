'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Spec route — the shared notification center lives at /notifications.
export default function Redirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/notifications') }, [router])
  return null
}
