'use client'
// Auth context: holds the current user, exposes login/register/logout.
// On mount, validates any stored access token; if expired, the api client's
// refresh flow silently gets a new one via the httpOnly refresh cookie.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { api } from './endpoints'
import { getToken, setToken } from './api'
import type { Role, User } from './types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (data: { email: string; password: string; fullName: string; role: string }) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // No-token users start unblocked — the initializer reads localStorage
  // once instead of a synchronous setState inside the bootstrap effect.
  const [loading, setLoading] = useState(
    () => typeof window === 'undefined' || !!getToken(),
  )
  const router = useRouter()

  useEffect(() => {
    if (!getToken()) return // no session — loading was already false at init
    api.me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    setToken(res.accessToken)
    setUser(res.user)
    return res.user
  }

  const register: AuthContextValue['register'] = async (data) => {
    const res = await api.register(data)
    setToken(res.accessToken)
    setUser(res.user)
    return res.user
  }

  const logout = async () => {
    try {
      await api.logout()
    } finally {
      setToken(null)
      setUser(null)
      router.push('/')
    }
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

/** Client-side route guard. Real enforcement is server-side — this is UX. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/login')
    else if (!roles.includes(user.role) && !user.isSuperadmin) router.replace('/')
  }, [user, loading, roles, router])

  if (loading || !user || (!roles.includes(user.role) && !user.isSuperadmin)) {
    return <div className="p-10 text-muted-foreground">Loading…</div>
  }
  return <>{children}</>
}

/** Home route per role — where users land after login. */
export function homeFor(user: User): string {
  if (user.isSuperadmin || user.role === 'ADMIN') return '/admin/dashboard'
  if (user.role === 'RECRUITER') return '/recruiter/dashboard'
  if (user.role === 'HIRING_MANAGER') return '/hiring'
  return '/candidate'
}
