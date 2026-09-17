'use client'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Link2, MapPin } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function Interviews() {
  const { data, isLoading } = useQuery({ queryKey: ['interviews'], queryFn: api.myInterviews })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Interview schedule</h1>
      <div className="mt-6 space-y-3">
        {isLoading && <Skeleton className="h-24" />}
        {data?.map((iv) => (
          <Card key={iv.id}>
            <CardContent className="p-5">
              <p className="font-semibold">{iv.application?.job?.title}</p>
              <p className="text-sm text-muted-foreground">{iv.application?.job?.company?.name}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {new Date(iv.scheduledAt).toLocaleString()}
                </span>
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
        ))}
        {data?.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">No interviews scheduled yet.</p>
        )}
      </div>
    </div>
  )
}
