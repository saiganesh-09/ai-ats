'use client'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Link2, MapPin, Phone, User, Video } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const TYPE_ICON = { ONLINE: Video, PHONE: Phone, ONSITE: MapPin } as const

export default function Interviews() {
  const { data, isLoading } = useQuery({ queryKey: ['interviews'], queryFn: api.myInterviews })
  const now = Date.now()
  const upcoming = data?.filter((iv) => new Date(iv.scheduledAt).getTime() >= now - 3600e3) ?? []
  const past = data?.filter((iv) => new Date(iv.scheduledAt).getTime() < now - 3600e3) ?? []

  const renderInterview = (iv: (typeof upcoming)[number], dimmed = false) => {
    const Icon = TYPE_ICON[iv.type] ?? Video
    return (
      <Card key={iv.id} className={dimmed ? 'opacity-60' : ''}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{iv.application?.job?.title}</p>
            <Badge variant="secondary"><Icon className="mr-1 h-3 w-3" />{iv.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{iv.application?.job?.company?.name}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" />
              {new Date(iv.scheduledAt).toLocaleString()}
              {iv.endsAt && ` – ${new Date(iv.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </span>
            {(iv.interviewer || iv.scheduledBy) && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {iv.interviewer?.fullName ?? iv.scheduledBy?.fullName}
              </span>
            )}
            {iv.location && (
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{iv.location}</span>
            )}
            {iv.link && (
              <a href={iv.link} target="_blank" className="flex items-center gap-1.5 text-primary">
                <Link2 className="h-4 w-4" />Join link
              </a>
            )}
          </div>
          {iv.notes && <p className="mt-2 rounded bg-muted p-2 text-sm">{iv.notes}</p>}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Interview schedule</h1>
      <div className="mt-6 space-y-3">
        {isLoading && <Skeleton className="h-24" />}
        {!!upcoming.length && (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upcoming</p>
        )}
        {upcoming.map((iv) => renderInterview(iv))}
        {!!past.length && (
          <p className="pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Past</p>
        )}
        {past.map((iv) => renderInterview(iv, true))}
        {data?.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">No interviews scheduled yet.</p>
        )}
      </div>
    </div>
  )
}
