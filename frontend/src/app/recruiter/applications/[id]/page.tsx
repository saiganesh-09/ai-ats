'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BrainCircuit, CalendarPlus, Download, ListChecks, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import { getToken } from '@/lib/api'
import { STATUS_ORDER } from '@/lib/types'
import { ScoreBadge, StatusBadge } from '@/components/badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

export default function ApplicantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const appId = Number(id)
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [feedback, setFeedback] = useState('')
  const [rating, setRating] = useState('')
  const [questions, setQuestions] = useState<string[] | null>(null)
  const [interview, setInterview] = useState({ scheduledAt: '', location: '', link: '', notes: '' })

  const { data: app, isLoading } = useQuery({
    queryKey: ['application', appId],
    queryFn: () => api.applicationDetail(appId),
  })
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: api.myCompany })
  const members = company?.users?.filter((u) => u.role === 'RECRUITER' || u.role === 'ADMIN') ?? []

  const invalidate = () => qc.invalidateQueries({ queryKey: ['application', appId] })

  const setStatus = useMutation({
    mutationFn: (status: string) => api.setStatus(appId, status),
    onSuccess: () => { toast.success('Status updated — candidate notified'); invalidate() },
    onError: (e) => toast.error(e.message),
  })
  const assign = useMutation({
    mutationFn: (recruiterId: string) => api.assign(appId, Number(recruiterId)),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })
  const addNote = useMutation({
    mutationFn: () => api.addNote(appId, note),
    onSuccess: () => { setNote(''); invalidate() },
    onError: (e) => toast.error(e.message),
  })
  const addFeedback = useMutation({
    mutationFn: () => api.addFeedback(appId, feedback, rating ? Number(rating) : undefined),
    onSuccess: () => { setFeedback(''); setRating(''); invalidate() },
    onError: (e) => toast.error(e.message),
  })
  const score = useMutation({
    mutationFn: () => api.scoreApplication(appId),
    onSuccess: () => { toast.success('AI scoring complete'); invalidate() },
    onError: (e) => toast.error(e.message),
  })
  const summarize = useMutation({
    mutationFn: () => api.summarizeApplication(appId),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })
  const genQuestions = useMutation({
    mutationFn: () => api.generateQuestions(appId),
    onSuccess: (d) => setQuestions(d.questions),
    onError: (e) => toast.error(e.message),
  })
  const schedule = useMutation({
    mutationFn: () => api.scheduleInterview({ applicationId: appId, ...interview }),
    onSuccess: () => { toast.success('Interview scheduled'); invalidate() },
    onError: (e) => toast.error(e.message),
  })

  const downloadResume = async () => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
    const res = await fetch(`${base}/resumes/${app!.resume!.id}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = app!.resume!.originalFilename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <div className="mx-auto max-w-5xl p-8"><Skeleton className="h-96" /></div>
  if (!app) return <p className="p-8">Application not found.</p>

  const skills = app.resume?.parsed?.skills ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/recruiter/jobs/${app.jobId}`} className="text-sm text-primary">← Pipeline</Link>

      {/* header: candidate + actions */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{app.candidate?.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {app.candidate?.email} · applied to <strong>{app.job?.title}</strong> ·{' '}
            {new Date(app.createdAt).toLocaleDateString()}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={app.status} />
            <ScoreBadge score={app.matchScore} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={app.status} onValueChange={(v) => v && setStatus.mutate(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[...STATUS_ORDER, 'REJECTED'].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {members.length > 0 && (
            <Select
              value={app.assignedRecruiter ? String(app.assignedRecruiter.id) : ''}
              onValueChange={(v) => v && assign.mutate(v)}
            >
              <SelectTrigger className="w-40"><SelectValue placeholder="Assign to…" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={downloadResume}>
            <Download className="mr-2 h-4 w-4" />Resume
          </Button>
          <Dialog>
            <DialogTrigger render={<Button size="sm"><CalendarPlus className="mr-2 h-4 w-4" />Interview</Button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule interview</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Date & time</Label>
                  <Input type="datetime-local" value={interview.scheduledAt}
                    onChange={(e) => setInterview({ ...interview, scheduledAt: e.target.value })} />
                </div>
                <Input placeholder="Location (optional)" value={interview.location}
                  onChange={(e) => setInterview({ ...interview, location: e.target.value })} />
                <Input placeholder="Meeting link (optional)" value={interview.link}
                  onChange={(e) => setInterview({ ...interview, link: e.target.value })} />
                <Textarea placeholder="Notes for the candidate (optional)" value={interview.notes}
                  onChange={(e) => setInterview({ ...interview, notes: e.target.value })} />
                <Button className="w-full" disabled={!interview.scheduledAt || schedule.isPending}
                  onClick={() => schedule.mutate()}>
                  Schedule
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* left: AI panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BrainCircuit className="h-4 w-4 text-primary" /> AI insights
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  AI-generated estimate
                </span>
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => score.mutate()} disabled={score.isPending}>
                  {score.isPending ? 'Scoring…' : app.matchScore === null ? 'Score' : 'Re-score'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => summarize.mutate()} disabled={summarize.isPending}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" />{app.aiSummary ? 'Refresh' : 'Summarize'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {app.matchDetails ? (
                <>
                  <p>{app.matchDetails.explanation}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border p-2">
                      <p className="text-muted-foreground">Experience match</p>
                      <p className="font-semibold">{app.matchDetails.experience_match ?? '—'}</p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="text-muted-foreground">Education match</p>
                      <p className="font-semibold">{app.matchDetails.education_match ?? '—'}</p>
                    </div>
                  </div>
                  <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    AI-generated matching estimate — review the original resume before making decisions.
                  </p>
                  <div>
                    <p className="mb-1 text-xs font-medium text-emerald-600">Matched skills</p>
                    <div className="flex flex-wrap gap-1">
                      {app.matchDetails.matched_skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-red-600">Missing skills</p>
                    <div className="flex flex-wrap gap-1">
                      {app.matchDetails.missing_skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                    </div>
                  </div>
                </>
              ) : <p className="text-muted-foreground">Run Score to generate AI match analysis.</p>}
              {app.aiSummary && (
                <div className="rounded-md bg-muted p-3">
                  <p className="mb-1 text-xs font-medium">AI candidate summary</p>
                  <p>{app.aiSummary}</p>
                </div>
              )}
              <div>
                <Button
                  variant="ghost" size="sm" className="px-0"
                  onClick={() => genQuestions.mutate()} disabled={genQuestions.isPending}
                >
                  <ListChecks className="mr-2 h-4 w-4" />
                  {genQuestions.isPending ? 'Generating…' : 'Generate interview questions'}
                </Button>
                {questions && (
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                    {questions.map((q, i) => <li key={i}>{q}</li>)}
                  </ol>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Resume profile</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {app.resume?.parsed?.summary && <p className="text-muted-foreground">{app.resume.parsed.summary}</p>}
              {skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                </div>
              )}
              {!!app.candidate?.skills?.length && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {app.candidate.skills.map((cs) => (
                    <Badge key={cs.skill.name} variant="outline">{cs.skill.name}</Badge>
                  ))}
                </div>
              )}
              {app.candidate?.experiences?.length ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">Experience</p>
                  {app.candidate.experiences.map((e, i) => (
                    <p key={i} className="mt-1">· {e.title} @ {e.company} ({e.years}y)</p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {app.coverNote && (
            <Card>
              <CardHeader><CardTitle className="text-base">Cover note</CardTitle></CardHeader>
              <CardContent className="text-sm italic">"{app.coverNote}"</CardContent>
            </Card>
          )}
        </div>

        {/* right: activity — timeline, notes, feedback, interviews */}
        <div className="space-y-4">
          {!!app.history?.length && (
            <Card>
              <CardHeader><CardTitle className="text-base">Pipeline history</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-2 border-l-2 border-muted pl-4 text-sm">
                  {app.history.map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                      <p>
                        {h.fromStatus ? <span className="text-muted-foreground">{h.fromStatus} → </span> : ''}
                        <strong>{h.toStatus}</strong>
                        {h.reason && <span className="ml-1 text-xs text-muted-foreground">— {h.reason}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.changedBy?.fullName ?? 'system'} · {new Date(h.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
          {!!app.interviews?.length && (
            <Card>
              <CardHeader><CardTitle className="text-base">Interviews</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {app.interviews.map((iv) => (
                  <div key={iv.id} className="rounded-md border p-3">
                    <p className="font-medium">{new Date(iv.scheduledAt).toLocaleString()}</p>
                    <p className="text-muted-foreground">{iv.location ?? iv.link ?? ''}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Internal notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {app.notes?.map((n) => (
                <div key={n.id} className="text-sm">
                  <p>{n.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {n.author.fullName} · {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              <div className="flex gap-2">
                <Textarea rows={2} placeholder="Add a note (never visible to candidate)…"
                  value={note} onChange={(e) => setNote(e.target.value)} />
                <Button size="sm" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()}>Add</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Interview feedback</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {app.feedback?.map((f) => (
                <div key={f.id} className="text-sm">
                  <p>
                    {f.rating && <span className="mr-1 font-semibold text-amber-500">{'★'.repeat(f.rating)}</span>}
                    {f.text}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.author.fullName} ({f.author.role}) · {new Date(f.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
              <div className="space-y-2">
                <Textarea rows={2} placeholder="Add feedback…" value={feedback}
                  onChange={(e) => setFeedback(e.target.value)} />
                <div className="flex gap-2">
                  <Select value={rating} onValueChange={(v) => setRating(v ?? '')}>
                    <SelectTrigger className="w-28"><SelectValue placeholder="Rating" /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((r) => <SelectItem key={r} value={String(r)}>{'★'.repeat(r)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!feedback.trim() || addFeedback.isPending}
                    onClick={() => addFeedback.mutate()}>Add feedback</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
