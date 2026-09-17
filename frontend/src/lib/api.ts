// API client. Two jobs beyond plain fetch:
// 1. Attaches the Bearer access token to every request.
// 2. On a 401, tries the refresh endpoint ONCE (httpOnly cookie carries the
//    refresh token), then retries the original request — seamless token
//    rotation without the UI noticing.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
const TOKEN_KEY = 'ats_access_token'

export function getToken() {
  return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string, // error.code from the {success:false} envelope
  ) {
    super(message)
  }
}

let refreshing: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) return false
      const data = await res.json()
      setToken(data.accessToken)
      return true
    })
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0)
    })
  return refreshing
}

async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const isForm = options.body instanceof FormData
  const res = await fetch(BASE + path, {
    ...options,
    credentials: 'include', // sends the refresh cookie on auth endpoints
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // New contract: {success:false, error:{code,message}} — fall back to the
    // old NestJS shape for resilience.
    const env = (body as { error?: { code?: string; message?: string | string[] } }).error
    const raw = env?.message ?? (body as { message?: string | string[] }).message
    throw new ApiError(
      res.status,
      Array.isArray(raw) ? raw.join(', ') : (raw ?? `Request failed (${res.status})`),
      env?.code,
    )
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && !path.startsWith('/auth/')) {
      if (await tryRefresh()) return rawRequest<T>(path, options)
      setToken(null)
    }
    throw e
  }
}
