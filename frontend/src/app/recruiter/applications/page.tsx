'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/endpoints'
import { STATUS_ORDER } from '@/lib/types'
import { ScoreBadge, StatusBadge } from '@/components/badges'
import { Pager } from '@/components/Pager'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const ALL = '__all__'

/** Flat application table across all company jobs (per-job kanban is the detail view). */
export default function Applications() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>(ALL)
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['company-applications', q, page],
    queryFn: () => api.companyApplications({ q: q || undefined, page }),
  })
  const rows = data?.items.filter((a) => status === ALL || a.status === status) ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Applications</h1>
        <div className="flex gap-2">
          <Input placeholder="Search candidates…" className="w-56" onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {[...STATUS_ORDER, 'REJECTED', 'WITHDRAWN'].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading && <Skeleton className="m-4 h-40" />}
          {rows.map((a) => (
            <Link key={a.id} href={`/recruiter/applications/${a.id}`}>
              <div className="flex items-center justify-between border-b px-4 py-3 last:border-0 transition hover:bg-accent/40">
                <div>
                  <p className="text-sm font-medium">{a.candidate?.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.job?.title} · applied {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreBadge score={a.matchScore} />
                  <StatusBadge status={a.status} />
                </div>
              </div>
            </Link>
          ))}
          {data && !rows.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">No applications match.</p>
          )}
        </CardContent>
      </Card>
      {data && <Pager page={page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
    </div>
  )
}
