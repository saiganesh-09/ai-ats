'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Building2, Flag, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import { useAuth } from '@/lib/auth'
import { JobStatusBadge } from '@/components/badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

export default function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const jobId = Number(id)
  const { user } = useAuth()
  const qc = useQueryClient()
  const [resumeId, setResumeId] = useState('')
  const [coverNote, setCoverNote] = useState('')
  const [reportReason, setReportReason] = useState('')

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.getJob(jobId),
  })
  const { data: resumes } = useQuery({
    queryKey: ['resumes'],
    queryFn: api.myResumes,
    enabled: user?.role === 'CANDIDATE',
  })
  const { data: saved } = useQuery({
    queryKey: ['saved'],
    queryFn: api.savedJobs,
    enabled: user?.role === 'CANDIDATE',
  })
  const isSaved = saved?.some((s) => s.jobId === jobId)

  const apply = useMutation({
    mutationFn: () => api.apply(jobId, Number(resumeId), coverNote || undefined),
    onSuccess: () => {
      toast.success('Application submitted!')
      qc.invalidateQueries({ queryKey: ['applications'] })
    },
    onError: (e) => toast.error(e.message),
  })

  const toggleSave = useMutation({
    mutationFn: () => (isSaved ? api.unsaveJob(jobId) : api.saveJob(jobId).then(() => undefined)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  const report = useMutation({
    mutationFn: () => api.reportJob(jobId, reportReason),
    onSuccess: () => toast.success('Report submitted for admin review'),
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <div className="mx-auto max-w-3xl p-8"><Skeleton className="h-64" /></div>
  if (!job) return <p className="p-8">Job not found.</p>

  const applied = apply.isSuccess

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/jobs" className="text-sm text-primary">← Back to jobs</Link>
      <Card className="mt-3">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{job.title}</CardTitle>
              <p className="mt-1 flex items-center gap-3 text-muted-foreground">
                <span className="flex items-center gap-1"><Building2 className="h-4 w-4" />{job.company?.name}</span>
                {job.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>}
                <JobStatusBadge status={job.status} />
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{job.workMode}</Badge>
                <Badge variant="secondary">{job.employmentType.replace('_', ' ')}</Badge>
                <Badge variant="outline">{job.experienceLevel}</Badge>
                {job.openings > 1 && <Badge variant="outline">{job.openings} openings</Badge>}
                {job.salaryMin && job.salaryMax && (
                  <Badge variant="outline">
                    ${(job.salaryMin / 1000).toFixed(0)}k–${(job.salaryMax / 1000).toFixed(0)}k
                  </Badge>
                )}
                {job.applicationDeadline && (
                  <Badge variant="outline">
                    Apply by {new Date(job.applicationDeadline).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
            {user?.role === 'CANDIDATE' && (
              <Button variant="outline" size="sm" onClick={() => toggleSave.mutate()}>
                <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? 'fill-primary text-primary' : ''}`} />
                {isSaved ? 'Saved' : 'Save'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{job.description}</p>
          {job.requirements && (
            <div className="mt-4 rounded-md bg-muted p-3 text-sm">
              <strong>Requirements:</strong> {job.requirements}
            </div>
          )}
          {job.educationRequirement && (
            <div className="mt-2 rounded-md bg-muted p-3 text-sm">
              <strong>Education:</strong> {job.educationRequirement}
            </div>
          )}
          {!!job.skills?.length && (
            <div className="mt-4 space-y-2 text-sm">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Required skills</p>
                <div className="flex flex-wrap gap-1">
                  {job.skills.filter((s) => s.required).map((s) => (
                    <Badge key={s.skill.name} variant="secondary">{s.skill.name}</Badge>
                  ))}
                </div>
              </div>
              {job.skills.some((s) => !s.required) && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Nice to have</p>
                  <div className="flex flex-wrap gap-1">
                    {job.skills.filter((s) => !s.required).map((s) => (
                      <Badge key={s.skill.name} variant="outline">{s.skill.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {user?.role === 'CANDIDATE' && job.status === 'PUBLISHED' && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Apply to this job</CardTitle></CardHeader>
          <CardContent>
            {applied ? (
              <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Application submitted — track it under Dashboard → Applications.
              </p>
            ) : resumes?.length ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Resume</Label>
                  <Select value={resumeId} onValueChange={(v) => setResumeId(v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Choose a resume" /></SelectTrigger>
                    <SelectContent>
                      {resumes.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.originalFilename}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cover note (optional)</Label>
                  <Textarea rows={3} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} />
                </div>
                <Button disabled={!resumeId || apply.isPending} onClick={() => apply.mutate()}>
                  {apply.isPending ? 'Submitting…' : 'Submit application'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Upload a resume first on your{' '}
                <Link href="/dashboard/resumes" className="text-primary">Resumes</Link> page.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        {!user && <p><Link href="/login" className="text-primary">Log in</Link> as a candidate to apply.</p>}
        {user?.role === 'CANDIDATE' && (
          <Dialog>
            <DialogTrigger render={<button className="flex items-center gap-1 hover:text-destructive"><Flag className="h-3.5 w-3.5" /> Report this posting</button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>Report job posting</DialogTitle></DialogHeader>
              <Textarea
                placeholder="Why is this posting inappropriate?"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              />
              <Button
                variant="destructive" disabled={reportReason.length < 5 || report.isPending}
                onClick={() => report.mutate()}
              >
                Submit report
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
