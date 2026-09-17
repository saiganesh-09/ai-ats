import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import type { Role } from '../types'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('candidate')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await register(email, password, fullName, role)
      navigate(user.role === 'recruiter' ? '/recruiter/jobs' : '/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(['candidate', 'recruiter'] as const).map((r) => (
            <button
              key={r} type="button" onClick={() => setRole(r)}
              className={`rounded border py-2 capitalize ${role === r ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}
            >
              {r === 'candidate' ? 'Job seeker' : 'Recruiter'}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Full name
          <input
            required value={fullName} onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Password (min 8 chars)
          <input
            type="password" required minLength={8} value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <button
          disabled={busy}
          className="w-full rounded bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-center text-sm text-slate-500">
          Have an account? <Link to="/login" className="text-indigo-600">Log in</Link>
        </p>
      </form>
    </div>
  )
}
