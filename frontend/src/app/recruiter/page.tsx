'use client'
import { useQuery } from '@tanstack/react-query'
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '@/lib/endpoints'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { STATUS_ORDER } from '@/lib/types'

const FUNNEL_LABELS: Record<string, string> = {
  APPLIED: 'Applied', SCREENING: 'Screening', SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview', OFFER: 'Offer', HIRED: 'Hired',
  REJECTED: 'Rejected', WITHDRAWN: 'Withdrawn',
}

export default function RecruiterDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })

  if (isLoading) return <div className="mx-auto max-w-6xl p-8"><Skeleton className="h-96" /></div>
  if (!data) return <p className="p-8 text-muted-foreground">Create or join a company to see analytics.</p>

  const stats = [
    { label: 'Total jobs', value: data.totalJobs },
    { label: 'Active jobs', value: data.activeJobs },
    { label: 'Applicants', value: data.totalApplicants },
    { label: 'Shortlisted', value: data.shortlisted },
    { label: 'Interviews', value: data.interviewsScheduled },
    { label: 'Offers', value: data.offers },
    { label: 'Hires', value: data.hires },
    { label: 'Rejection rate', value: `${data.rejectionRate}%` },
  ]

  const funnelData = STATUS_ORDER.map((s) => ({
    stage: FUNNEL_LABELS[s],
    count: data.funnel[s] ?? 0,
  }))
  const trendData = data.trend.map((t) => ({ day: t.day.slice(5), count: t.count }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Recruitment dashboard</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Hiring funnel</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="stage" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Applications — last 30 days</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
