'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/endpoints'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminCompanies() {
  const { data: companies, isLoading } = useQuery({
    queryKey: ['adminCompanies'],
    queryFn: api.adminCompanies,
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Companies</h1>
      <div className="mt-6 space-y-3">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        {companies?.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  invite: {c.inviteCode} · created {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{c._count.users} members</p>
                <p>{c._count.jobs} jobs</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
