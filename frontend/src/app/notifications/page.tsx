'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, CheckCheck } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Pager } from '@/components/Pager'

/** Shared notification center — all roles (was candidate-only under /candidate). */
export default function Notifications() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const qc = useQueryClient()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => api.notifications(page),
  })
  const markAll = useMutation({
    mutationFn: api.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['unread'] })
    },
  })
  const markRead = useMutation({
    mutationFn: api.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['unread'] })
    },
  })

  const unreadCount = data?.items.filter((n) => !n.readAt).length ?? 0

  const describe = (type: string, payload: Record<string, unknown> | null) => {
    const p = payload ?? {}
    const job = p.jobTitle ? ` — ${p.jobTitle}` : ''
    switch (type) {
      case 'application.submitted': return `Application submitted${job}`
      case 'application.status': return `Application moved to ${p.status ?? 'a new stage'}${job}`
      case 'application.new': return `New application from ${p.candidateName ?? 'a candidate'}${job}`
      case 'candidate.withdrawn': return `${p.candidateName ?? 'Candidate'} withdrew${job}`
      case 'interview.scheduled': return `${p.type ?? 'Interview'} interview scheduled for ${p.scheduledAt ? new Date(String(p.scheduledAt)).toLocaleString() : '—'}${job}`
      case 'interview.assigned': return `You're assigned to interview${p.candidateName ? ` ${p.candidateName}` : ''} for ${p.jobTitle ?? 'a job'}`
      case 'feedback.new': return `New interview feedback from ${p.authorName ?? 'a colleague'}${job}`
      default: return type
    }
  }

  if (loading || !user) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
        </div>
        <Button variant="outline" size="sm" disabled={!unreadCount} onClick={() => markAll.mutate()}>
          <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
        </Button>
      </div>
      <div className="mt-6 space-y-2">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        {data?.items.map((n) => (
          <Card
            key={n.id}
            className={`cursor-pointer ${n.readAt ? 'opacity-60' : 'border-primary/30'}`}
            onClick={() => !n.readAt && markRead.mutate(n.id)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <BellRing className={`h-4 w-4 ${n.readAt ? 'text-muted-foreground' : 'text-primary'}`} />
              <div>
                <p className="text-sm">{describe(n.type, n.payload)}</p>
                <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {data?.items.length === 0 && <p className="py-10 text-center text-muted-foreground">No notifications yet.</p>}
      </div>
      {data && <Pager page={page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
    </div>
  )
}
