'use client'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function Companies() {
  const { data, isLoading } = useQuery({ queryKey: ['companies'], queryFn: api.listCompanies })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Companies hiring</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {data?.length ?? 0} companies on the platform
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        {data?.map((c) => (
          <Link key={c.id} href={`/jobs?q=${encodeURIComponent(c.name)}`}>
            <Card className="h-full transition hover:border-primary/50">
              <CardContent className="flex items-start gap-3 p-5">
                <div className="rounded-md bg-primary/10 p-2.5">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <Badge variant="secondary" className="mt-1.5">
                    {c._count.jobs} open role{c._count.jobs === 1 ? '' : 's'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {data?.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">No companies yet.</p>
      )}
    </div>
  )
}
