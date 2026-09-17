'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, CheckCheck } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function Notifications() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications })
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

  const describe = (type: string, payload: Record<string, unknown> | null) => {
    if (type === 'application.status') return `Application #${payload?.applicationId} moved to ${payload?.status}`
    if (type === 'interview.scheduled') return `Interview scheduled for ${payload?.scheduledAt ? new Date(String(payload.scheduledAt)).toLocaleString() : ''}`
    return type
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
          <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
        </Button>
      </div>
      <div className="mt-6 space-y-2">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        {data?.map((n) => (
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
        {data?.length === 0 && <p className="py-10 text-center text-muted-foreground">No notifications yet.</p>}
      </div>
    </div>
  )
}
