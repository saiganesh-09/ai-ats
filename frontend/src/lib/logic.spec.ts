import { describe, expect, it } from 'vitest'
import { toJobPayload } from '@/components/JobForm'
import { homeFor } from './auth'
import type { User } from './types'

const user = (role: User['role'], isSuperadmin = false) =>
  ({ role, isSuperadmin, companyId: null }) as User

describe('homeFor — role-based landing', () => {
  it('routes each role to its portal', () => {
    expect(homeFor(user('CANDIDATE'))).toBe('/candidate')
    expect(homeFor(user('RECRUITER'))).toBe('/recruiter/dashboard')
    expect(homeFor(user('HIRING_MANAGER'))).toBe('/hiring')
    expect(homeFor(user('ADMIN'))).toBe('/admin/dashboard')
  })
  it('superadmin flag wins over role', () => {
    expect(homeFor(user('RECRUITER', true))).toBe('/admin/dashboard')
  })
})

describe('toJobPayload — form → API conversion', () => {
  const base = {
    title: 'Eng', description: 'x'.repeat(25),
    employmentType: 'FULL_TIME' as const,
    experienceLevel: 'MID' as const,
    workMode: 'REMOTE' as const,
  }

  it('parses numeric fields and csv skills', () => {
    const p = toJobPayload({
      ...base, salaryMin: '120000', salaryMax: '160000', openings: '3',
      requiredSkills: 'ts, node , sql', preferredSkills: '',
    })
    expect(p.salaryMin).toBe(120000)
    expect(p.salaryMax).toBe(160000)
    expect(p.openings).toBe(3)
    expect(p.requiredSkills).toEqual(['ts', 'node', 'sql'])
    expect(p.preferredSkills).toEqual([])
  })

  it('blank optional fields become undefined, not empty strings', () => {
    const p = toJobPayload({ ...base, applicationDeadline: '', location: '' })
    expect(p.applicationDeadline).toBeUndefined()
    expect(p.location).toBe('')
  })

  it('non-numeric salary strings stay undefined', () => {
    const p = toJobPayload({ ...base, salaryMin: '' })
    expect(p.salaryMin).toBeUndefined()
  })
})
