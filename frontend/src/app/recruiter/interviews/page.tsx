'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, MapPin, Phone, User, Video } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const TYPE_ICON = { ONLINE: Video, PHONE: Phone, ONSITE: MapPin } as const

/** Staff view: every interview across the company, upcoming first. */
export default function CompanyInterviews() {
  const { data, isLoading } = useQuery({ queryKey: ['company-interviews'], queryFn: api.companyInterviews })
  const [now] = useState(() => Date.now())
  const upcoming = data?.filter((i) => new Date(i.scheduledAt).getTime() >= now - 3600e3) ?? []
  const past = data?.filter((i) => new Date(i.scheduledAt).getTime() < now - 3600e3) ?? []

  const render = (iv: (typeof upcoming)[number], dimmed = false) => {
    const Icon = TYPE_ICON[iv.type] ?? Video
    const c = iv.application as { candidate?: { fullName: string }; job?: { title: string } } | undefined
    return (
      <Card key={iv.id} className={dimmed ? 'opacity-60' : ''}>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium">
              <Link href={`/recruiter/applications/${iv.applicationId}`} className="hover:text-primary">
                {c?.candidate?.fullName}
              </Link>
              <span className="text-sm font-normal text-muted-foreground"> · {c?.job?.title}</span>
            </p>
            <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {new Date(iv.scheduledAt).toLocaleString()}
                {iv.endsAt && ` – ${new Date(iv.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </span>
              {(iv.interviewer || iv.scheduledBy) && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />{iv.interviewer?.fullName ?? iv.scheduledBy?.fullName}
                </span>
              )}
            </p>
          </div>
          <Badge variant="secondary"><Icon className="mr-1 h-3 w-3" />{iv.type}</Badge>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Interview schedule</h1>
      <div className="mt-6 space-y-3">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        {!!upcoming.length && <p className="text-xs font-medium uppercase text-muted-foreground">Upcoming</p>}
        {upcoming.map((iv) => render(iv))}
        {!!past.length && <p className="pt-3 text-xs font-medium uppercase text-muted-foreground">Past</p>}
        {past.map((iv) => render(iv, true))}
        {data?.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">No interviews scheduled.</p>
        )}
      </div>
    </div>
  )
}
