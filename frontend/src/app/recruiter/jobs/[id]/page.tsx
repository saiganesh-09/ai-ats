'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import { STATUS_ORDER, type ApplicationStatus } from '@/lib/types'
import { ScoreBadge } from '@/components/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

// API accepts forward moves; APPLIED is entry-only, WITHDRAWN is candidate-only.
const DROPPABLE = ['SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']

/**
 * Kanban pipeline: drag a card onto a stage column to move the candidate.
 * Native HTML5 drag & drop — no DnD library needed for a simple board.
 * Every drop hits PATCH /applications/:id/status → status_history row.
 */
export default function Pipeline({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const jobId = Number(id)
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data: job } = useQuery({ queryKey: ['job', jobId], queryFn: () => api.getJob(jobId) })
  const { data: applicants, isLoading } = useQuery({
    queryKey: ['pipeline', jobId, q],
    queryFn: () => api.pipeline(jobId, { q: q || undefined, sort: 'score' }),
  })

  const move = useMutation({
    mutationFn: ({ appId, status, reason }: { appId: number; status: string; reason?: string }) =>
      api.setStatus(appId, status, reason),
    onSuccess: () => {
      toast.success('Candidate moved — recorded in status history')
      qc.invalidateQueries({ queryKey: ['pipeline', jobId] })
      setRejectTarget(null)
      setRejectReason('')
    },
    onError: (e) => {
      toast.error(e.message)
      qc.invalidateQueries({ queryKey: ['pipeline', jobId] })
    },
  })

  const onDrop = (status: ApplicationStatus) => (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(null)
    const appId = Number(e.dataTransfer.getData('text/plain'))
    if (!appId) return
    if (status === 'REJECTED') setRejectTarget(appId)
    else move.mutate({ appId, status })
  }

  const byStatus = (s: ApplicationStatus) => applicants?.filter((a) => a.status === s) ?? []
  const terminal = applicants?.filter((a) => ['REJECTED', 'WITHDRAWN'].includes(a.status)) ?? []

  const columnProps = (status: ApplicationStatus) => ({
    onDragOver: (e: React.DragEvent) => {
      if (DROPPABLE.includes(status)) {
        e.preventDefault() // required to allow drop
        setDragOver(status)
      }
    },
    onDragLeave: () => setDragOver((d) => (d === status ? null : d)),
    onDrop: onDrop(status),
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/recruiter/jobs" className="text-sm text-primary">← Jobs</Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{job?.title ?? 'Pipeline'}</h1>
          <p className="text-sm text-muted-foreground">
            {applicants?.length ?? 0} applicants · drag cards between stages
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
            <div key={status} className="w-64 shrink-0" {...columnProps(status)}>
              <div
                className={`mb-2 flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  dragOver === status ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted'
                }`}
              >
                {status}
                <span className="text-muted-foreground">{byStatus(status).length}</span>
              </div>
              <div className={`min-h-24 space-y-2 rounded-md ${dragOver === status ? 'bg-primary/5' : ''}`}>
                {byStatus(status).map((a) => (
                  <Card
                    key={a.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(a.id))}
                    className="cursor-grab transition hover:border-primary/50 active:cursor-grabbing"
                  >
                    <CardContent className="p-3">
                      <Link href={`/recruiter/applications/${a.id}`} className="text-sm font-medium hover:text-primary">
                        {a.candidate?.fullName}
                      </Link>
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
                ))}
              </div>
            </div>
          ))}

          {/* terminal column — drop here rejects (with optional reason) */}
          <div className="w-64 shrink-0" {...columnProps('REJECTED' as ApplicationStatus)}>
            <div
              className={`mb-2 flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                dragOver === 'REJECTED' ? 'bg-destructive/20 ring-2 ring-destructive' : 'bg-muted'
              }`}
            >
              REJECTED / WITHDRAWN
              <span className="text-muted-foreground">{terminal.length}</span>
            </div>
            <div className={`min-h-24 space-y-2 rounded-md ${dragOver === 'REJECTED' ? 'bg-destructive/5' : ''}`}>
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

      {/* rejection reason dialog — recorded on the status history row */}
      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject candidate</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Reason (optional — stored in status history)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={move.isPending}
              onClick={() => rejectTarget && move.mutate({ appId: rejectTarget, status: 'REJECTED', reason: rejectReason || undefined })}
            >
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
