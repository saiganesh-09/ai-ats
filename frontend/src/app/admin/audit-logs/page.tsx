'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/endpoints'
import { Pager } from '@/components/Pager'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminActivity() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['activity', page],
    queryFn: () => api.adminActivity(page),
  })
  const activity = data?.items

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Platform activity</h1>
      <p className="mt-1 text-sm text-muted-foreground">Audit trail of recent actions.</p>
      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading && <Skeleton className="m-4 h-64" />}
          {activity?.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-0">
              <div>
                <span className="font-medium">{a.actor?.fullName ?? 'system'}</span>{' '}
                <span className="text-muted-foreground">{a.action.replaceAll('.', ' ')}</span>
                {a.entityType && <span className="text-muted-foreground"> · {a.entityType} #{a.entityId}</span>}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {activity?.length === 0 && <p className="p-6 text-center text-muted-foreground">No activity yet.</p>}
        </CardContent>
      </Card>
      {data && <Pager page={page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
    </div>
  )
}
