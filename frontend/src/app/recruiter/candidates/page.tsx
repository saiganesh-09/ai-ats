'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Search, User } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { StatusBadge } from '@/components/badges'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

/** Candidates = people who applied to this company's jobs, grouped per person. */
export default function Candidates() {
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['company-candidates', q],
    queryFn: () => api.companyApplications(q || undefined),
  })

  // Group applications by candidate — the page answers "who has applied to us?"
  const byCandidate = new Map<number, typeof data>()
  data?.forEach((a) => {
    if (!a.candidate) return
    const list = byCandidate.get(a.candidate.id) ?? []
    list.push(a)
    byCandidate.set(a.candidate.id, list)
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Candidates</h1>
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name…" className="pl-9" onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        {[...byCandidate.entries()].map(([id, apps]) => {
          const c = apps![0].candidate
          if (!c) return null
          return (
            <Card key={id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-full bg-muted p-2.5"><User className="h-4 w-4" /></div>
                <div className="flex-1">
                  <p className="font-medium">{c.fullName}</p>
                  <p className="text-xs text-muted-foreground">{c.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {apps!.map((a) => (
                      <Link key={a.id} href={`/recruiter/applications/${a.id}`}
                        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition hover:border-primary/50">
                        {a.job?.title} <StatusBadge status={a.status} />
                      </Link>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {data?.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">No candidates match.</p>
        )}
      </div>
    </div>
  )
}
