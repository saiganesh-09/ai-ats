import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Job, Resume } from '../types'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resumeId, setResumeId] = useState<number | ''>('')
  const [coverNote, setCoverNote] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.getJob(Number(id)).then(setJob).catch(() => setError('Job not found'))
  }, [id])

  useEffect(() => {
    if (user?.role === 'candidate') {
      api.myResumes().then(setResumes)
    }
  }, [user])

  const apply = async () => {
    if (!resumeId) return
    setError('')
    try {
      await api.apply(Number(id), Number(resumeId), coverNote || undefined)
      setMessage('Application submitted!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply')
    }
  }

  if (error && !job) return <p className="text-red-600">{error}</p>
  if (!job) return <p className="text-slate-500">Loading…</p>

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="text-sm text-indigo-600">← Back to jobs</Link>
      <div className="mt-3 rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{job.title}</h1>
        <p className="text-slate-600">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
        <div className="prose-sm mt-4 whitespace-pre-wrap text-slate-700">{job.description}</div>
        {job.requirements && (
          <div className="mt-4 rounded bg-slate-50 p-3 text-sm">
            <strong>Requirements:</strong> {job.requirements}
          </div>
        )}
      </div>

      {user?.role === 'candidate' && (
        <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold">Apply to this job</h2>
          {message ? (
            <p className="rounded bg-emerald-50 p-3 text-emerald-700">{message}</p>
          ) : resumes.length === 0 ? (
            <p className="text-sm text-slate-600">
              Upload a resume first on the{' '}
              <Link to="/resumes" className="text-indigo-600">My Resumes</Link> page.
            </p>
          ) : (
            <div className="space-y-3">
              <select
                value={resumeId} onChange={(e) => setResumeId(Number(e.target.value))}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">Select a resume…</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>{r.original_filename}</option>
                ))}
              </select>
              <textarea
                placeholder="Cover note (optional)" value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm" rows={3}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={apply} disabled={!resumeId}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Submit application
              </button>
            </div>
          )}
        </div>
      )}
      {!user && (
        <p className="mt-6 text-sm text-slate-600">
          <Link to="/login" className="text-indigo-600">Log in</Link> as a candidate to apply.
        </p>
      )}
    </div>
  )
}
