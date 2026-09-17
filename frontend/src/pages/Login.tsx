import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await login(email, password)
      const from = (location.state as { from?: string })?.from
      navigate(from ?? (user.role === 'recruiter' ? '/recruiter/jobs' : '/'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <label className="block text-sm">
          Email
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <button
          disabled={busy}
          className="w-full rounded bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="text-center text-sm text-slate-500">
          No account? <Link to="/register" className="text-indigo-600">Sign up</Link>
        </p>
      </form>
    </div>
  )
}
