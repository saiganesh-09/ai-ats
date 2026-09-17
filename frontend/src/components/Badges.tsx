export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-slate-400">not scored</span>
  const color =
    score >= 75 ? 'bg-emerald-100 text-emerald-700'
    : score >= 50 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {Math.round(score)}% match
    </span>
  )
}

const STATUS_STYLES: Record<string, string> = {
  applied: 'bg-slate-100 text-slate-700',
  screening: 'bg-blue-100 text-blue-700',
  interview: 'bg-violet-100 text-violet-700',
  offer: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.applied}`}>
      {status}
    </span>
  )
}
