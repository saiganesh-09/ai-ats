'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/endpoints'
import { StatusBadge } from '@/components/badges'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminApplications() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-applications'], queryFn: api.adminApplications })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Applications</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {data?.length ?? 0} applications in scope
      </p>
      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading && <Skeleton className="m-4 h-40" />}
          {data?.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
              <div>
                <p className="text-sm font-medium">{a.candidate?.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {a.job?.title} · {a.job?.company?.name} · {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
          {data?.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No applications in scope.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
