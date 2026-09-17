'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminReports() {
  const qc = useQueryClient()
  const { data: reports, isLoading } = useQuery({ queryKey: ['reports'], queryFn: api.adminReports })
  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'RESOLVED' | 'DISMISSED' }) =>
      api.resolveReport(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
    onError: (e) => toast.error(e.message),
  })
  const deleteJob = useMutation({
    mutationFn: api.adminDeleteJob,
    onSuccess: () => {
      toast.success('Job removed')
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Reported jobs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Candidates flag inappropriate postings — review and take action.
      </p>
      <div className="mt-6 space-y-3">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        {reports?.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{r.job.title} <Badge variant="outline" className="ml-1">{r.job.status}</Badge></p>
                  <p className="mt-1 text-sm">"{r.reason}"</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reported by {r.reporter.fullName} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={r.status === 'OPEN' ? 'destructive' : 'secondary'}>{r.status}</Badge>
              </div>
              {r.status === 'OPEN' && (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="destructive" size="sm"
                    onClick={() => { deleteJob.mutate(r.job.id); resolve.mutate({ id: r.id, status: 'RESOLVED' }) }}
                  >
                    Delete job & resolve
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => resolve.mutate({ id: r.id, status: 'RESOLVED' })}>
                    Resolve (keep job)
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => resolve.mutate({ id: r.id, status: 'DISMISSED' })}>
                    Dismiss
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {reports?.length === 0 && <p className="py-10 text-center text-muted-foreground">No reports — clean board.</p>}
      </div>
    </div>
  )
}
