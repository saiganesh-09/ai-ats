import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-bold text-indigo-600">
          AI ATS
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/" className="hover:text-indigo-600">Jobs</Link>
          {user?.role === 'candidate' && (
            <>
              <Link to="/resumes" className="hover:text-indigo-600">My Resumes</Link>
              <Link to="/applications" className="hover:text-indigo-600">My Applications</Link>
            </>
          )}
          {user?.role === 'recruiter' && (
            <Link to="/recruiter/jobs" className="hover:text-indigo-600">My Postings</Link>
          )}
          {user ? (
            <>
              <span className="text-slate-500">{user.full_name} ({user.role})</span>
              <button
                onClick={() => { logout(); navigate('/') }}
                className="rounded border px-3 py-1 hover:bg-slate-100"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-indigo-600">Log in</Link>
              <Link
                to="/register"
                className="rounded bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
