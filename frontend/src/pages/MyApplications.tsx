import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { StatusBadge } from '../components/Badges'
import type { Application } from '../types'

export default function MyApplications() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.myApplications().then(setApplications).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-500">Loading…</p>

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">My applications</h1>
      {applications.length === 0 ? (
        <p className="text-slate-500">
          No applications yet. <Link to="/" className="text-indigo-600">Browse open jobs</Link>.
        </p>
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
              <div>
                <Link to={`/jobs/${a.job_id}`} className="font-semibold hover:text-indigo-600">
                  {a.job.title}
                </Link>
                <p className="text-sm text-slate-600">{a.job.company}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Applied {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
