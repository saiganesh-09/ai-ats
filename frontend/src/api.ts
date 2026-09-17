// Single API client: every backend call goes through `request`, which
// attaches the JWT and normalizes errors. Components never call fetch directly.
import type { Applicant, Application, Job, MatchDetails, Resume, Role, User } from './types'

const BASE = 'http://localhost:8000'

const TOKEN_KEY = 'ats_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const isForm = options.body instanceof FormData
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string }).detail ?? `Request failed (${res.status})`)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const api = {
  register: (email: string, password: string, full_name: string, role: Role) =>
    request<{ access_token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, role }),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/auth/me'),

  listJobs: (q?: string) => request<Job[]>(`/jobs${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getJob: (id: number) => request<Job>(`/jobs/${id}`),
  myJobs: () => request<Job[]>('/jobs/mine'),
  createJob: (data: Omit<Job, 'id' | 'status' | 'created_at'>) =>
    request<Job>('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  updateJob: (id: number, data: Partial<Job>) =>
    request<Job>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteJob: (id: number) => request<void>(`/jobs/${id}`, { method: 'DELETE' }),
  jobApplications: (jobId: number) => request<Applicant[]>(`/jobs/${jobId}/applications`),

  uploadResume: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<Resume>('/resumes', { method: 'POST', body: form })
  },
  myResumes: () => request<Resume[]>('/resumes/mine'),

  apply: (job_id: number, resume_id: number, cover_note?: string) =>
    request<Application>('/applications', {
      method: 'POST',
      body: JSON.stringify({ job_id, resume_id, cover_note }),
    }),
  myApplications: () => request<Application[]>('/applications/mine'),
  updateStatus: (id: number, status: string) =>
    request<Application>(`/applications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  scoreApplication: (id: number) =>
    request<MatchDetails>(`/applications/${id}/score`, { method: 'POST' }),
}
