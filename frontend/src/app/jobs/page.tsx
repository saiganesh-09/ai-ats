'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Building2, ChevronLeft, ChevronRight, MapPin, Search, X } from 'lucide-react'
import { api } from '@/lib/endpoints'
import type { JobSearchParams } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const ALL = '__all__' // base-ui Select clears with null; sentinel keeps filters explicit

function useDebounced<T>(value: T, ms = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export default function JobBoard() {
  // `filters` = what the UI shows; `query` = debounced values sent to the API.
  const [filters, setFilters] = useState<JobSearchParams>({ sort: 'newest' })
  const [page, setPage] = useState(1)
  const query = useDebounced({ ...filters, page, pageSize: 9 })

  useEffect(() => setPage(1), [filters]) // any filter change resets pagination

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['jobs', query],
    queryFn: () => api.listJobs(query),
    placeholderData: keepPreviousData, // smooth pagination — no flicker
  })

  const set = (k: keyof JobSearchParams, v: string | number | null | undefined) =>
    setFilters((f) => ({ ...f, [k]: v || undefined }))

  const activeCount = Object.entries(filters).filter(([k, v]) => v && k !== 'sort').length

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Open positions</h1>

      {/* search row */}
      <div className="mt-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Title, keyword, or company…" className="pl-9"
            onChange={(e) => set('q', e.target.value)}
          />
        </div>
        <Input
          placeholder="Location" className="w-44"
          onChange={(e) => set('location', e.target.value)}
        />
        <Select value={filters.sort ?? 'newest'} onValueChange={(v) => set('sort', v ?? 'newest')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="salary">Highest salary</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* filter row — every one maps to a SQL WHERE clause server-side */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={filters.employmentType ?? ALL} onValueChange={(v) => set('employmentType', v === ALL ? undefined : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any type</SelectItem>
            <SelectItem value="FULL_TIME">Full-time</SelectItem>
            <SelectItem value="PART_TIME">Part-time</SelectItem>
            <SelectItem value="CONTRACT">Contract</SelectItem>
            <SelectItem value="INTERNSHIP">Internship</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.workMode ?? ALL} onValueChange={(v) => set('workMode', v === ALL ? undefined : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Work mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any mode</SelectItem>
            <SelectItem value="REMOTE">Remote</SelectItem>
            <SelectItem value="HYBRID">Hybrid</SelectItem>
            <SelectItem value="ONSITE">On-site</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.experienceLevel ?? ALL} onValueChange={(v) => set('experienceLevel', v === ALL ? undefined : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any level</SelectItem>
            <SelectItem value="ENTRY">Entry</SelectItem>
            <SelectItem value="MID">Mid</SelectItem>
            <SelectItem value="SENIOR">Senior</SelectItem>
            <SelectItem value="LEAD">Lead</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={String(filters.postedWithin ?? ALL)}
          onValueChange={(v) => set('postedWithin', v === ALL ? undefined : Number(v))}
        >
          <SelectTrigger className="w-40"><SelectValue placeholder="Posted" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any time</SelectItem>
            <SelectItem value="7">Past week</SelectItem>
            <SelectItem value="30">Past month</SelectItem>
            <SelectItem value="90">Past 3 months</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Min salary" className="w-32" type="number" min={0}
          onChange={(e) => set('salaryMin', e.target.value ? Number(e.target.value) : undefined)}
        />
        <Input
          placeholder="Skills (e.g. react, node)" className="w-52"
          onChange={(e) => set('skills', e.target.value)}
        />
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ sort: filters.sort })}>
            <X className="mr-1 h-3.5 w-3.5" />Clear ({activeCount})
          </Button>
        )}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {data ? `${data.total} position${data.total === 1 ? '' : 's'} found` : 'Searching…'}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        {data?.items.map((job) => (
          <Link key={job.id} href={`/jobs/${job.id}`}>
            <Card className="h-full transition hover:border-primary/50">
              <CardContent className="flex h-full flex-col p-4">
                <h2 className="font-semibold leading-snug">{job.title}</h2>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{job.company?.name}</span>
                  {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="secondary">{job.workMode}</Badge>
                  <Badge variant="outline">{job.employmentType.replace('_', ' ')}</Badge>
                  <Badge variant="outline">{job.experienceLevel}</Badge>
                </div>
                {!!job.skills?.length && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {job.skills.slice(0, 4).map((js) => (
                      <Badge key={js.skill.name} variant="secondary" className="text-[10px]">
                        {js.skill.name}
                      </Badge>
                    ))}
                    {job.skills.length > 4 && <span className="text-xs text-muted-foreground">+{job.skills.length - 4}</span>}
                  </div>
                )}
                <p className="mt-auto pt-3 text-sm font-medium text-primary">
                  {job.salaryMin && job.salaryMax
                    ? `$${(job.salaryMin / 1000).toFixed(0)}k–$${(job.salaryMax / 1000).toFixed(0)}k`
                    : 'Salary undisclosed'}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline" size="sm"
            disabled={page <= 1 || isPlaceholderData}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {data.page} of {data.totalPages}</span>
          <Button
            variant="outline" size="sm"
            disabled={page >= data.totalPages || isPlaceholderData}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {data?.items.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">No positions match those filters.</p>
      )}
    </div>
  )
}
