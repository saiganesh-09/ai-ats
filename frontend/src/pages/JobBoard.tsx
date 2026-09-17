import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { Job } from '../types'

export default function JobBoard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      api.listJobs(q || undefined)
        .then(setJobs)
        .finally(() => setLoading(false))
    }, 200) // debounce search
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Open positions</h1>
      <input
        placeholder="Search title or company…" value={q} onChange={(e) => setQ(e.target.value)}
        className="mb-6 w-full rounded border bg-white px-4 py-2"
      />
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="text-slate-500">No open positions found.</p>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Link
              key={job.id} to={`/jobs/${job.id}`}
              className="block rounded-lg border bg-white p-5 shadow-sm transition hover:border-indigo-300"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{job.title}</h2>
                  <p className="text-sm text-slate-600">
                    {job.company}{job.location ? ` · ${job.location}` : ''}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{job.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
