'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BrainCircuit, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import type { Job } from '@/lib/types'
import { JobStatusBadge } from '@/components/badges'
import { JobForm, toJobPayload, type JobFormData } from '@/components/JobForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

export default function ManageJobs() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data: jobs, isLoading } = useQuery({ queryKey: ['manageJobs'], queryFn: api.manageJobs })
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: api.myCompany })
  const hiringManagers = company?.users?.filter((u) => u.role === 'HIRING_MANAGER') ?? []

  const create = useMutation({
    mutationFn: (data: JobFormData) => api.createJob(toJobPayload(data)),
    onSuccess: () => {
      toast.success('Job created as draft — publish it when ready')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['manageJobs'] })
    },
    onError: (e) => toast.error(e.message),
  })

  const action = useMutation({
    mutationFn: ({ id, act }: { id: number; act: 'publish' | 'pause' | 'close' }) =>
      api.jobAction(id, act),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manageJobs'] }),
    onError: (e) => toast.error(e.message),
  })

  const analyze = useMutation({
    mutationFn: api.analyzeJob,
    onSuccess: (data) => {
      toast.info(
        `JD analysis: ${data.seniority} level, clarity ${data.clarity_score}/100. Skills: ${(data.required_skills as string[])?.join(', ')}`,
        { duration: 8000 },
      )
    },
    onError: (e) => toast.error(e.message),
  })

  if (!isLoading && !company) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Set up your company first</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a company profile or join one with an invite code on the{' '}
          <Link href="/recruiter/company" className="text-primary">Company page</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Job postings</h1>
        <div className="flex gap-2">
          <Link href="/recruiter/jobs/create">
            <Button variant="outline"><Plus className="mr-2 h-4 w-4" />Full form</Button>
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" />Post a job</Button>} />
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New job posting</DialogTitle></DialogHeader>
            <JobForm
              hiringManagers={hiringManagers}
              pending={create.isPending}
              onSubmit={(d) => create.mutate(d)}
            />
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        {jobs?.map((job) => (
          <JobRow key={job.id} job={job} onAction={(act) => action.mutate({ id: job.id, act })} onAnalyze={() => analyze.mutate(job.id)} />
        ))}
        {jobs?.length === 0 && <p className="py-10 text-center text-muted-foreground">No jobs yet — post your first.</p>}
      </div>
    </div>
  )
}

function JobRow({ job, onAction, onAnalyze }: {
  job: Job
  onAction: (act: 'publish' | 'pause' | 'close') => void
  onAnalyze: () => void
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/recruiter/jobs/${job.id}`} className="font-semibold hover:text-primary">
              {job.title}
            </Link>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {job.location ?? 'No location'} · {job._count?.applications ?? 0} applicants
            {job.hiringManager ? ` · HM: ${job.hiringManager.fullName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onAnalyze} title="AI job description analysis">
            <BrainCircuit className="h-4 w-4" />
          </Button>
          {job.status === 'DRAFT' && <Button size="sm" onClick={() => onAction('publish')}>Publish</Button>}
          {job.status === 'PAUSED' && <Button size="sm" onClick={() => onAction('publish')}>Resume</Button>}
          {job.status === 'PUBLISHED' && <Button variant="outline" size="sm" onClick={() => onAction('pause')}>Pause</Button>}
          {job.status !== 'CLOSED' && <Button variant="outline" size="sm" onClick={() => onAction('close')}>Close</Button>}
          <Button variant="secondary" size="sm" nativeButton={false} render={<Link href={`/recruiter/jobs/${job.id}`} />}>
            <Users className="mr-1 h-4 w-4" />Pipeline
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
