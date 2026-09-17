import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import type { Job } from '../../types'

export default function MyJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', company: '', location: '', description: '', requirements: '' })
  const [error, setError] = useState('')

  const load = () => api.myJobs().then(setJobs)
  useEffect(() => { load() }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.createJob({
        ...form,
        location: form.location || null,
        requirements: form.requirements || null,
      })
      setForm({ title: '', company: '', location: '', description: '', requirements: '' })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job')
    }
  }

  const toggleStatus = async (job: Job) => {
    await api.updateJob(job.id, { status: job.status === 'open' ? 'closed' : 'open' })
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My job postings</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'Post a job'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="mb-6 space-y-3 rounded-lg border bg-white p-6 shadow-sm">
          {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Job title" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded border px-3 py-2 text-sm" />
            <input required placeholder="Company" value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="rounded border px-3 py-2 text-sm" />
          </div>
          <input placeholder="Location (optional)" value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm" />
          <textarea required minLength={20} placeholder="Job description (min 20 chars)" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm" rows={4} />
          <textarea placeholder="Requirements (optional — used by AI matching)" value={form.requirements}
            onChange={(e) => setForm({ ...form, requirements: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm" rows={2} />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Publish job
          </button>
        </form>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
            <div>
              <Link to={`/recruiter/jobs/${job.id}`} className="font-semibold hover:text-indigo-600">
                {job.title}
              </Link>
              <p className="text-sm text-slate-600">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${job.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {job.status}
              </span>
              <button onClick={() => toggleStatus(job)} className="text-xs text-slate-500 hover:text-indigo-600">
                {job.status === 'open' ? 'Close' : 'Reopen'}
              </button>
              <Link
                to={`/recruiter/jobs/${job.id}`}
                className="rounded border px-3 py-1 text-sm hover:bg-slate-50"
              >
                View applicants
              </Link>
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="text-slate-500">No postings yet — create your first job.</p>}
      </div>
    </div>
  )
}
