import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { ScoreBadge, StatusBadge } from '../../components/Badges'
import { APPLICATION_STATUSES, type Applicant, type Job } from '../../types'

export default function JobPipeline() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [scoringId, setScoringId] = useState<number | null>(null)

  const load = () => api.jobApplications(Number(id)).then(setApplicants)
  useEffect(() => {
    api.getJob(Number(id)).then(setJob)
    load()
  }, [id])

  const score = async (applicationId: number) => {
    setScoringId(applicationId)
    try {
      await api.scoreApplication(applicationId)
      await load()
    } finally {
      setScoringId(null)
    }
  }

  const setStatus = async (applicationId: number, status: string) => {
    await api.updateStatus(applicationId, status)
    load()
  }

  return (
    <div>
      <Link to="/recruiter/jobs" className="text-sm text-indigo-600">← My postings</Link>
      <h1 className="mt-2 text-2xl font-bold">
        {job ? `${job.title} — ${job.company}` : 'Applicants'}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Sorted by AI match score. Click "Score" to run the AI matcher on an applicant.
      </p>
      <div className="space-y-4">
        {applicants.map((a) => (
          <div key={a.id} className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{a.candidate.full_name}</h2>
                <p className="text-sm text-slate-500">{a.candidate.email}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Applied {new Date(a.created_at).toLocaleDateString()} · {a.resume.original_filename}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ScoreBadge score={a.match_score} />
                <button
                  onClick={() => score(a.id)} disabled={scoringId === a.id}
                  className="rounded border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {scoringId === a.id ? 'Scoring…' : a.match_score === null ? 'Score' : 'Re-score'}
                </button>
                <select
                  value={a.status} onChange={(e) => setStatus(a.id, e.target.value)}
                  className="rounded border px-2 py-1 text-sm"
                >
                  {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {a.cover_note && <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-600">"{a.cover_note}"</p>}

            {a.match_details && (
              <div className="mt-3 border-t pt-3 text-sm">
                <p className="text-slate-700">{a.match_details.explanation}</p>
                <div className="mt-2 flex flex-wrap gap-4">
                  <div>
                    <span className="text-xs font-medium text-emerald-700">Matched: </span>
                    {a.match_details.matched_skills.map((s) => (
                      <span key={s} className="mr-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{s}</span>
                    ))}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-red-700">Missing: </span>
                    {a.match_details.missing_skills.map((s) => (
                      <span key={s} className="mr-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {a.resume.parsed?.skills && a.resume.parsed.skills.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <StatusBadge status={a.status} />
                <span className="ml-3 text-xs text-slate-400">
                  Resume skills: {a.resume.parsed.skills.join(', ')}
                </span>
              </div>
            )}
          </div>
        ))}
        {applicants.length === 0 && <p className="text-slate-500">No applicants yet.</p>}
      </div>
    </div>
  )
}
