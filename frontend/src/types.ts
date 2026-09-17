// Mirrors backend/app/schemas.py — the API contract, typed on both ends.
export type Role = 'recruiter' | 'candidate'

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
}

export interface Job {
  id: number
  title: string
  company: string
  location: string | null
  description: string
  requirements: string | null
  status: string
  created_at: string
}

export interface ParsedResume {
  summary?: string
  skills?: string[]
  experience?: Array<{ title?: string; company?: string; years?: number }>
  education?: Array<{ degree?: string; institution?: string }>
}

export interface Resume {
  id: number
  original_filename: string
  parsed: ParsedResume | null
  created_at: string
}

export interface MatchDetails {
  score: number
  matched_skills: string[]
  missing_skills: string[]
  explanation: string
}

export interface Application {
  id: number
  job_id: number
  resume_id: number
  status: string
  cover_note: string | null
  match_score: number | null
  match_details: MatchDetails | null
  created_at: string
  job: Job
}

export interface Applicant {
  id: number
  status: string
  cover_note: string | null
  match_score: number | null
  match_details: MatchDetails | null
  created_at: string
  candidate: User
  resume: Resume
}

export const APPLICATION_STATUSES = ['applied', 'screening', 'interview', 'offer', 'rejected'] as const
