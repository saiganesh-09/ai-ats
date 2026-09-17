'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BrainCircuit, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import type { Job } from '@/lib/types'
import { JobStatusBadge } from '@/components/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  title: z.string().min(2, 'Title required'),
  location: z.string().optional(),
  description: z.string().min(20, 'Min 20 characters'),
  requirements: z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']),
  experienceLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD']),
  workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
  educationRequirement: z.string().optional(),
  applicationDeadline: z.string().optional(),
  openings: z.string().optional(),
  requiredSkills: z.string().optional(),
  preferredSkills: z.string().optional(),
  hiringManagerId: z.string().optional(),
})
type Form = z.infer<typeof schema>

const csv = (s?: string) => s?.split(',').map((x) => x.trim()).filter(Boolean)

export default function ManageJobs() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data: jobs, isLoading } = useQuery({ queryKey: ['manageJobs'], queryFn: api.manageJobs })
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: api.myCompany })
  const hiringManagers = company?.users?.filter((u) => u.role === 'HIRING_MANAGER') ?? []

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const create = useMutation({
    mutationFn: (data: Form) =>
      api.createJob({
        ...data,
        salaryMin: data.salaryMin ? Number(data.salaryMin) : undefined,
        salaryMax: data.salaryMax ? Number(data.salaryMax) : undefined,
        openings: data.openings ? Number(data.openings) : undefined,
        applicationDeadline: data.applicationDeadline || undefined,
        requiredSkills: csv(data.requiredSkills),
        preferredSkills: csv(data.preferredSkills),
        hiringManagerId: data.hiringManagerId ? Number(data.hiringManagerId) : undefined,
      }),
    onSuccess: () => {
      toast.success('Job created as draft — publish it when ready')
      setOpen(false)
      reset()
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
    onSuccess: (data, id) => {
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" />Post a job</Button>} />
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New job posting</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input {...register('title')} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select defaultValue="FULL_TIME" onValueChange={(v) => v && setValue('employmentType', v as Form['employmentType'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_TIME">Full-time</SelectItem>
                      <SelectItem value="PART_TIME">Part-time</SelectItem>
                      <SelectItem value="CONTRACT">Contract</SelectItem>
                      <SelectItem value="INTERNSHIP">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <Select defaultValue="MID" onValueChange={(v) => v && setValue('experienceLevel', v as Form['experienceLevel'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENTRY">Entry</SelectItem>
                      <SelectItem value="MID">Mid</SelectItem>
                      <SelectItem value="SENIOR">Senior</SelectItem>
                      <SelectItem value="LEAD">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Work mode</Label>
                  <Select defaultValue="ONSITE" onValueChange={(v) => v && setValue('workMode', v as Form['workMode'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REMOTE">Remote</SelectItem>
                      <SelectItem value="HYBRID">Hybrid</SelectItem>
                      <SelectItem value="ONSITE">On-site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input {...register('location')} placeholder="City / Remote" />
                </div>
                <div className="space-y-1.5">
                  <Label>Openings</Label>
                  <Input type="number" min={1} defaultValue="1" {...register('openings')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Salary min (annual)</Label>
                  <Input type="number" min={0} placeholder="120000" {...register('salaryMin')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Salary max</Label>
                  <Input type="number" min={0} placeholder="160000" {...register('salaryMax')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={4} {...register('description')} />
                {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Requirements</Label>
                <Textarea rows={2} {...register('requirements')} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Required skills</Label>
                  <Input placeholder="typescript, node, sql" {...register('requiredSkills')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred (nice-to-have)</Label>
                  <Input placeholder="aws, docker" {...register('preferredSkills')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Education requirement</Label>
                  <Input placeholder="BS in CS or equivalent" {...register('educationRequirement')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Application deadline</Label>
                  <Input type="date" {...register('applicationDeadline')} />
                </div>
              </div>
              {hiringManagers.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Hiring manager</Label>
                  <Select onValueChange={(v) => v != null && setValue('hiringManagerId', String(v))}>
                    <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
                    <SelectContent>
                      {hiringManagers.map((hm) => (
                        <SelectItem key={hm.id} value={String(hm.id)}>{hm.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button className="w-full" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create draft'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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
          <Button variant="secondary" size="sm" render={<Link href={`/recruiter/jobs/${job.id}`} />}>
            <Users className="mr-1 h-4 w-4" />Pipeline
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
