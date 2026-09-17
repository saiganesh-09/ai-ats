import { Badge } from '@/components/ui/badge'
import type { ApplicationStatus } from '@/lib/types'

const STATUS_STYLE: Record<string, string> = {
  APPLIED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  SCREENING: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  SHORTLISTED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  INTERVIEW: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  OFFER: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  HIRED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  WITHDRAWN: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
}

export function StatusBadge({ status }: { status: ApplicationStatus | string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.APPLIED}`}>
      {status}
    </span>
  )
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <Badge variant="outline" className="text-muted-foreground">not scored</Badge>
  }
  const variant =
    score >= 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
    : score >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${variant}`}>
      {Math.round(score)}% match
    </span>
  )
}

export function JobStatusBadge({ status }: { status: string }) {
  const style =
    status === 'OPEN' ? 'bg-emerald-100 text-emerald-700'
    : status === 'DRAFT' ? 'bg-slate-100 text-slate-600'
    : 'bg-zinc-200 text-zinc-500'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  )
}
