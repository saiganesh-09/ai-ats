// Auth state via React Context: any component can call useAuth() to get the
// current user. Token persists in localStorage so refresh keeps you logged in.
//
// Interview note: localStorage tokens are vulnerable to XSS — a production app
// would prefer httpOnly cookies + CSRF protection. Acceptable for this project.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, getToken, setToken } from './api'
import type { Role, User } from './types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, fullName: string, role: Role) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On load, validate any stored token against the backend.
    if (!getToken()) {
      setLoading(false)
      return
    }
    api.me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    setToken(res.access_token)
    setUser(res.user)
    return res.user
  }

  const register: AuthContextValue['register'] = async (email, password, fullName, role) => {
    const res = await api.register(email, password, fullName, role)
    setToken(res.access_token)
    setUser(res.user)
    return res.user
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: Role }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="p-8 text-slate-500">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return <>{children}</>
}
