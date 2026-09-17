'use client'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { JobStatusBadge } from '@/components/badges'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Hiring managers only see jobs assigned to them — enforced server-side too. */
export default function Hiring() {
  const { data: jobs, isLoading } = useQuery({ queryKey: ['manageJobs'], queryFn: api.manageJobs })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">My assigned jobs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review candidates, leave feedback, and approve or reject — for jobs assigned to you.
      </p>
      <div className="mt-6 space-y-3">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        {jobs?.map((job) => (
          <Link key={job.id} href={`/recruiter/jobs/${job.id}`}>
            <Card className="transition hover:border-primary/50">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{job.title}</span>
                    <JobStatusBadge status={job.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {job.location ?? 'No location'} · posted {new Date(job.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />{job._count?.applications ?? 0} applicants
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
        {jobs?.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            No jobs assigned to you yet — a recruiter assigns you when posting a job.
          </p>
        )}
      </div>
    </div>
  )
}
