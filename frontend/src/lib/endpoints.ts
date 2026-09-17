// Typed endpoint wrappers — components call these, never request() directly.
import { request } from './api'
import type {
  ActivityEntry, AdminAnalytics, Application, CandidateDashboard,
  CandidateInsights, Company, Dashboard, Interview, Job, JobSearchParams,
  MatchDetails, Notification, Paginated, Profile, QuestionBank, Report,
  Resume, SavedJob, User,
} from './types'

export const api = {
  // auth
  register: (data: { email: string; password: string; fullName: string; role: string }) =>
    request<{ accessToken: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/auth/me'),

  // companies
  createCompany: (name: string) =>
    request<Company>('/companies', { method: 'POST', body: JSON.stringify({ name }) }),
  joinCompany: (inviteCode: string) =>
    request<Company>('/companies/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  listCompanies: () => request<(Company & { _count: { jobs: number } })[]>('/companies'),
  myCompany: () => request<Company | null>('/companies/mine'),
  setMemberRole: (userId: number, role: string) =>
    request<User>(`/companies/members/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

  // profiles
  myProfile: () => request<Profile>('/profiles/mine'),
  updateProfile: (data: Partial<Profile>) =>
    request<Profile>('/profiles/mine', { method: 'PUT', body: JSON.stringify(data) }),

  // jobs
  listJobs: (params?: JobSearchParams) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
    )
    return request<Paginated<Job>>(`/jobs${qs.size ? `?${qs}` : ''}`)
  },
  getJob: (id: number) => request<Job>(`/jobs/${id}`),
  manageJobs: () => request<Job[]>('/jobs/manage/list'),
  createJob: (data: {
    title: string
    location?: string
    description: string
    requirements?: string
    employmentType?: string
    experienceLevel?: string
    workMode?: string
    salaryMin?: number
    salaryMax?: number
    educationRequirement?: string
    applicationDeadline?: string
    openings?: number
    requiredSkills?: string[]
    preferredSkills?: string[]
    hiringManagerId?: number
  }) => request<Job>('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  updateJob: (id: number, data: Partial<Job>) =>
    request<Job>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  jobAction: (id: number, action: 'publish' | 'pause' | 'close') =>
    request<Job>(`/jobs/${id}/${action}`, { method: 'POST' }),
  analyzeJob: (id: number) => request<Record<string, unknown>>(`/jobs/${id}/analyze`, { method: 'POST' }),
  saveJob: (id: number) => request<SavedJob>(`/jobs/${id}/save`, { method: 'POST' }),
  unsaveJob: (id: number) => request<void>(`/jobs/${id}/save`, { method: 'DELETE' }),
  savedJobs: () => request<SavedJob[]>('/jobs/saved/mine'),
  reportJob: (id: number, reason: string) =>
    request<Report>(`/jobs/${id}/report`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // resumes
  uploadResume: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<Resume>('/resumes', { method: 'POST', body: form })
  },
  myResumes: () => request<Resume[]>('/resumes/mine'),
  deleteResume: (id: number) => request<void>(`/resumes/${id}`, { method: 'DELETE' }),

  // applications
  apply: (jobId: number, resumeId: number, coverNote?: string) =>
    request<Application>('/applications', { method: 'POST', body: JSON.stringify({ jobId, resumeId, coverNote }) }),
  myApplications: () => request<Application[]>('/applications/mine'),
  withdraw: (id: number) => request<Application>(`/applications/${id}/withdraw`, { method: 'POST' }),
  pipeline: (jobId: number, params?: { q?: string; status?: string; sort?: string }) => {
    const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][])
    return request<Application[]>(`/applications/job/${jobId}${qs.size ? `?${qs}` : ''}`)
  },
  applicationDetail: (id: number) => request<Application>(`/applications/${id}`),
  setStatus: (id: number, status: string, reason?: string) =>
    request<Application>(`/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }),
  assign: (id: number, recruiterId: number) =>
    request<Application>(`/applications/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ recruiterId }) }),
  addNote: (id: number, text: string) =>
    request<Application>(`/applications/${id}/notes`, { method: 'POST', body: JSON.stringify({ text }) }),
  addFeedback: (id: number, text: string, rating?: number, interviewId?: number) =>
    request<Application>(`/applications/${id}/feedback`, { method: 'POST', body: JSON.stringify({ text, rating, interviewId }) }),
  scoreApplication: (id: number) =>
    request<MatchDetails>(`/applications/${id}/score`, { method: 'POST' }),
  summarizeApplication: (id: number) =>
    request<CandidateInsights>(`/applications/${id}/summarize`, { method: 'POST' }),
  generateQuestions: (id: number) =>
    request<QuestionBank>(`/applications/${id}/questions`, { method: 'POST' }),
  saveQuestions: (id: number, questions: QuestionBank) =>
    request<QuestionBank>(`/applications/${id}/questions`, { method: 'PUT', body: JSON.stringify({ questions }) }),

  // interviews
  scheduleInterview: (data: {
    applicationId: number
    type: 'ONLINE' | 'PHONE' | 'ONSITE'
    scheduledAt: string
    endsAt?: string
    interviewerId?: number
    location?: string
    link?: string
    notes?: string
  }) =>
    request<Interview>('/interviews', { method: 'POST', body: JSON.stringify(data) }),
  myInterviews: () => request<Interview[]>('/interviews/mine'),
  companyInterviews: () => request<Interview[]>('/interviews/company'),
  companyApplications: (params?: { q?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
    )
    return request<Paginated<Application>>(`/applications/company${qs.size ? `?${qs}` : ''}`)
  },

  // notifications
  notifications: (page = 1) => request<Paginated<Notification>>(`/notifications/mine?page=${page}`),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  markRead: (id: number) => request<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request<void>('/notifications/read-all', { method: 'PATCH' }),

  // analytics
  dashboard: () => request<Dashboard>('/analytics/candidate'),
  candidateDashboard: () => request<CandidateDashboard>('/analytics/candidate-dashboard'),

  // admin
  adminAnalytics: () => request<AdminAnalytics>('/admin/analytics'),
  adminJobs: () => request<(Job & { recruiter?: { fullName: string } })[]>('/admin/jobs'),
  adminApplications: () => request<Application[]>('/admin/applications'),
  adminUsers: (params?: { q?: string; role?: string; page?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
    )
    return request<Paginated<User>>(`/admin/users${qs.size ? `?${qs}` : ''}`)
  },
  setUserStatus: (id: number, isActive: boolean) =>
    request<User>(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  adminCompanies: () => request<(Company & { _count: { users: number; jobs: number } })[]>('/admin/companies'),
  adminDeleteJob: (id: number) => request<{ ok: boolean }>(`/admin/jobs/${id}`, { method: 'DELETE' }),
  adminReports: () => request<Report[]>('/admin/reports'),
  resolveReport: (id: number, status: 'RESOLVED' | 'DISMISSED') =>
    request<Report>(`/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  adminActivity: (page = 1) => request<Paginated<ActivityEntry>>(`/admin/audit-logs?page=${page}`),
}
