'use client'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import { ScoreBadge, StatusBadge } from '@/components/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const WITHDRAWABLE = ['APPLIED', 'SCREENING']

export default function Applications() {
  const qc = useQueryClient()
  const { data: apps, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: api.myApplications,
  })

  const withdraw = useMutation({
    mutationFn: api.withdraw,
    onSuccess: () => {
      toast.success('Application withdrawn')
      qc.invalidateQueries({ queryKey: ['applications'] })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">My applications</h1>
      <div className="mt-6 space-y-3">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        {apps?.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <Link href={`/jobs/${a.jobId}`} className="font-semibold hover:text-primary">
                  {a.job?.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {a.job?.company?.name} · applied {new Date(a.createdAt).toLocaleDateString()}
                </p>
                {a.matchScore !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    AI match: {a.matchDetails?.matched_skills?.slice(0, 4).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <ScoreBadge score={a.matchScore} />
                <StatusBadge status={a.status} />
                {WITHDRAWABLE.includes(a.status) && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => withdraw.mutate(a.id)}
                    disabled={withdraw.isPending}
                  >
                    Withdraw
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {apps?.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            No applications yet. <Link href="/jobs" className="text-primary">Browse jobs</Link>.
          </p>
        )}
      </div>
    </div>
  )
}
