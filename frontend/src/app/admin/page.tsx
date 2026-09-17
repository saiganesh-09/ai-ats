'use client'
import { useQuery } from '@tanstack/react-query'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '@/lib/endpoints'
import { useAuth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['adminAnalytics'], queryFn: api.adminAnalytics })

  if (isLoading) return <div className="mx-auto max-w-6xl p-8"><Skeleton className="h-96" /></div>
  if (!data) return null

  const stats = [
    { label: 'Total users', value: data.totalUsers },
    { label: 'Candidates', value: data.totalCandidates },
    { label: 'Recruiters', value: data.totalRecruiters },
    { label: 'Companies', value: data.totalCompanies },
    { label: 'Total jobs', value: data.totalJobs },
    { label: 'Active jobs', value: data.activeJobs },
    { label: 'Applications', value: data.totalApplications },
    { label: 'Successful hires', value: data.successfulHires },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">
        {user?.isSuperadmin ? 'Platform analytics' : 'Company analytics'}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {user?.isSuperadmin ? 'System-wide view across all companies.' : 'Scoped to your company.'}
      </p>
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
        {[
          { title: 'Signups — last 30 days', data: data.signupsTrend },
          { title: 'Applications — last 30 days', data: data.appsTrend },
        ].map((chart) => (
          <Card key={chart.title}>
            <CardHeader><CardTitle className="text-base">{chart.title}</CardTitle></CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.data.map((t) => ({ day: t.day.slice(5), count: t.count }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
