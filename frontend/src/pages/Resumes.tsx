import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Resume } from '../types'

export default function Resumes() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const load = () => api.myResumes().then(setResumes)
  useEffect(() => { load() }, [])

  const upload = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      await api.uploadResume(file)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My resumes</h1>
        <button
          onClick={() => fileInput.current?.click()} disabled={busy}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Uploading & parsing…' : 'Upload resume'}
        </button>
        <input
          ref={fileInput} type="file" accept=".pdf,.txt" hidden
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
      {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <p className="mb-4 text-sm text-slate-500">
        Upload a PDF or TXT resume — the AI extracts skills, experience and education automatically.
      </p>
      <div className="space-y-4">
        {resumes.map((r) => (
          <div key={r.id} className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex justify-between">
              <h2 className="font-semibold">{r.original_filename}</h2>
              <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            {r.parsed?.summary && <p className="mt-1 text-sm text-slate-600">{r.parsed.summary}</p>}
            {r.parsed?.skills && r.parsed.skills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.parsed.skills.map((s) => (
                  <span key={s} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{s}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {resumes.length === 0 && <p className="text-slate-500">No resumes yet.</p>}
      </div>
    </div>
  )
}
