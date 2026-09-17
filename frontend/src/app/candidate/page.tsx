'use client'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Bell, Bookmark, Calendar, FileText, Send, Sparkles } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { useAuth } from '@/lib/auth'
import { StatusBadge } from '@/components/badges'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Dashboard() {
  const { user } = useAuth()
  const { data: apps } = useQuery({ queryKey: ['applications'], queryFn: api.myApplications })
  const { data: resumes } = useQuery({ queryKey: ['resumes'], queryFn: api.myResumes })
  const { data: interviews } = useQuery({ queryKey: ['interviews'], queryFn: api.myInterviews })
  const { data: dash } = useQuery({ queryKey: ['candidate-dashboard'], queryFn: api.candidateDashboard })

  const upcoming = interviews?.filter((i) => new Date(i.scheduledAt) >= new Date()) ?? []

  const stats = [
    { label: 'Applications', value: apps?.length ?? 0, icon: Send, href: '/candidate/applications' },
    { label: 'Resumes', value: resumes?.length ?? 0, icon: FileText, href: '/candidate/resume' },
    { label: 'Saved jobs', value: dash?.savedJobs ?? 0, icon: Bookmark, href: '/candidate/saved-jobs' },
    { label: 'Unread alerts', value: dash?.unreadNotifications ?? 0, icon: Bell, href: '/notifications' },
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

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* profile completion */}
        <Card>
          <CardHeader><CardTitle className="text-base">Profile completion</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dash?.profileCompletion ?? 0}%</p>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${dash?.profileCompletion ?? 0}%` }}
              />
            </div>
            {!!dash?.missingCheckpoints && (
              <p className="mt-2 text-xs text-muted-foreground">
                {dash.missingCheckpoints} item{dash.missingCheckpoints === 1 ? '' : 's'} to go —{' '}
                <Link href="/candidate/profile" className="text-primary">complete your profile</Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* upcoming interviews */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming interviews</CardTitle>
            <Link href="/candidate/interviews" className="flex items-center gap-1 text-sm text-primary">
              All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {upcoming.slice(0, 3).map((iv) => (
              <div key={iv.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{iv.application?.job?.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(iv.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary">{iv.type}</Badge>
              </div>
            ))}
            {!upcoming.length && <p className="text-muted-foreground">Nothing scheduled.</p>}
          </CardContent>
        </Card>

        {/* pipeline snapshot */}
        <Card>
          <CardHeader><CardTitle className="text-base">Your pipeline</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {dash?.statusCounts && Object.keys(dash.statusCounts).length
              ? Object.entries(dash.statusCounts).map(([s, n]) => (
                <span key={s} className="flex items-center gap-1">
                  <StatusBadge status={s} />
                  <span className="text-sm font-medium">×{n}</span>
                </span>
              ))
              : <p className="text-sm text-muted-foreground">No applications yet.</p>}
          </CardContent>
        </Card>
      </div>

      {/* recommended jobs — the normalized skill-taxonomy payoff */}
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Recommended for your skills
          </CardTitle>
          <Link href="/jobs" className="flex items-center gap-1 text-sm text-primary">
            Browse all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {dash?.recommendedJobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`}>
              <div className="flex items-center justify-between border-b py-2.5 last:border-0 transition hover:bg-accent/40 -mx-2 rounded px-2">
                <div>
                  <p className="text-sm font-medium">{j.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {j.company}{j.location ? ` · ${j.location}` : ''}
                    {j.salaryMin && j.salaryMax ? ` · $${(j.salaryMin / 1000).toFixed(0)}k–$${(j.salaryMax / 1000).toFixed(0)}k` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline">{j.workMode}</Badge>
                  <Badge variant="secondary">{j.matchCount} skill match{j.matchCount === 1 ? '' : 'es'}</Badge>
                </div>
              </div>
            </Link>
          ))}
          {dash && !dash.recommendedJobs.length && (
            <p className="text-sm text-muted-foreground">
              Add skills to your profile to get recommendations.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recent applications</CardTitle>
          <Link href="/candidate/applications" className="flex items-center gap-1 text-sm text-primary">
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
