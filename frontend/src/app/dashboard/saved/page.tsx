'use client'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookmarkX, Building2, MapPin } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function SavedJobs() {
  const qc = useQueryClient()
  const { data: saved, isLoading } = useQuery({ queryKey: ['saved'], queryFn: api.savedJobs })
  const unsave = useMutation({
    mutationFn: api.unsaveJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Saved jobs</h1>
      <div className="mt-6 space-y-3">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        {saved?.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <Link href={`/jobs/${s.jobId}`} className="font-semibold hover:text-primary">
                  {s.job.title}
                </Link>
                <p className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{s.job.company?.name}</span>
                  {s.job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.job.location}</span>}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => unsave.mutate(s.jobId)}>
                <BookmarkX className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {saved?.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            Nothing saved. Bookmark jobs from the <Link href="/jobs" className="text-primary">job board</Link>.
          </p>
        )}
      </div>
    </div>
  )
}
