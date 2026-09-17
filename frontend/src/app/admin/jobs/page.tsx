'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { JobStatusBadge } from '@/components/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminJobs() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin-jobs'], queryFn: api.adminJobs })
  const del = useMutation({
    mutationFn: api.adminDeleteJob,
    onSuccess: () => {
      toast.success('Job removed')
      qc.invalidateQueries({ queryKey: ['admin-jobs'] })
      qc.invalidateQueries({ queryKey: ['admin-reports'] })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Jobs</h1>
      <p className="mt-1 text-sm text-muted-foreground">All postings in scope — remove inappropriate ones.</p>
      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading && <Skeleton className="m-4 h-40" />}
          {data?.map((j) => (
            <div key={j.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
              <div>
                <p className="text-sm font-medium">{j.title}</p>
                <p className="text-xs text-muted-foreground">
                  {j.company?.name} · {j.recruiter?.fullName ?? '—'} · {j._count?.applications ?? 0} applicants
                </p>
              </div>
              <div className="flex items-center gap-3">
                <JobStatusBadge status={j.status} />
                <Button
                  variant="ghost" size="sm"
                  disabled={del.isPending}
                  onClick={() => del.mutate(j.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No jobs in scope.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
