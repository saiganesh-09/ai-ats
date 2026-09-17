'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/endpoints'
import { STATUS_ORDER, type ApplicationStatus } from '@/lib/types'
import { ScoreBadge } from '@/components/badges'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Kanban pipeline: applications grouped into status columns.
 * Cards link to the full applicant review page where status moves happen.
 */
export default function Pipeline({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const jobId = Number(id)
  const [q, setQ] = useState('')

  const { data: job } = useQuery({ queryKey: ['job', jobId], queryFn: () => api.getJob(jobId) })
  const { data: applicants, isLoading } = useQuery({
    queryKey: ['pipeline', jobId, q],
    queryFn: () => api.pipeline(jobId, { q: q || undefined, sort: 'score' }),
  })

  const byStatus = (s: ApplicationStatus) => applicants?.filter((a) => a.status === s) ?? []
  const terminal = applicants?.filter((a) => ['REJECTED', 'WITHDRAWN'].includes(a.status)) ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/recruiter/jobs" className="text-sm text-primary">← Jobs</Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{job?.title ?? 'Pipeline'}</h1>
          <p className="text-sm text-muted-foreground">
            {applicants?.length ?? 0} applicants · sorted by AI match score
          </p>
        </div>
        <Input
          placeholder="Search candidates…" className="w-64"
          onChange={(e) => {
            const v = e.target.value
            clearTimeout((Pipeline as { t?: number }).t)
            ;(Pipeline as { t?: number }).t = window.setTimeout(() => setQ(v), 300)
          }}
        />
      </div>

      {isLoading ? (
        <Skeleton className="mt-6 h-96" />
      ) : (
        <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between rounded-md bg-muted px-3 py-1.5 text-xs font-semibold">
                {status}
                <span className="text-muted-foreground">{byStatus(status).length}</span>
              </div>
              <div className="space-y-2">
                {byStatus(status).map((a) => (
                  <Link key={a.id} href={`/recruiter/applications/${a.id}`}>
                    <Card className="transition hover:border-primary/50">
                      <CardContent className="p-3">
                        <p className="text-sm font-medium">{a.candidate?.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.candidate?.email}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <ScoreBadge score={a.matchScore} />
                          {a.assignedRecruiter && (
                            <span className="text-[10px] text-muted-foreground">
                              → {a.assignedRecruiter.fullName.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="w-64 shrink-0">
            <div className="mb-2 rounded-md bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              REJECTED / WITHDRAWN <span className="float-right">{terminal.length}</span>
            </div>
            <div className="space-y-2">
              {terminal.map((a) => (
                <Link key={a.id} href={`/recruiter/applications/${a.id}`}>
                  <Card className="opacity-60 transition hover:border-primary/50">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{a.candidate?.fullName}</p>
                      <p className="text-xs text-muted-foreground">{a.status}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
