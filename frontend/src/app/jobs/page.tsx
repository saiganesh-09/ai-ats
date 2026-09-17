'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Building2, MapPin, Search } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export default function JobBoard() {
  const [q, setQ] = useState('')
  const [location, setLocation] = useState('')
  const [sort, setSort] = useState('newest')

  // Debounce: wait 300ms after typing before hitting the API.
  const [params, setParams] = useState({ q: '', location: '', sort: 'newest' })
  const update = (patch: Partial<typeof params>) => {
    const next = { ...params, ...patch }
    setParams(next)
    clearTimeout((update as { t?: number }).t)
    ;(update as { t?: number }).t = window.setTimeout(() => {
      setQ(next.q); setLocation(next.location); setSort(next.sort)
    }, 300)
  }

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs', q, location, sort],
    queryFn: () => api.listJobs({ q: q || undefined, location: location || undefined, sort }),
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Open positions</h1>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search job titles…" className="pl-9"
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>
        <Input
          placeholder="Location" className="sm:w-48"
          onChange={(e) => update({ location: e.target.value })}
        />
        <Select value={params.sort} onValueChange={(v) => update({ sort: v ?? 'newest' })}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid gap-3">
        {isLoading &&
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        {jobs?.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">No open positions found.</p>
        )}
        {jobs?.map((job) => (
          <Link key={job.id} href={`/jobs/${job.id}`}>
            <Card className="transition hover:border-primary/50">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <h2 className="font-semibold">{job.title}</h2>
                  <p className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company?.name}</span>
                    {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
                </div>
                <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                  {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
