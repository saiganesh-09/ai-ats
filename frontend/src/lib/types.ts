// API contract types — mirror the NestJS controllers' response shapes.
export type Role = 'CANDIDATE' | 'RECRUITER' | 'HIRING_MANAGER' | 'ADMIN'
export type ApplicationStatus =
  | 'APPLIED' | 'SCREENING' | 'SHORTLISTED' | 'INTERVIEW'
  | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN'

export interface User {
  id: number
  email: string
  fullName: string
  role: Role
  isActive: boolean
  isSuperadmin: boolean
  companyId: number | null
  company?: { name: string } | null
  createdAt: string
}

export interface Company {
  id: number
  name: string
  inviteCode: string
  createdAt: string
  users?: Pick<User, 'id' | 'fullName' | 'email' | 'role' | 'isActive'>[]
}

export interface Profile {
  id: number
  headline: string | null
  skills: string[]
  experience: Array<{ title?: string; company?: string; years?: number; description?: string }>
  education: Array<{ degree?: string; institution?: string; year?: number }>
  certifications: Array<{ name?: string; issuer?: string; year?: number }>
}

export interface Job {
  id: number
  companyId: number
  title: string
  location: string | null
  description: string
  requirements: string | null
  status: 'DRAFT' | 'OPEN' | 'CLOSED'
  createdAt: string
  company?: { name: string }
  hiringManager?: { id: number; fullName: string } | null
  _count?: { applications: number }
}

export interface ParsedResume {
  summary?: string
  skills?: string[]
  experience?: unknown[]
  education?: unknown[]
}

export interface Resume {
  id: number
  originalFilename: string
  parsed: ParsedResume | null
  createdAt: string
}

export interface MatchDetails {
  score: number
  matched_skills: string[]
  missing_skills: string[]
  explanation: string
}

export interface Application {
  id: number
  jobId: number
  status: ApplicationStatus
  coverNote: string | null
  matchScore: number | null
  matchDetails: MatchDetails | null
  aiSummary: string | null
  createdAt: string
  job?: Job
  candidate?: Pick<User, 'id' | 'fullName' | 'email'> & { profile?: Profile | null }
  resume?: Resume
  assignedRecruiter?: { id: number; fullName: string } | null
  notes?: Note[]
  feedback?: Feedback[]
  interviews?: Interview[]
}

export interface Note {
  id: number
  text: string
  createdAt: string
  author: { fullName: string }
}

export interface Feedback {
  id: number
  text: string
  rating: number | null
  createdAt: string
  author: { fullName: string; role: Role }
}

export interface Interview {
  id: number
  applicationId: number
  scheduledAt: string
  location: string | null
  link: string | null
  notes: string | null
  application?: Application
}

export interface Notification {
  id: number
  type: string
  payload: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

export interface SavedJob {
  id: number
  jobId: number
  job: Job
}

export interface Report {
  id: number
  reason: string
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED'
  createdAt: string
  reporter: { fullName: string; email: string }
  job: { id: number; title: string; status: string }
}

export interface ActivityEntry {
  id: number
  action: string
  entityType: string | null
  entityId: number | null
  createdAt: string
  actor: { fullName: string; email: string } | null
}

export interface Dashboard {
  totalJobs: number
  activeJobs: number
  totalApplicants: number
  shortlisted: number
  interviewsScheduled: number
  offers: number
  hires: number
  rejectionRate: number
  funnel: Record<string, number>
  trend: { day: string; count: number }[]
}

export interface AdminAnalytics {
  totalUsers: number
  totalCandidates: number
  totalRecruiters: number
  totalCompanies: number
  totalJobs: number
  activeJobs: number
  totalApplications: number
  successfulHires: number
  signupsTrend: { day: string; count: number }[]
  appsTrend: { day: string; count: number }[]
}

export const STATUS_ORDER: ApplicationStatus[] = [
  'APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED',
]
