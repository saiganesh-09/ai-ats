'use client'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Bookmark, Calendar, FileText, Send } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { useAuth } from '@/lib/auth'
import { StatusBadge } from '@/components/badges'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Dashboard() {
  const { user } = useAuth()
  const { data: apps } = useQuery({ queryKey: ['applications'], queryFn: api.myApplications })
  const { data: resumes } = useQuery({ queryKey: ['resumes'], queryFn: api.myResumes })
  const { data: saved } = useQuery({ queryKey: ['saved'], queryFn: api.savedJobs })
  const { data: interviews } = useQuery({ queryKey: ['interviews'], queryFn: api.myInterviews })

  const stats = [
    { label: 'Applications', value: apps?.length ?? 0, icon: Send, href: '/dashboard/applications' },
    { label: 'Resumes', value: resumes?.length ?? 0, icon: FileText, href: '/dashboard/resumes' },
    { label: 'Saved jobs', value: saved?.length ?? 0, icon: Bookmark, href: '/dashboard/saved' },
    { label: 'Interviews', value: interviews?.length ?? 0, icon: Calendar, href: '/dashboard/interviews' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Welcome back, {user?.fullName.split(' ')[0]}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition hover:border-primary/50">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
                <s.icon className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recent applications</CardTitle>
          <Link href="/dashboard/applications" className="flex items-center gap-1 text-sm text-primary">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {apps?.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b py-2.5 last:border-0">
              <div>
                <p className="text-sm font-medium">{a.job?.title}</p>
                <p className="text-xs text-muted-foreground">{a.job?.company?.name}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
          {apps?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No applications yet. <Link href="/jobs" className="text-primary">Browse jobs</Link>.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
